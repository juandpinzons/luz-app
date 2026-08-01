import {
  isTerminalLoopState,
  MAX_FOLLOW_UP_ATTEMPTS,
  MAX_LOOP_AGE_DAYS,
  type ContinuityLoop,
  type LoopPriority,
} from "../../../core/continuity-engine";
import { STALLED_THRESHOLD_DAYS } from "../../dashboard/services/build-life-dashboard-snapshot";
import type { HomeState } from "../../home/domain/home-state";
import type { CalendarSnapshot } from "../../reality/domain";
import type { NarrativeChapter } from "../domain/narrative-progression";
import type { NarrativeThread } from "../domain/narrative-thread";
import { deriveReason } from "./derive-reason";
import {
  buildAttentionEntityKeys,
  findCorrelatedCalendarEvent,
  hoursUntilEventStart,
  relatedEntityKey,
} from "./entity-correlation";
import { computeNarrativeScore, derivePriorityFromScore, FRESHNESS_WINDOW_DAYS } from "./narrative-score";
import { daysBetween, hoursBetween } from "./time-math";

/** Un loop `open` detectado hace menos de esto sigue "comenzando" -- no ha pasado tiempo suficiente para ser otra cosa. */
export const BEGINNING_WINDOW_DAYS = 3;
/** Un loop `resolved` cerrado hace menos de esto sigue siendo noticia fresca -- mismo umbral que `BEGINNING_WINDOW_DAYS`, por simetría: un desenlace es "nuevo" durante el mismo tiempo que una historia es "nueva". */
export const RESOLUTION_FRESH_DAYS = 3;
/** Cualquier estado terminal cerrado hace menos de esto todavía vale la pena reflexionar -- mismo horizonte que `UPCOMING_WINDOW_DAYS` (`build-life-dashboard-snapshot.ts`), consistente con "cuánto hacia adelante/atrás vale la pena mirar" en el resto del repo. */
export const REFLECTION_WINDOW_DAYS = 14;
/** Reusa el umbral YA establecido para "estancado" en todo el repo (`STALLED_THRESHOLD_DAYS`, `features/dashboard/`) -- una historia sin resolverse el mismo tiempo que un Goal/Project/Habit cuenta como "estancado" en Dashboard es, por el mismo criterio, una historia de largo aliento. Nunca un número nuevo redefinido aquí. */
export const LONG_RUNNING_THRESHOLD_DAYS = STALLED_THRESHOLD_DAYS;

/** Cuántos intentos de seguimiento antes del propio límite de `detectTimeoutExceeded` (`core/continuity-engine`) ya cuentan como aviso -- un intento de margen: la última oportunidad real antes de que el sistema archive por timeout. */
const FORGOTTEN_ATTEMPTS_MARGIN = 1;
/** Cuántos días antes del propio límite de edad de `detectTimeoutExceeded` ya cuentan como aviso. */
const FORGOTTEN_AGE_MARGIN_DAYS = 15;

const IMPORTANCE_BY_PRIORITY: Readonly<Record<LoopPriority, number>> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/** Peso fijo por categoría YA clasificada por Continuity (`LoopReason`) -- nunca una lectura de contenido real ni una afirmación sobre cómo se siente la persona. Ver la nota completa en `narrative-score.ts`. */
const HIGH_EMOTIONAL_WEIGHT_REASONS = new Set(["relationship_milestone", "significant_life_event"]);

/**
 * `ContinuityLoop` -> `NarrativeChapter` -- deriva EXCLUSIVAMENTE de
 * `loop.state` + sus timestamps, nunca de contenido. Ver el docblock de
 * `NarrativeProgression` (`domain/narrative-progression.ts`) para la
 * tabla completa de reglas.
 */
function deriveChapter(loop: ContinuityLoop, now: Date): NarrativeChapter {
  if (isTerminalLoopState(loop.state)) {
    const closedAt = loop.resolution?.resolvedAt ?? loop.updatedAt;
    const closedDaysAgo = daysBetween(closedAt, now);

    if (loop.state === "resolved" && closedDaysAgo < RESOLUTION_FRESH_DAYS) {
      return { stage: "resolution", since: closedAt };
    }
    if (closedDaysAgo < REFLECTION_WINDOW_DAYS) {
      return { stage: "reflection", since: closedAt };
    }
    return { stage: "archived", since: closedAt };
  }

  if (loop.state === "waiting") {
    return { stage: "waiting", since: loop.updatedAt };
  }
  if (loop.state === "follow_up") {
    return { stage: "turning_point", since: loop.updatedAt };
  }

  // loop.state === "open" -- único estado inicial, ver `LOOP_STATES`.
  const ageDays = daysBetween(loop.createdAt, now);
  return ageDays < BEGINNING_WINDOW_DAYS
    ? { stage: "beginning", since: loop.createdAt }
    : { stage: "developing", since: loop.createdAt };
}

