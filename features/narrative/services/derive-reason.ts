import type { NarrativeProgression } from "../domain/narrative-progression";
import type { NarrativeReason } from "../domain/narrative-reason";

/**
 * Hechos deterministas de entrada -- cada campo corresponde 1:1 a una
 * condición real ya evaluada por quien llama (`build-threads-from-loops.ts`/
 * `build-moments.ts`), nunca calculada aquí. Esta función solo decide EL
 * ORDEN, nunca los hechos en sí.
 */
export interface NarrativeReasonFacts {
  readonly isMilestoneToday: boolean;
  readonly isCelebration: boolean;
  readonly isFollowUpDue: boolean;
  readonly isImportantMeetingUpcoming: boolean;
  readonly isApproachingDeadline: boolean;
  readonly isUnreadImportantEmail: boolean;
  readonly isAwaitingReply: boolean;
  readonly isFadingWithoutEvidence: boolean;
  readonly chapterStage: NarrativeProgression | null;
  readonly isLongRunningOpen: boolean;
  readonly isWaiting: boolean;
}

/**
 * Orden fijo de más a menos específico -- mismo criterio que
 * `TYPE_SEVERITY` (`build-follow-up-recommendations.ts`) o
 * `deriveCategory` (`features/continuity/integrations/to-experience-card.ts`):
 * cuando varias condiciones son ciertas a la vez, gana la más
 * específica, nunca se combinan dos motivos en uno. `continuing_open_story`
 * es el único que no exige ninguna condición -- motivo por defecto,
 * nunca un vacío.
 */
export function deriveReason(facts: NarrativeReasonFacts): NarrativeReason {
  if (facts.isMilestoneToday) return "milestone_today";
  if (facts.isCelebration) return "celebration_moment";
  if (facts.isFollowUpDue) return "follow_up_due";
  if (facts.isImportantMeetingUpcoming) return "important_meeting_upcoming";
  if (facts.isApproachingDeadline) return "approaching_deadline";
  if (facts.isUnreadImportantEmail) return "unread_important_email";
  if (facts.isAwaitingReply) return "awaiting_reply";
  if (facts.isFadingWithoutEvidence) return "fading_without_evidence";
  if (facts.chapterStage === "resolution") return "recently_resolved";
  if (facts.chapterStage === "reflection") return "worth_reflecting_on";
  if (facts.isLongRunningOpen) return "long_running_unresolved";
  if (facts.isWaiting) return "waiting_quietly";
  return "continuing_open_story";
}
