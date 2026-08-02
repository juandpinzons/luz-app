import type { ContinuityLoop } from "../../../core/continuity-engine";
import type { RealitySnapshot } from "../../../core/reality";
import type {
  FollowUpRecommendation,
} from "../../dashboard/services/build-follow-up-recommendations";
import type { LifeDashboardSnapshot } from "../../dashboard/services/build-life-dashboard-snapshot";
import type { ExperienceState } from "../../experience/domain/experience-state";
import type { HomeState } from "../../home/domain/home-state";
import type { CalendarSnapshot, EmailSnapshot } from "../../reality/domain";
import type { NarrativeState } from "../domain/narrative-state";
import { buildArcs } from "../services/build-arcs";
import { buildCelebrationCandidates } from "../services/build-celebration-candidates";
import { buildContinuation } from "../services/build-continuation";
import { buildMoments } from "../services/build-moments";
import { buildThreadsFromLoops } from "../services/build-threads-from-loops";
import { categorizeThreads } from "../services/categorize-threads";
import { selectPrimaryNarrative } from "../services/select-primary-narrative";

export interface BuildNarrativeStateInput {
  /** Por defecto, `homeState.asOf` -- mismo instante que ya ancla `HomeState`/`ExperienceState`. Aceptado aparte solo para escenarios sintéticos que quieran fijar un reloj distinto. */
  readonly now?: Date;
  /**
   * Ya incluye todo lo que `PresenceState` decidió (passthrough exacto,
   * ver `features/home/README.md`) -- Narrative no recibe `PresenceState`
   * aparte, mismo criterio que `buildExperienceState` ya aplica.
   */
  readonly homeState: HomeState;
  /** `whatChanged` ya resuelve "Recent Changes" -- ver `NarrativeState.recentChanges`. */
  readonly experienceState: ExperienceState;
  /**
   * Ventana COMPLETA de loops -- pasados (resueltos/archivados/
   * abandonados) Y presentes, no solo los actualmente abiertos. `NarrativeArc`
   * (`services/build-arcs.ts`) necesita ver meses atrás para conectar
   * capítulos de un mismo asunto real ("connect events months apart") --
   * pasar solo loops abiertos degradaría cada arco a un único capítulo,
   * perdiendo recuperación (Principio 7) y ecos temporales (Principio 8)
   * en silencio, sin ningún error visible.
   */
  readonly loops: readonly ContinuityLoop[];
  /** Lista COMPLETA, sin recortar -- a diferencia de `homeState.attentionNeeded`/`recentProgress.items`, que Presence ya acotó a 2-3 por sección. */
  readonly recommendations: readonly FollowUpRecommendation[];
  /** Solo se usa `overdue` -- el único campo que `HomeState` no expone (ver `services/build-moments.ts`). */
  readonly lifeDashboardSnapshot: LifeDashboardSnapshot;
  readonly calendar: CalendarSnapshot | null;
  readonly email: EmailSnapshot | null;
  /**
   * `NarrativeThread.id` de los capítulos ya narrados en visitas
   * recientes, más reciente primero -- mismo rol que
   * `recentPrimaryKeys` en `buildExperienceState`
   * (`features/experience/`), consumido de la misma forma no invasiva:
   * un parámetro opcional, sin que Narrative posea ninguna tabla nueva.
   * Alimenta el silencio por repetición (Principio 3/9, ver
   * `services/select-primary-narrative.ts`). `[]` por defecto -- sin
   * historial, nada se silencia por repetición todavía.
   */
  readonly recentlyNarratedThreadIds?: readonly string[];
  /**
   * Aceptado por completitud de la misión ("Reality Snapshot" es una de
   * las nueve fuentes permitidas) pero NO se usa hoy más allá de aceptar
   * el parámetro -- ver `README.md`, "Por qué Reality Snapshot no se
   * usa a fondo": sus campos ricos (`contradictions`/`curiosity`/`life`)
   * ya están representados, de forma más completa, a través de
   * `ContinuityLoop`/`LifeDashboardSnapshot` -- minarlos aparte
   * arriesgaría exactamente la "lógica de ranking duplicada" que el
   * resto del repo (Home/Experience/Presence) ya advierte evitar.
   */
  readonly realitySnapshot?: RealitySnapshot | null;
}

/**
 * Punto de entrada público de "Living Narrative Foundation". Consume
 * SOLO contratos públicos ya calculados por otros módulos -- nunca un
 * repositorio, nunca IA, nunca aleatoriedad. Determinístico de punta a
 * punta: mismas entradas siempre producen el mismo `NarrativeState`.
 */
export function buildNarrativeState(input: BuildNarrativeStateInput): NarrativeState {
  const now = input.now ?? input.homeState.asOf;

  const threads = buildThreadsFromLoops({
    loops: input.loops,
    now,
    homeState: input.homeState,
    calendar: input.calendar,
  });

  const moments = buildMoments({
    now,
    loops: input.loops,
    homeState: input.homeState,
    recommendations: input.recommendations,
    overdue: input.lifeDashboardSnapshot.overdue,
    email: input.email,
  });

  const arcs = buildArcs(threads, now);
  const { primary: currentActiveStory, silenced: silencedCandidate } = selectPrimaryNarrative(
    arcs,
    input.recentlyNarratedThreadIds ?? [],
  );
  const categorized = categorizeThreads(threads);
  const celebrationCandidates = buildCelebrationCandidates(threads, moments);
  const recurringArcs = arcs.filter((arc) => arc.chapters.length >= 2);
  const dormantArcs = arcs.filter((arc) => arc.state === "dormant");

  return {
    asOf: now,
    currentActiveStory,
    silencedCandidate,
    continuation: buildContinuation(currentActiveStory),
    recentChanges: input.experienceState.whatChanged,
    celebrationCandidates,
    ...categorized,
    recurringArcs,
    dormantArcs,
  };
}
