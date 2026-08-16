import type { Database } from "../../../core/db/client";
import { DrizzleBeliefRepository } from "../../../core/belief-engine";
import { DrizzleConceptRepository } from "../../../core/concept-graph";
import { DrizzleContradictionRepository } from "../../../core/contradiction-engine";
import {
  listActiveGoals,
  listActiveHabits,
  listActiveProjects,
  listRecentlyCompletedGoals,
  listRecentlyCompletedProjects,
  type EntityId,
  type LifeDomainType,
  type LifeGraphContext,
} from "../../../core/life";
import { rankKnowledgeGaps, type DomainCoverageSignals } from "../../../core/knowledge-gaps";
import { createMemoryEngine } from "../../../core/memory-engine";
import { DrizzleMemoryRepository } from "../../../core/memory-engine";
import { MIN_SCORE_WITH_UNDERSTANDING_SIGNAL } from "../../../core/memory-engine/ranking/deterministic-memory-ranking-strategy";
import { DrizzleCuriosityQuestionRepository } from "../../../core/curiosity-engine";
import { DrizzleInsightRepository, DrizzleReasoningRepository } from "../../../core/knowledge-engine";
import type { LifeStateItem, RealitySnapshot } from "../../../core/reality";
import { DrizzleSeenPromptRepository, SEEN_PROMPT_SUBJECT_TYPES } from "../../../core/seen-prompts";
import { span } from "../../../core/observability/trace";
import { assembleIdentityEvolution } from "../../identity-evolution";
import { explainInsight, type InsightExplanation } from "../../knowledge/services/explain-insight";
import { getCalendarSignalsForConversation } from "./get-calendar-signals-for-conversation";
import { getWearableSignalsForConversation } from "./get-wearable-signals-for-conversation";
import { selectContextualMemories } from "./select-contextual-memories";

/**
 * Ensamblador mínimo de `RealitySnapshot` (Beta 1 Roadmap, Sprint B2;
 * ADR-0013). Vive en `features/chat/`, no en `core/reality` ni en
 * ningún engine — ADR-0013 exige exactamente esto: "un futuro
 * ensamblador de aplicación... nunca dentro de core/reality o de
 * ningún engine". `core/chat` es hoy su único consumidor; si un
 * segundo consumidor real lo necesita, promoverlo a un lugar
 * compartido es la decisión de ese momento, no de este.
 *
 * Efímero a propósito: no escribe nada en base de datos, no persiste
 * nada, existe solo durante el ciclo de esta función. Cada llamada
 * ensambla desde cero — nunca se cachea entre requests.
 */

const RELEVANT_MEMORY_LIMIT = 5;
const RELEVANT_INSIGHT_LIMIT = 3;
/**
 * Deliberadamente más baja que `RELEVANT_INSIGHT_LIMIT` -- una
 * conclusión de razonamiento ya es una síntesis de varios insights
 * (`core/knowledge-engine/reasoning`), así que compartir varias en el
 * mismo turno se sentiría como una lista de diagnósticos, no como una
 * observación puntual y genuina (ver `ReflectStrategyRule`).
 */
const RELEVANT_REASONING_LIMIT = 2;
/**
 * Como máximo una a la vez, nunca una lista -- ver docblock de
 * `ContradictionContextSnapshot`: traer varias tensiones abiertas al
 * mismo turno se sentiría como una acumulación de cargos, no como
 * acompañamiento genuino.
 */
const RELEVANT_CONTRADICTION_LIMIT = 1;
/** Ver docblock de `CommunicationPreferenceSnapshot`: un par de facetas estables, nunca una lista larga de instrucciones. */
const RELEVANT_COMMUNICATION_PREFERENCE_LIMIT = 2;
/** Ver docblock de `GrowingBeliefSnapshot`: como máximo una hipótesis en formación a la vez. */
const RELEVANT_GROWING_BELIEF_LIMIT = 1;
/** Ver docblock de `FadingBeliefSnapshot`: como máximo un capítulo cerrado a la vez. */
const RELEVANT_FADING_BELIEF_LIMIT = 1;
/** Ver docblock de `ReopenCandidateSnapshot`: como máximo una intención sin resolver a la vez. */
const RELEVANT_REOPEN_CANDIDATE_LIMIT = 1;
/** Ver docblock de `ClosureSnapshot`: como máximo un cierre a la vez. */
const RELEVANT_CLOSURE_LIMIT = 1;
/**
 * Identidad de fondo (Prioridad 1, `METADATA_INVENTORY_V1.md`): unos
 * pocos temas, nunca una lista completa -- mismo espíritu que
 * `RELEVANT_INSIGHT_LIMIT`, pero más bajo porque un concepto es una
 * sola palabra o frase corta (a diferencia de una interpretación
 * completa), así que 3 ya se sienten como suficientes sin sonar a
 * inventario de rasgos.
 */
