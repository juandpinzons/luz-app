import type { NarrativeState } from "../domain/narrative-state";

export interface NarrativeMorningBriefContext {
  readonly primaryTitle: string | null;
  readonly primarySummary: string | null;
  readonly celebrationTitles: readonly string[];
  readonly recentlyClosedTitles: readonly string[];
}

/**
 * Datos crudos, NUNCA prosa -- `build-morning-brief.ts`
 * (`features/dashboard/`) sigue siendo el único lugar que llama a un
 * `AIProvider` en todo `features/dashboard/`; este contrato solo le
 * entrega hechos ya reales y ya priorizados, la redacción sigue siendo
 * su responsabilidad exclusiva. Mismo criterio que
 * `buildMorningBriefItems` (`features/continuity/integrations/`).
 * Ningún llamador real hoy.
 */
export function toMorningBriefContext(state: NarrativeState): NarrativeMorningBriefContext {
  return {
    primaryTitle: state.currentActiveStory?.title ?? null,
    primarySummary: state.currentActiveStory?.summary ?? null,
    celebrationTitles: state.celebrationCandidates.map((moment) => moment.title),
    recentlyClosedTitles: state.recentlyClosedStories.map((thread) => thread.title),
  };
}
