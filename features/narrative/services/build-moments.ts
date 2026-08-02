import { isTerminalLoopState, type ContinuityLoop, type LoopOrigin } from "../../../core/continuity-engine";
import type { DueLifeItem } from "../../dashboard/services/build-life-dashboard-snapshot";
import type {
  DashboardEntityReference,
  FollowUpRecommendation,
  RecommendationPriority,
} from "../../dashboard/services/build-follow-up-recommendations";
import type { HomeMeetingMoment, HomeMeetingMomentKind, HomeState } from "../../home/domain/home-state";
import type { EmailImportance, EmailMessage, EmailSnapshot } from "../../reality/domain";
import type { NarrativeMoment } from "../domain/narrative-moment";
import type { NarrativeRelatedEntity } from "../domain/narrative-related-entity";
import { deriveReason } from "./derive-reason";
import { buildAttentionEntityKeys, hoursUntilEventStart, relatedEntityKey } from "./entity-correlation";
import { computeNarrativeScore, derivePriorityFromScore } from "./narrative-score";

/**
 * `DashboardEntityReference` -> `NarrativeRelatedEntity` -- mismo
 * criterio que `toLoopRelatedEntity` en
 * `features/continuity/detection/detect-from-recommendation.ts`: la
 * variante `"domain"` no trae `id`, así que el propio `LifeDomainType`
 * (p. ej. `"health"`) hace de identificador, nunca un id inventado.
 */
function toRelatedEntity(entity: DashboardEntityReference): NarrativeRelatedEntity {
  if (entity.kind === "domain") {
    return { kind: "domain", id: entity.domain, title: entity.title };
  }
  return entity;
}

/**
 * `true` cuando ya existe un `ContinuityLoop` NO terminal para esta
 * fuente exacta (`origin` + `sourceId`, la misma correlación exacta que
 * usan las propias reglas de apertura -- ver `detectFromRecommendation`/
 * `detectGoalDeadline`/`detectFromCalendarEvent`/`detectFromEmailSnapshot`,
 * todas guardan el id real de la fuente en `trigger.sourceId`). Cuando es
 * `true`, esa fuente ya tiene su `NarrativeThread` propio -- crear un
 * `NarrativeMoment` además sería mostrar el mismo hecho real dos veces
 * como si fueran independientes, exactamente la "lógica duplicada" que
 * el resto del repo (Home/Experience/Presence) ya advierte evitar.
 */
function isAlreadyThread(loops: readonly ContinuityLoop[], origin: LoopOrigin, sourceId: string): boolean {
  return loops.some(
    (loop) => loop.trigger.origin === origin && loop.trigger.sourceId === sourceId && !isTerminalLoopState(loop.state),
  );
}

const RECOMMENDATION_BASE_POINTS: Readonly<Record<RecommendationPriority, number>> = {
  low: 1,
  medium: 2,
  high: 3,
  critical: 4,
};

/** Mismos tres niveles que `MEETING_MOMENT_IMPORTANCE` (`features/experience/services/collect-candidates.ts`) -- reutilizados tal cual, nunca redefinidos con otro criterio, para el mismo concepto exacto. */
const MEETING_MOMENT_BASE_POINTS: Readonly<Record<HomeMeetingMomentKind, number>> = {
  in_progress: 4,
  starting_soon: 3,
  recently_ended: 1,
};

const EMAIL_IMPORTANCE_BASE_POINTS: Readonly<Record<EmailImportance, number>> = {
  high: 3,
  normal: 2,
  low: 1,
};

/** A partir de cuántos días vencido un `DueLifeItem` cuenta como "muy vencido" -- mismo umbral que `GOAL_DEADLINE_URGENT_DAYS`/`PROJECT_DEADLINE_URGENT_DAYS` (`core/continuity-engine/detection/`), reutilizado por consistencia con lo que Continuity ya considera "urgente". */
const VERY_OVERDUE_DAYS = 3;

function buildRecommendationMoment(recommendation: FollowUpRecommendation, attentionKeys: ReadonlySet<string>): NarrativeMoment {
  const isCelebration = recommendation.type === "CELEBRATE_PROGRESS";
  const isApproachingDeadline = recommendation.type === "COMPLETE_OVERDUE";
  const relatedEntities = recommendation.relatedEntities.map(toRelatedEntity);
  const hasUserAttention = relatedEntities.some((entity) => attentionKeys.has(relatedEntityKey(entity)));

  const score = computeNarrativeScore({
    basePoints: RECOMMENDATION_BASE_POINTS[recommendation.priority],
    isFresh: false,
    isContinuingStory: false,
    isFollowUpDue: false,
    calendarProximityHours: null,
    hasFixedEmotionalWeight: false,
    hasUserAttention,
    isLongRunningOpen: false,
    isCelebration,
  });

  return {
    key: `moment:recommendation:${recommendation.id}`,
    title: recommendation.title,
    detail: recommendation.explanation,
    priority: derivePriorityFromScore(score),
    reason: deriveReason({
      isMilestoneToday: false,
      isCelebration,
      isFollowUpDue: false,
      isImportantMeetingUpcoming: false,
      isApproachingDeadline,
      isUnreadImportantEmail: false,
      isAwaitingReply: false,
      isFadingWithoutEvidence: false,
      chapterStage: null,
      isLongRunningOpen: false,
      isWaiting: false,
    }),
    score,
    relatedEntities,
  };
}

