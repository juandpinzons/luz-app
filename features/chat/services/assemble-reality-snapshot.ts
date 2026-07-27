import type { Database } from "../../../core/db/client";
import { DrizzleBeliefRepository } from "../../../core/belief-engine";
import { DrizzleConceptRepository } from "../../../core/concept-graph";
import {
  listActiveGoals,
  listActiveHabits,
  listActiveProjects,
  type EntityId,
  type LifeDomainType,
  type LifeGraphContext,
} from "../../../core/life";
import { rankKnowledgeGaps, type DomainCoverageSignals } from "../../../core/knowledge-gaps";
import { createMemoryEngine } from "../../../core/memory-engine";
import { DrizzleMemoryRepository } from "../../../core/memory-engine";
import { MIN_SCORE_WITH_UNDERSTANDING_SIGNAL } from "../../../core/memory-engine/ranking/deterministic-memory-ranking-strategy";
import { DrizzleInsightRepository } from "../../../core/knowledge-engine";
import type { LifeStateItem, RealitySnapshot } from "../../../core/reality";
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
  const [
    candidateMemories,
    focusedMemory,
    activeGoals,
    activeProjects,
    activeHabits,
    insights,
    beliefs,
    concepts,
  ] = await Promise.all([
    options.currentMessage
      ? selectContextualMemories(
          db,
          context,
          options.currentMessage,
          RELEVANT_MEMORY_LIMIT,
        )
      : createMemoryEngine(db).retrieve(context, {
          limit: RELEVANT_MEMORY_LIMIT,
        }),
    options.focusMemoryId
      ? new DrizzleMemoryRepository(db).getById(context, options.focusMemoryId)
      : Promise.resolve(null),
    listActiveGoals(db, context),
    listActiveProjects(db, context),
    listActiveHabits(db, context),
    new DrizzleInsightRepository(db).list(context),
    new DrizzleBeliefRepository(db).list(context),
    new DrizzleConceptRepository(db).list(context),
  ]);

  const relevantMemories = focusedMemory
    ? [
        focusedMemory,
        ...candidateMemories.filter((memory) => memory.id !== focusedMemory.id),
      ].slice(0, RELEVANT_MEMORY_LIMIT)
    : candidateMemories;

  // Auditoría de comportamiento (Presence Principles): dar continuidad
  // a partir de un dato solo porque existe, sin que represente
  // comprensión real, ya se identificó como el hallazgo transversal de
  // esa revisión. `retrieve()` ordena por rank descendente, así que
  // filtrar aquí nunca esconde una memoria mejor que quedó fuera del
  // límite — la separación entre "tiene señal real" y "no la tiene" es
  // más grande (26 puntos) que cualquier bono de recencia (máx. 4), o
  // sea que el orden ya garantiza que lo que califica siempre aparece
  // antes que lo que no. `rank` viene indefinido solo si `retrieve()`
  // alguna vez devolviera una memoria sin rankear — no debería ocurrir
  // (Capture → Rank es síncrono), pero se trata igual que "no califica"
  // en vez de asumir que sí, por prudencia.
  const memoriesWithRealSignal = relevantMemories.filter(
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
      items: validatedInsights.map((insight) => ({
        id: insight.id,
        description: insight.description,
        type: insight.type,
      })),
    },
    // Sin Connectors implementados todavía (ADR-0015) — vacío,
    // indefinidamente, tal como ADR-0013 ya esperaba.
    signals: { signals: [] },
    knowledgeGaps: { domains: rankKnowledgeGaps(signalsByDomain) },
  };
}