const RELEVANT_CONCEPT_LIMIT = 3;
/**
 * A partir de cuántos días un Goal/Project completado deja de sentirse
 * "esto acaba de pasar" -- independiente de `seen_prompts`: un cierre
 * de hace meses, nunca reconocido, no debería sentirse como noticia
 * fresca la primera vez que este mecanismo corre para esa persona.
 */
const RECENTLY_COMPLETED_WINDOW_DAYS = 7;
/**
 * Banda de confianza "en formación" -- por debajo de esto es apenas
 * una mención aislada (ruido, no vale la pena mencionar ni para
 * confirmar); en o por encima de `BELIEF_CONFIDENCE_THRESHOLD` (55,
 * `consolidate-belief-from-insight.ts`) ya es lo bastante sólida para
 * `ReflectStrategyRule`, que la comparte como comprensión asentada, no
 * como algo por confirmar.
 */
const GROWING_BELIEF_MIN_CONFIDENCE = 30;
/**
 * Exportada (Auditoría de Experiencia V1, hallazgo H6): `/life/identity`
 * reutiliza este mismo corte para distinguir, en la propia interfaz, una
 * creencia todavía en formación de una ya asentada -- antes esa
 * distinción solo vivía en el prompt de IA (que nunca afirma una
 * creencia en formación como hecho); la persona veía un número de
 * confianza sin ninguna palabra que dijera qué tan sólido es. Un solo
 * corte, nunca un segundo umbral inventado aparte.
 */
export const GROWING_BELIEF_MAX_CONFIDENCE = 54;

/**
 * `core/reality` es kernel compartido: nunca importa el tipo `Goal`/
 * `Project`/`Habit` de `core/life`, así que esta traducción a la forma
 * neutral `LifeStateItem` vive aquí — la frontera anti-corrupción que
 * ADR-0013 exige, nunca dentro de `core/reality` ni de ningún engine.
 */
function toLifeStateItem(
  entity: { id: EntityId; title: string; domain?: LifeDomainType },
  dueDate?: Date,
): LifeStateItem {
  return { id: entity.id, title: entity.title, dueDate, domain: entity.domain };
}

/**
 * "Inteligencia desperdiciada" #1: `explainInsight` (`features/knowledge/services/`)
 * ya calcula, para `/memories`, cuántas veces y en cuánto tiempo se
 * repitió lo que respalda un insight -- pero el camino de chat
 * construía su propia lista, en paralelo, con solo `description` en
 * crudo (`DrizzleInsightRepository` directo, nunca `explainInsight`).
 * Reimplementada aquí, no importada de `insight-card.tsx`
 * (componente de UI, dirección de dependencia equivocada para un
 * servicio) -- misma fórmula exacta que ya está validada en
 * producción en `/memories`, para que la voz sea consistente entre
 * las dos superficies. `null` en el mismo caso que allí: sin fecha
 * real resuelta, silencio en vez de una frase a medias.
 */