/**
 * Recomendaciones sin thread propio -- `CELEBRATE_PROGRESS`/`NO_ACTION`
 * NUNCA generan loop (regla propia de Continuity, ver
 * `detectFromRecommendation`), así que siempre pasan; el resto solo pasa
 * cuando su `id` (== `LoopTrigger.sourceId` real para
 * `origin: "recommendation"`) todavía no tiene un thread no-terminal.
 */
function buildRecommendationMoments(
  recommendations: readonly FollowUpRecommendation[],
  loops: readonly ContinuityLoop[],
  attentionKeys: ReadonlySet<string>,
): NarrativeMoment[] {
  return recommendations
    .filter((recommendation) => recommendation.type !== "NO_ACTION")
    .filter(
      (recommendation) =>
        recommendation.type === "CELEBRATE_PROGRESS" || !isAlreadyThread(loops, "recommendation", recommendation.id),
    )
    .map((recommendation) => buildRecommendationMoment(recommendation, attentionKeys));
}

/**
 * `LifeDashboardSnapshot.overdue` -- la única fuente que da esta señal
 * (`HomeState` nunca expone vencidos, solo `upcoming`, ver
 * `features/home/domain/home-state.ts`). Correlaciona contra threads de
 * origen `goal`/`project` reason `deadline` -- si ya existe uno (el caso
 * más común: `detectGoalDeadline`/`detectProjectDeadline` ya lo abrió
 * antes de vencer), no se duplica; solo aparece como `NarrativeMoment`
 * cuando ningún loop real lo cubre todavía (p. ej. venció fuera de la
 * ventana de 14 días que esas reglas exigen).
 */
function buildOverdueMoments(
  overdue: readonly DueLifeItem[],
  loops: readonly ContinuityLoop[],
  attentionKeys: ReadonlySet<string>,
  now: Date,
): NarrativeMoment[] {
  return overdue
    .filter((item) => !isAlreadyThread(loops, item.kind, item.id))
    .map((item) => {
      const daysOverdue = Math.floor((now.getTime() - item.dueDate.getTime()) / (24 * 60 * 60 * 1000));
      const basePoints = daysOverdue >= VERY_OVERDUE_DAYS ? 3 : 2;
      const relatedEntities: NarrativeRelatedEntity[] = [{ kind: item.kind, id: item.id, title: item.title }];
      const hasUserAttention = relatedEntities.some((entity) => attentionKeys.has(relatedEntityKey(entity)));

      const score = computeNarrativeScore({
        basePoints,
        isFresh: false,
        isContinuingStory: false,
        isFollowUpDue: false,
        calendarProximityHours: null,
        hasFixedEmotionalWeight: false,
        hasUserAttention,
        isLongRunningOpen: false,
        isCelebration: false,
      });

      return {
        key: `moment:overdue:${item.kind}:${item.id}`,
        title: item.title,
        detail: `${item.kind === "goal" ? "Objetivo" : "Proyecto"} vencido hace ${daysOverdue} día(s).`,
        priority: derivePriorityFromScore(score),
        reason: deriveReason({
          isMilestoneToday: false,
          isCelebration: false,
          isFollowUpDue: false,
          isImportantMeetingUpcoming: false,
          isApproachingDeadline: true,
          isUnreadImportantEmail: false,
          isAwaitingReply: false,
          isFadingWithoutEvidence: false,
          chapterStage: null,
          isLongRunningOpen: false,
          isWaiting: false,
        }),
        score,
        relatedEntities,
      } satisfies NarrativeMoment;
    });
}

/**
 * `HomeState.calendar.meetingMoments` -- reusa la categorización que
 * `features/home/` YA calculó (`in_progress`/`starting_soon`/
 * `recently_ended`), nunca una segunda clasificación por umbral propia.
 * Correlaciona contra threads de origen `calendar` (`detectFromCalendarEvent`
 * solo abre loop para eventos FUTUROS -- un evento ya en curso o recién
 * terminado nunca tuvo la oportunidad de convertirse en thread, así que
 * casi siempre llega aquí como momento).
 */
