import type { NarrativeContinuation, NarrativeContinuationKind } from "../domain/narrative-continuation";
import type { NarrativeReason } from "../domain/narrative-reason";
import type { NarrativeThread } from "../domain/narrative-thread";

/**
 * Lookup FIJO, 1:1, `NarrativeReason` -> `NarrativeContinuationKind` --
 * nunca una decisión nueva, la decisión real ya la tomó
 * `derive-reason.ts`. `recently_resolved` (que cubre CUALQUIER desenlace
 * terminal reciente, positivo, negativo o `unknown` -- ver
 * `build-threads-from-loops.ts`) mapea a `"reflect"`, nunca a
 * `"celebrate"`: solo `celebration_moment` (que exige
 * `LoopOutcome.kind === "positive"` real) puede celebrar; confundir los
 * dos habría felicitado un desenlace negativo o desconocido.
 */
const CONTINUATION_KIND_BY_REASON: Readonly<Record<NarrativeReason, NarrativeContinuationKind>> = {
  milestone_today: "celebrate",
  celebration_moment: "celebrate",
  follow_up_due: "check_in",
  important_meeting_upcoming: "prepare",
  approaching_deadline: "prepare",
  unread_important_email: "check_in",
  awaiting_reply: "check_in",
  fading_without_evidence: "release",
  recently_resolved: "reflect",
  worth_reflecting_on: "reflect",
  long_running_unresolved: "resume",
  waiting_quietly: "resume",
  continuing_open_story: "resume",
};

/**
 * "What deserves continuation" -- la respuesta concreta a esa pregunta
 * del objetivo de la misión. `null` únicamente cuando no hay
 * `currentActiveStory` (cuenta vacía). `title`/`summary` son passthrough
 * exacto de la historia -- ver docblock de `NarrativeContinuation`.
 */
export function buildContinuation(currentActiveStory: NarrativeThread | null): NarrativeContinuation | null {
  if (!currentActiveStory) return null;

  return {
    threadId: currentActiveStory.id,
    kind: CONTINUATION_KIND_BY_REASON[currentActiveStory.reason],
    reason: currentActiveStory.reason,
    title: currentActiveStory.title,
    summary: currentActiveStory.summary,
  };
}