function describeInsightConsistency(explanation: InsightExplanation): string | null {
  const { evidenceCount, spanDays, daysSinceMostRecentEvidence } = explanation;
  if (spanDays === null || daysSinceMostRecentEvidence === null) {
    return null;
  }

  const recency =
    daysSinceMostRecentEvidence <= 0
      ? "hoy"
      : daysSinceMostRecentEvidence === 1
        ? "ayer"
        : daysSinceMostRecentEvidence < 30
          ? `hace ${daysSinceMostRecentEvidence} días`
          : `hace ${Math.round(daysSinceMostRecentEvidence / 30)} ${Math.round(daysSinceMostRecentEvidence / 30) === 1 ? "mes" : "meses"}`;

  if (spanDays === 0) {
    return `lo he notado ${evidenceCount} veces, ${recency}`;
  }

  const span =
    spanDays < 30
      ? `${spanDays} días`
      : `${Math.round(spanDays / 30)} ${Math.round(spanDays / 30) === 1 ? "mes" : "meses"}`;

  return `lo he notado ${evidenceCount} veces a lo largo de ${span} -- la más reciente, ${recency}`;
}

export async function assembleRealitySnapshot(
  db: Database,
  context: LifeGraphContext,
  options: { currentMessage?: string; focusMemoryId?: EntityId } = {},
): Promise<RealitySnapshot> {
  // P0 (cierre del Alpha): con `currentMessage`, la selección responde
  // "¿qué necesita recordar LUZ para ESTE mensaje?" — no la de mayor
  // rank global (`selectContextualMemories`). Sin `currentMessage`
  // (p. ej. el Morning Brief del Dashboard, que no responde a un
  // mensaje puntual) se preserva el comportamiento anterior sin
  // cambios: ahí sí tiene sentido "lo más relevante en general".
  const recentlyCompletedSince = new Date(
    Date.now() - RECENTLY_COMPLETED_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );
  const seenPromptRepository = new DrizzleSeenPromptRepository(db);

  const [
    candidateMemories,
    focusedMemory,
    activeGoals,
    activeProjects,
    activeHabits,
    activeMemories,
    insights,
    beliefs,
    concepts,
    reasoningConclusions,
    pendingCuriosityQuestion,
    contradictions,
    calendarSignals,
    wearableSignals,
    recentlyCompletedGoals,
    recentlyCompletedProjects,
    seenIntentionIds,
    seenClosureIds,
    identitySnapshot,
  ] = await Promise.all([
    span("Memory.retrieve", "repository", () =>
      options.currentMessage
        ? selectContextualMemories(
            db,
            context,
            options.currentMessage,
            RELEVANT_MEMORY_LIMIT,
          )
        : createMemoryEngine(db).retrieve(context, {
            limit: RELEVANT_MEMORY_LIMIT,
            // Segunda capa de memoria (auditoría de arquitectura,
            // 2026-08-16): esta rama también alimenta el procesamiento de
            // Knowledge Engine (`focusMemoryId`, sin `currentMessage`), no
            // solo el chat en vivo -- LUZ debe seguir razonando sobre lo
            // que la persona ocultó de su propio dashboard.
            includeHiddenFromUser: true,
          }),
    ),
    span("Memory.focused", "repository", () =>
      options.focusMemoryId
        ? new DrizzleMemoryRepository(db)
            .getById(context, options.focusMemoryId)
            .then((memory) => (memory && !memory.suppressed ? memory : null))
        : Promise.resolve(null),
    ),
    span("Life.activeGoals", "repository", () => listActiveGoals(db, context)),
    span("Life.activeProjects", "repository", () => listActiveProjects(db, context)),
    span("Life.activeHabits", "repository", () => listActiveHabits(db, context)),
    // `type: "intention"` filtrado en JS, no en SQL -- mismo criterio
    // que `growingBeliefs`/`fadingBeliefs` sobre `beliefs.list()`:
    // Memory Engine no expone un filtro por tipo todavía, y agregar
    // uno nuevo para un solo consumidor no vale la pena antes de que
    // un segundo lo necesite.
    span("Memory.active", "repository", () => new DrizzleMemoryRepository(db).listActive(context)),
    span("Knowledge.insights", "repository", () => new DrizzleInsightRepository(db).list(context)),
    span("Knowledge.beliefs", "repository", () => new DrizzleBeliefRepository(db).list(context)),
    span("Knowledge.concepts", "repository", () => new DrizzleConceptRepository(db).list(context)),
    span("Knowledge.reasoning", "repository", () => new DrizzleReasoningRepository(db).list(context)),
    span("Curiosity", "repository", () => new DrizzleCuriosityQuestionRepository(db).getPending(context)),
    span("Contradiction", "repository", () => new DrizzleContradictionRepository(db).list(context)),
    // Calendario en la conversación (misión "conecta calendario con
    // conversación") -- `getCalendarSignalsForConversation` nunca
    // lanza (degrada a `[]` ante cualquier falla), así que puede vivir
    // en el mismo `Promise.all` que el resto sin arriesgar el
    // ensamblado completo por un problema de calendario.
    span("Calendar", "external_api", () => getCalendarSignalsForConversation(db, context)),
    // Wearable Foundation (`features/reality/`) -- mismo criterio de
    // tolerancia a fallos que Calendar (`getWearableSignalsForConversation`
    // nunca lanza, degrada a `[]`), pero sin necesitar el mismo cuidado
    // de tasa: es una lectura local, no una sincronización contra un
    // servidor externo en cada mensaje.
    span("Wearable", "repository", () => getWearableSignalsForConversation(db, context)),
    span("Life.recentlyCompletedGoals", "repository", () =>
      listRecentlyCompletedGoals(db, context, recentlyCompletedSince),
    ),
    span("Life.recentlyCompletedProjects", "repository", () =>
      listRecentlyCompletedProjects(db, context, recentlyCompletedSince),
    ),
    span("SeenPrompts.intentionFollowup", "repository", () =>
      seenPromptRepository.listSeenSubjectIds(context, SEEN_PROMPT_SUBJECT_TYPES.intentionFollowup),
    ),
    span("SeenPrompts.goalClosure", "repository", () =>
      seenPromptRepository.listSeenSubjectIds(context, SEEN_PROMPT_SUBJECT_TYPES.goalClosure),
    ),
    // Identity Evolution real (`features/identity-evolution`) -- única
    // frontera cruzada a propósito (`features/chat` normalmente nunca
    // importa de otro slice de `features/*`): este archivo ya es la
    // capa anti-corrupción que traduce motores/módulos reales a la
    // forma neutral de `RealitySnapshot`, mismo rol que ya cumple para
    // `core/belief-engine`/`core/knowledge-engine`. Tan barato como el
    // resto de este `Promise.all` -- `assembleIdentityEvolution` solo
    // reutiliza `describeEvolution` (ya real) + una consulta a
    // `core/concept-graph`, nunca construye `HomeState`/`ExperienceState`.
    span("Identity Evolution", "engine", () => assembleIdentityEvolution(db, context)),
  ]);

  const relevantMemories = focusedMemory
    ? [
        focusedMemory,
        ...candidateMemories.filter((memory) => memory.id !== focusedMemory.id),
      ].slice(0, RELEVANT_MEMORY_LIMIT)
    : candidateMemories;

  // P0 (incidente real, agosto 1-2, ver
  // docs/engineering/investigations/2026-08-02_memory_recall_value_change.md):
  // `MIN_SCORE_WITH_UNDERSTANDING_SIGNAL` mide, por diseño
  // (`DeterministicMemoryRankingStrategy`), CUÁNTO profundiza una
  // memoria la comprensión narrativa de la persona -- nunca si es
  // recuperable para responder algo puntual. Aplicarlo aquí sin
  // condición, después de `selectContextualMemories` (que YA calculó
  // relevancia real contra `currentMessage` -- tokens compartidos, tipo,
  // y `rank.score` como una señal más, nunca absoluta), descartaba
  // resultados genuinamente relevantes por un criterio que nunca fue
  // diseñado para decidir eso -- confirmado con datos reales: la
  // memoria del gasto del 1 de agosto (`rank_score = 19`) sí era
  // candidata en la posición 4 de 5, y este filtro la eliminaba antes
  // de llegar al prompt.
  //
  // Con `currentMessage` (el camino de chat en vivo, único llamador que
  // lo pasa -- `build-context.ts`): se confía en la relevancia que
  // `selectContextualMemories` ya calculó, sin volver a filtrar por un
  // eje distinto. Sin `currentMessage` (Morning Brief, bienvenida,
  // modelo de identidad -- ninguno responde a una pregunta puntual, los
  // otros 4 llamadores reales de esta función), el filtro sigue siendo
  // exactamente la pregunta correcta -- sin cambios ahí: "qué es lo
  // bastante significativo para mencionar sin que nadie haya
  // preguntado" es precisamente lo que este umbral mide.
  const memoriesWithRealSignal = options.currentMessage
    ? relevantMemories
    : relevantMemories.filter(
        (memory) => (memory.rank?.score ?? 0) >= MIN_SCORE_WITH_UNDERSTANDING_SIGNAL,
      );

  // Mismo criterio que arriba, aplicado al Knowledge Engine
  // (2026-07-25, docs/engineering/FIRST_MESSAGE_IDENTITY_PLAN.md):
  // solo insights ya validados por `DeterministicInsightValidationStrategy`
  // — "proposed"/"rejected" no aportan continuidad real todavía. Sin
  // ninguno validado, `items` queda vacío a propósito, mismo criterio
  // de "la ausencia real se representa como ausencia" que ya rige
  // `memory` arriba. Orden por confianza (nunca por recencia sola: una
  // relación de alta confianza no debe perder prioridad frente a un
  // hallazgo reciente pero débil), empatando por más reciente.
  const validatedInsights = insights
    .filter((insight) => insight.status === "validated")
    .sort((a, b) => {
      const confidenceDelta = b.confidence.score - a.confidence.score;
      return confidenceDelta !== 0
        ? confidenceDelta
        : b.updatedAt.getTime() - a.updatedAt.getTime();
    })
    .slice(0, RELEVANT_INSIGHT_LIMIT);

  // "Inteligencia desperdiciada" #1 (ver `describeInsightConsistency`):
  // como máximo `RELEVANT_INSIGHT_LIMIT` (3) llamadas, mismo costo por
  // insight que `/memories` ya paga hoy para una lista más larga (5).
  // `explainInsight` devuelve `null` solo si el insight no existe o
  // dejó de estar validado entre la consulta de arriba y esta -- se
  // trata igual que "sin consistencia calculable", nunca un error.
  const insightExplanations = await Promise.all(
    validatedInsights.map((insight) => explainInsight(db, context, insight.id)),
  );
  const consistencyByInsightId = new Map<string, string>();
  for (const explanation of insightExplanations) {
    if (!explanation) continue;
    const consistency = describeInsightConsistency(explanation);
    if (consistency) {
      consistencyByInsightId.set(explanation.id, consistency);
    }
  }

  // Mismo criterio que `validatedInsights`: solo conclusiones ya
  // `validated` (nunca `invalidated`), ordenadas por confianza y
  // desempatando por más reciente -- una conclusión de razonamiento
  // fuerte no debe perder prioridad frente a una más nueva pero más
  // débil.
  const validatedReasoningConclusions = reasoningConclusions
    .filter((conclusion) => conclusion.status === "validated")
    .sort((a, b) => {
      const confidenceDelta = b.confidence.score - a.confidence.score;
      return confidenceDelta !== 0
        ? confidenceDelta
        : b.updatedAt.getTime() - a.updatedAt.getTime();
    })
    .slice(0, RELEVANT_REASONING_LIMIT);

  // Contradiction Engine -- solo tensiones todavía sin resolver
  // (`"open"`/`"acknowledged"`, nunca `"resolved"`/`"dismissed"`),
  // mismo filtro que ya usan `app/life/[kind]/[id]/page.tsx` y
  // `build-identity-model.ts`. La más reciente primero: si hay más de
  // una abierta, la que LUZ detectó ahora mismo es más relevante para
  // esta conversación que una que lleva semanas sin resolverse.
  const openContradictions = contradictions
    .filter((item) => item.status === "open" || item.status === "acknowledged")
    .sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime())
    .slice(0, RELEVANT_CONTRADICTION_LIMIT);

  // Fast User Understanding -- reutiliza el mismo `beliefs` ya
  // obtenido arriba (para knowledgeGaps), nunca una segunda consulta.
  // Comunicación: solo `category: "communication_style"`, activas,
  // ordenadas por confianza -- las facetas más sólidas primero si hay
  // más de `RELEVANT_COMMUNICATION_PREFERENCE_LIMIT`.
  const communicationPreferences = beliefs
    .filter((belief) => belief.category === "communication_style" && belief.status === "active")
    .sort((a, b) => b.confidence.score - a.confidence.score)
    .slice(0, RELEVANT_COMMUNICATION_PREFERENCE_LIMIT);

  // Hipótesis en formación (cualquier categoría) -- la más reciente en
  // reforzarse primero, como proxy real de "sigue vigente en la vida
  // de la persona ahora mismo" (no hay ranking de Context Engine
  // todavía en este punto del ensamblador).
  const growingBeliefs = beliefs
    .filter(
      (belief) =>
        belief.status === "active" &&
        belief.confidence.score >= GROWING_BELIEF_MIN_CONFIDENCE &&
        belief.confidence.score <= GROWING_BELIEF_MAX_CONFIDENCE,
    )
    .sort((a, b) => b.lastReinforcedAt.getTime() - a.lastReinforcedAt.getTime())
    .slice(0, RELEVANT_GROWING_BELIEF_LIMIT);

  // Identity Evolution real, hecha audible -- `identitySnapshot.deemphasized`
  // ya es exactamente "cosas que ya no deberían dominar la conversación"
  // (dimensiones/temas históricamente fuertes ahora `dormant`/`declining`),
  // computado con memoria de largo plazo real (`lookbackDays`), no un
  // simple chequeo de estado de una sola creencia. `RELEVANT_FADING_BELIEF_LIMIT`
  // se mantiene (1) -- mismo criterio de "un capítulo cerrado a la vez".
  const fadingIdentityUnits = identitySnapshot.deemphasized.slice(
    0,
    RELEVANT_FADING_BELIEF_LIMIT,
  );

  // Reapertura (redesign del pipeline conversacional, Beta) -- memorias
  // tipo "intention" todavía sin seguimiento, filtradas contra
  // `seen_prompts` en esta misma capa de aplicación (nunca dentro de
  // la regla -- mismo criterio que el resto de este ensamblador). Más
  // reciente primero.
  const reopenCandidates = activeMemories
    .filter((memory) => memory.type === "intention" && !seenIntentionIds.has(memory.id))
    .sort((a, b) => (b.occurredAt?.getTime() ?? 0) - (a.occurredAt?.getTime() ?? 0))
    .slice(0, RELEVANT_REOPEN_CANDIDATE_LIMIT);

  // Cierres reales (redesign del pipeline conversacional, Beta) --
  // Goal/Project completados dentro de la ventana de recencia,
  // filtrados contra `seen_prompts`. Un Goal y un Project compiten por
  // el mismo espacio -- el más recientemente completado gana, sin
  // preferencia estructural por tipo.
  const recentClosures = [
    ...recentlyCompletedGoals
      .filter((goal) => !seenClosureIds.has(goal.id))
      .map((goal) => ({
        id: goal.id,
        title: goal.title,
        kind: "goal" as const,
        updatedAt: goal.updatedAt,
      })),
    ...recentlyCompletedProjects
      .filter((project) => !seenClosureIds.has(project.id))
      .map((project) => ({
        id: project.id,
        title: project.title,
        kind: "project" as const,
        updatedAt: project.updatedAt,
      })),
  ]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, RELEVANT_CLOSURE_LIMIT);

  // Knowledge Gaps (Knowledge Engine V2) -- cuenta señales reales por
  // dominio, nunca inventa una para un dominio sin actividad todavía
  // (`rankKnowledgeGaps` ya representa eso como coverage 0). Beliefs
  // activos únicamente: uno expirado/retractado ya no cuenta como
  // comprensión vigente de esa área.
  const signalsByDomain: Partial<Record<LifeDomainType, DomainCoverageSignals>> = {};
  const bump = (
    domain: LifeDomainType | undefined,
    field: keyof DomainCoverageSignals,
  ): void => {
    if (!domain) return;
    const current = signalsByDomain[domain] ?? {
      goalsCount: 0,
      projectsCount: 0,
      habitsCount: 0,
      beliefsCount: 0,
      conceptsCount: 0,
    };
    current[field] += 1;
    signalsByDomain[domain] = current;
  };
  for (const goal of activeGoals) bump(goal.domain, "goalsCount");
  for (const project of activeProjects) bump(project.domain, "projectsCount");
  for (const habit of activeHabits) bump(habit.domain, "habitsCount");
  for (const belief of beliefs) {
    if (belief.status === "active") bump(belief.domain, "beliefsCount");
  }
  for (const concept of concepts) bump(concept.domain, "conceptsCount");

  // Prioridad 1 (Identidad, `METADATA_INVENTORY_V1.md`): `concepts` ya
  // se consultaba en este ensamblador (arriba, para `knowledgeGaps`) --
  // cero consultas nuevas, solo un recorte que antes no existía. Orden
  // por `updatedAt` -- un concepto se actualiza (`core/concept-graph`)
  // cada vez que aparece evidencia nueva, así que lo más reciente es un
  // proxy real de "sigue vigente", mismo criterio que ya usa
  // `growingBeliefs` unas líneas más arriba en este mismo archivo.
  const topConcepts = [...concepts]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .slice(0, RELEVANT_CONCEPT_LIMIT);

  return {
    lifeGraphId: context.lifeGraphId,
    capturedAt: new Date(),
    // Persistencia real de Nivel 1 (Goal/Project/Habit) — `core/life`
    // ya tiene repositorios Drizzle para las tres. Si de verdad no hay
    // ninguna activa, los arreglos siguen vacíos — la ausencia real
    // sigue representándose como ausencia (REALITY_SNAPSHOT_V1.md:
    // "absence must be represented as absence"), ya no por un límite
    // de la implementación.
    life: {
      activeGoals: activeGoals.map((goal) => toLifeStateItem(goal, goal.targetDate)),
      activeProjects: activeProjects.map((project) =>
        toLifeStateItem(project, project.dueDate),
      ),
      activeHabits: activeHabits.map((habit) => toLifeStateItem(habit)),
    },
    // Retrieval estructurado (ADR-0004), ordenado por rank — la mitad
    // semántica (PR-020) no existe todavía. "Relevante" hoy significa
    // "lo más valioso ya capturado", no "lo más similar a este mensaje".
    // Sin memorias con señal real de comprensión, `items` queda vacío
    // a propósito — nunca se rellena con lo mejor disponible aunque no
    // alcance la barra: forzar continuidad sobre algo superficial no es
    // continuidad real (ver FavorPrioritizedContextRule y
    // build-morning-brief.ts, los dos consumidores de este snapshot).
    memory: {
      items: memoriesWithRealSignal.map((memory) => ({
        id: memory.id,
        content: memory.content,
        occurredAt: memory.occurredAt,
      })),
    },
    // Conocimiento derivado a través del tiempo, no de un solo mensaje
    // (Knowledge Engine, desplegado 2026-07-25) — "qué significa",
    // distinto de `memory` ("qué pasó").
    insights: {
      // "Inteligencia desperdiciada" #1: la consistencia real
      // (`consistencyByInsightId`, calculada arriba) se añade al mismo
      // `description` que siempre existió -- `RealitySnapshot.insights.items[].description`
      // sigue siendo `string`, sin ningún campo nuevo ni cambio de
      // contrato, solo un valor más completo cuando hay evidencia real
      // detrás.
      items: validatedInsights.map((insight) => {
        const consistency = consistencyByInsightId.get(insight.id);
        return {
          id: insight.id,
          description: consistency
            ? `${insight.description} (${consistency})`
            : insight.description,
          type: insight.type,
        };
      }),
    },
    // Calendar Foundation + Wearable Foundation (`features/reality/`)
    // llenan los puntos de extensión que este campo ya reservaba
    // (`external-signal-snapshot.ts`: "calendar"/"sensor" como fuentes
    // esperadas) -- document/email siguen vacíos indefinidamente
    // (ADR-0015, sin Connectors implementados todavía). Sin calendario
    // conectado o sin datos de reloj importados, cada
    // `get*SignalsForConversation` ya devuelve `[]` -- mismo criterio
    // de ausencia real que el resto de este ensamblador.
    signals: { signals: [...calendarSignals, ...wearableSignals] },
    knowledgeGaps: { domains: rankKnowledgeGaps(signalsByDomain) },
    // Comprensión de segundo orden (Knowledge Engine V2, Reasoning
    // Engine) -- síntesis ya validada sobre varios insights a la vez,
    // no una interpretación puntual más. Sin ninguna conclusión
    // validada todavía, `items` queda vacío a propósito, mismo
    // criterio de ausencia real que el resto de este ensamblador.
    reasoning: {
      items: validatedReasoningConclusions.map((conclusion) => ({
        id: conclusion.id,
        statement: conclusion.statement,
        confidenceScore: conclusion.confidence.score,
      })),
    },
    // Curiosidad genuina (Curiosity Engine) -- una pregunta concreta ya
    // pensada, no una instrucción vaga que el LLM improvisa cada vez
    // (ver CuriosityStrategyRule). Sin ninguna pendiente, `null` a
    // propósito -- mismo criterio de ausencia real que el resto de este
    // ensamblador.
    curiosity: {
      pendingQuestion: pendingCuriosityQuestion
        ? {
            id: pendingCuriosityQuestion.id,
            domain: pendingCuriosityQuestion.domain,
            question: pendingCuriosityQuestion.question,
          }
        : null,
    },
    // Tensión real ya detectada (Contradiction Engine, corre dentro de
    // `enrichKnowledgeGraph` después de cada memoria) -- hasta ahora
    // solo visible en `/life`, nunca disponible para la conversación en
    // vivo. Sin ninguna abierta, `items` queda vacío a propósito, mismo
    // criterio de ausencia real que el resto de este ensamblador.
    contradictions: {
      items: openContradictions.map((item) => ({
        id: item.id,
        description: item.description,
        domain: item.domain,
      })),
    },
    // Cómo prefiere esta persona que LUZ le hable (Fast User
    // Understanding) -- creencias reales, nunca inventadas, sobre
    // registro/extensión/nivel técnico preferido. Sin ninguna, `items`
    // queda vacío a propósito, mismo criterio de ausencia real que el
    // resto de este ensamblador.
    communicationStyle: {
      items: communicationPreferences.map((belief) => ({
        statement: belief.statement,
        confidence: belief.confidence.score,
      })),
    },
    // Una hipótesis sobre la persona todavía en formación (Fast User
    // Understanding) -- candidata a confirmarse de forma orgánica
    // (`ConfirmStrategyRule`), nunca a asumirse como hecho. Sin
    // ninguna en la banda de confianza real, `items` queda vacío.
    growingBeliefs: {
      items: growingBeliefs.map((belief) => ({
        id: belief.id,
        statement: belief.statement,
        confidence: belief.confidence.score,
      })),
    },
    // Identity Evolution real (`features/identity-evolution`) -- la
    // dimensión/tema que ya no debería dominar la conversación. Sin
    // ninguno por encima del umbral de presencia real todavía, `items`
    // queda vacío a propósito, mismo criterio de ausencia real que el
    // resto de este ensamblador.
    fadingBeliefs: {
      items: fadingIdentityUnits.map((unit) => ({
        statement: unit.label,
        domain: unit.unitKind === "dimension" ? (unit.key as LifeDomainType) : undefined,
        confidence: unit.weight,
      })),
    },
    // Continuidad al reabrir -- una intención sin resolver, si hay una
    // que todavía no se retomó. Sin ninguna, `items` queda vacío a
    // propósito, mismo criterio de ausencia real que el resto de este
    // ensamblador.
    reopenCandidates: {
      items: reopenCandidates.map((memory) => ({
        id: memory.id,
        statement: memory.content,
      })),
    },
    // Un cierre real todavía sin reconocer, si hay uno. Sin ninguno,
    // `items` queda vacío a propósito, mismo criterio de ausencia real
    // que el resto de este ensamblador.
    closures: {
      items: recentClosures.map((closure) => ({
        id: closure.id,
        title: closure.title,
        kind: closure.kind,
      })),
    },
    concepts: {
      items: topConcepts.map((concept) => ({
        id: concept.id,
        label: concept.label,
        domain: concept.domain,
      })),
    },
  };
}