function buildCalendarMoments(
  moments: readonly HomeMeetingMoment[],
  loops: readonly ContinuityLoop[],
  attentionKeys: ReadonlySet<string>,
  now: Date,
): NarrativeMoment[] {
  return moments
    .filter((moment) => !isAlreadyThread(loops, "calendar", moment.event.id))
    .map((moment) => {
      const relatedEntities = [{ kind: "calendar_event" as const, id: moment.event.id, title: moment.event.title }];
      const hasUserAttention = relatedEntities.some((entity) => attentionKeys.has(relatedEntityKey(entity)));
      const calendarProximityHours = hoursUntilEventStart(moment.event, now);

      const score = computeNarrativeScore({
        basePoints: MEETING_MOMENT_BASE_POINTS[moment.kind],
        isFresh: false,
        isContinuingStory: false,
        isFollowUpDue: false,
        calendarProximityHours,
        hasFixedEmotionalWeight: false,
        hasUserAttention,
        isLongRunningOpen: false,
        isCelebration: false,
      });

      return {
        key: `moment:calendar:${moment.event.id}`,
        title: moment.event.title,
        detail:
          moment.kind === "in_progress"
            ? "En curso ahora mismo."
            : moment.kind === "starting_soon"
              ? "Empieza pronto."
              : "Terminó hace poco.",
        priority: derivePriorityFromScore(score),
        reason: deriveReason({
          isMilestoneToday: false,
          isCelebration: false,
          isFollowUpDue: false,
          isImportantMeetingUpcoming: moment.kind !== "recently_ended",
          isApproachingDeadline: false,
          isUnreadImportantEmail: false,
          isAwaitingReply: false,
          isFadingWithoutEvidence: false,
          chapterStage: null,
          isLongRunningOpen: false,
          isWaiting: false,
        }),
        score,
        relatedEntities,
      } satisfies NarrativeMoment;
    });
}

function buildEmailMoment(
  message: EmailMessage,
  reasonKind: "awaiting_reply" | "unread_important_email",
): NarrativeMoment {
  const title = message.subject || message.sender.displayName || message.sender.email;
  const score = computeNarrativeScore({
    basePoints: EMAIL_IMPORTANCE_BASE_POINTS[message.importance],
    isFresh: false,
    isContinuingStory: false,
    isFollowUpDue: false,
    calendarProximityHours: null,
    hasFixedEmotionalWeight: false,
    hasUserAttention: false,
    isLongRunningOpen: false,
    isCelebration: false,
  });

  return {
    key: `moment:email:${message.id}`,
    title,
    detail: message.snippet,
    priority: derivePriorityFromScore(score),
    reason: deriveReason({
      isMilestoneToday: false,
      isCelebration: false,
      isFollowUpDue: false,
      isImportantMeetingUpcoming: false,
      isApproachingDeadline: false,
      isUnreadImportantEmail: reasonKind === "unread_important_email",
      isAwaitingReply: reasonKind === "awaiting_reply",
      isFadingWithoutEvidence: false,
      chapterStage: null,
      isLongRunningOpen: false,
      isWaiting: false,
    }),
    score,
    relatedEntities: [{ kind: "email_message", id: message.id, title }],
  };
}

/**
 * `EmailSnapshot.waitingReply`/`.important` -- mismo criterio de
 * "un mensaje en ambas listas cuenta una sola vez, como awaiting_reply"
 * que ya usa `detectFromEmailSnapshot`. Correlaciona contra threads de
 * origen `email`; normalmente casi todo mensaje elegible ya tiene un
 * loop (la regla de apertura no filtra por prioridad, a diferencia de
 * recomendaciones/deadlines), así que esto cubre sobre todo el caso en
 * que la sincronización de Continuity todavía no corrió sobre un mensaje
 * recién llegado -- nunca se asume que el loop store y el snapshot en
 * vivo están perfectamente sincronizados.
 */
function buildEmailMoments(email: EmailSnapshot | null, loops: readonly ContinuityLoop[]): NarrativeMoment[] {
  if (!email) return [];

  const moments: NarrativeMoment[] = [];
  const covered = new Set<string>();

  for (const message of email.waitingReply) {
    if (isAlreadyThread(loops, "email", message.id)) continue;
    moments.push(buildEmailMoment(message, "awaiting_reply"));
    covered.add(message.id);
  }
  for (const message of email.important) {
    if (covered.has(message.id) || !message.unread) continue;
    if (isAlreadyThread(loops, "email", message.id)) continue;
    moments.push(buildEmailMoment(message, "unread_important_email"));
  }

  return moments;
}

export interface BuildMomentsInput {
  readonly now: Date;
  readonly loops: readonly ContinuityLoop[];
  readonly homeState: HomeState;
  readonly recommendations: readonly FollowUpRecommendation[];
  readonly overdue: readonly DueLifeItem[];
  readonly email: EmailSnapshot | null;
}

/**
 * Todo lo que vale la pena notar HOY sin (todavía) tener su propio
 * `NarrativeThread` -- ver docblock de `NarrativeMoment`. Cada fuente se
 * correlaciona contra `loops` antes de producir un momento, para nunca
 * mostrar el mismo hecho real dos veces (`Never duplicate Memory`).
 * Determinístico: mismas entradas siempre producen los mismos momentos.
 */
export function buildMoments(input: BuildMomentsInput): NarrativeMoment[] {
  const attentionKeys = buildAttentionEntityKeys(input.homeState);

  return [
    ...buildRecommendationMoments(input.recommendations, input.loops, attentionKeys),
    ...buildOverdueMoments(input.overdue, input.loops, attentionKeys, input.now),
    ...buildCalendarMoments(input.homeState.calendar?.meetingMoments ?? [], input.loops, attentionKeys, input.now),
    ...buildEmailMoments(input.email, input.loops),
  ];
}