export interface BuildThreadsFromLoopsInput {
  readonly loops: readonly ContinuityLoop[];
  readonly now: Date;
  /** Para la señal "user attention" del ranking -- ver `buildAttentionEntityKeys`. */
  readonly homeState: HomeState;
  /** Para correlacionar loops de origen `calendar` con su evento real -- señal "calendar proximity". `null` cuando la persona nunca conectó un calendario. */
  readonly calendar: CalendarSnapshot | null;
}

/**
 * `ContinuityLoop[]` -> `NarrativeThread[]` -- un thread por loop, SIEMPRE
 * (`Never duplicate Memory`: un thread nunca es más que una traducción de
 * vocabulario sobre el mismo loop real). Los loops terminales se
 * proyectan igual que los abiertos, nunca se filtran ni se reinterpretan
 * -- solo terminan en capítulo `resolution`/`reflection`/`archived`
 * (`Never reopen closed Continuity Loops`: Narrative nunca actúa sobre un
 * loop cerrado, solo lo describe). Determinístico de punta a punta:
 * mismas entradas siempre producen los mismos threads.
 */
export function buildThreadsFromLoops(input: BuildThreadsFromLoopsInput): NarrativeThread[] {
  const attentionKeys = buildAttentionEntityKeys(input.homeState);

  return input.loops.map((loop) => {
    const chapter = deriveChapter(loop, input.now);
    const terminal = isTerminalLoopState(loop.state);
    const ageDays = daysBetween(loop.createdAt, input.now);

    const isCelebration = loop.state === "resolved" && loop.resolution?.outcome?.kind === "positive";
    const isLongRunningOpen = !terminal && ageDays >= LONG_RUNNING_THRESHOLD_DAYS;
    const isFadingWithoutEvidence =
      !terminal &&
      (loop.followUpAttempts >= MAX_FOLLOW_UP_ATTEMPTS - FORGOTTEN_ATTEMPTS_MARGIN ||
        ageDays >= MAX_LOOP_AGE_DAYS - FORGOTTEN_AGE_MARGIN_DAYS);

    // Ancla real más cercana: el evento de calendario correlacionado (por `trigger.sourceId`, ver `entity-correlation.ts`), o si no existe, el propio `nextFollowUpAt` que Continuity ya programó -- ambos son "un momento real y fechado", nunca una estimación nueva. Ventana ±48h (`CALENDAR_PROXIMITY_WINDOW_HOURS`, `narrative-score.ts`): un evento que acaba de pasar es tan narrativamente próximo como uno por venir.
    const correlatedEvent =
      loop.trigger.origin === "calendar"
        ? findCorrelatedCalendarEvent(input.calendar, loop.trigger.sourceId)
        : null;
    const calendarProximityHours = correlatedEvent
      ? hoursUntilEventStart(correlatedEvent, input.now)
      : loop.nextFollowUpAt
        ? hoursBetween(input.now, loop.nextFollowUpAt)
        : null;

    const reason = deriveReason({
      isMilestoneToday:
        !terminal && loop.trigger.reason === "relationship_milestone" && ageDays < BEGINNING_WINDOW_DAYS,
      isCelebration,
      isFollowUpDue: chapter.stage === "turning_point",
      isImportantMeetingUpcoming: !terminal && loop.trigger.reason === "important_meeting",
      isApproachingDeadline:
        !terminal && (loop.trigger.reason === "deadline" || loop.trigger.reason === "future_commitment"),
      isUnreadImportantEmail: !terminal && loop.trigger.reason === "unread_important_email",
      isAwaitingReply: !terminal && loop.trigger.reason === "awaiting_my_reply",
      isFadingWithoutEvidence,
      chapterStage: chapter.stage,
      isLongRunningOpen,
      isWaiting: chapter.stage === "waiting",
    });

    const score = computeNarrativeScore({
      basePoints: IMPORTANCE_BY_PRIORITY[loop.priority],
      isFresh: daysBetween(chapter.since, input.now) < FRESHNESS_WINDOW_DAYS,
      isContinuingStory: loop.followUpAttempts >= 1,
      isFollowUpDue: chapter.stage === "turning_point",
      calendarProximityHours,
      hasFixedEmotionalWeight: HIGH_EMOTIONAL_WEIGHT_REASONS.has(loop.trigger.reason),
      hasUserAttention: loop.relatedEntities.some((entity) => attentionKeys.has(relatedEntityKey(entity))),
      isLongRunningOpen,
      isCelebration,
    });

    const thread: NarrativeThread = {
      id: loop.id,
      title: loop.title,
      summary: loop.trigger.summary,
      origin: loop.trigger.origin,
      chapter,
      priority: derivePriorityFromScore(score),
      reason,
      score,
      ageDays,
      isLongRunning: isLongRunningOpen,
      isFadingWithoutEvidence,
      relatedEntities: loop.relatedEntities,
    };
    return thread;
  });
}
