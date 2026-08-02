import type { NarrativeProgression } from "../domain/narrative-progression";
import type { NarrativeThread } from "../domain/narrative-thread";

const NON_TERMINAL_STAGES = new Set<NarrativeProgression>(["beginning", "developing", "waiting", "turning_point"]);
const RECENTLY_CLOSED_STAGES = new Set<NarrativeProgression>(["resolution", "reflection"]);

export interface CategorizedThreads {
  readonly openStories: NarrativeThread[];
  readonly recentlyClosedStories: NarrativeThread[];
  readonly longRunningStories: NarrativeThread[];
  readonly storiesReadyForReflection: NarrativeThread[];
  readonly storiesReadyForFollowUp: NarrativeThread[];
  readonly storiesReadyToBeForgotten: NarrativeThread[];
  readonly storiesWaitingQuietly: NarrativeThread[];
}

/**
 * Siete FILTROS sobre el mismo pool de `NarrativeThread` -- nunca siete
 * decisiones independientes que puedan contradecirse entre sí. Cada
 * categoría es una condición booleana simple sobre `chapter.stage` (o
 * los hechos ya expuestos en el thread, `isLongRunning`/
 * `isFadingWithoutEvidence`), documentada en `NarrativeState`
 * (`domain/narrative-state.ts`) -- este archivo solo aplica esas reglas,
 * no las redefine. Las categorías se solapan a propósito: un mismo
 * thread puede aparecer en varias a la vez (mismo criterio que
 * `HomeState.attentionNeeded`, ver su README, "Attention Needed y
 * Recommendations son el mismo dato").
 */
export function categorizeThreads(threads: readonly NarrativeThread[]): CategorizedThreads {
  const openStories = threads.filter((thread) => NON_TERMINAL_STAGES.has(thread.chapter.stage));
  const recentlyClosedStories = threads.filter((thread) => RECENTLY_CLOSED_STAGES.has(thread.chapter.stage));
  const longRunningStories = threads.filter((thread) => thread.isLongRunning);
  const storiesReadyForReflection = threads.filter((thread) => thread.chapter.stage === "reflection");
  const storiesReadyForFollowUp = threads.filter((thread) => thread.chapter.stage === "turning_point");
  const storiesReadyToBeForgotten = threads.filter((thread) => thread.isFadingWithoutEvidence);
  const storiesWaitingQuietly = threads.filter((thread) => thread.chapter.stage === "waiting");

  return {
    openStories,
    recentlyClosedStories,
    longRunningStories,
    storiesReadyForReflection,
    storiesReadyForFollowUp,
    storiesReadyToBeForgotten,
    storiesWaitingQuietly,
  };
}
