import type { NarrativePriority } from "../domain/narrative-priority";
import type { NarrativeReason } from "../domain/narrative-reason";
import type { NarrativeState } from "../domain/narrative-state";

export interface NarrativeNotificationCandidate {
  readonly threadId: string;
  readonly title: string;
  readonly priority: NarrativePriority;
  readonly reason: NarrativeReason;
}

const ELIGIBLE_PRIORITIES: ReadonlySet<NarrativePriority> = new Set(["high", "critical"]);

/**
 * Candidato para una futura capa de Notificaciones -- misión: "expose
 * clean contracts for... Notification Layer." Solo `currentActiveStory`
 * con prioridad `high`/`critical` califica -- mismo criterio
 * deliberadamente conservador que `toNotificationCandidates`
 * (`features/continuity/integrations/`): una notificación interrumpe
 * activamente, así que exige más que cualquier otro consumidor. `null`
 * en cualquier otro caso -- incluido cuando la única historia elegible
 * quedó en `NarrativeState.silencedCandidate` (el silencio deliberado
 * de Narrative se respeta también aquí, nunca se hace una excepción
 * "porque es una notificación"). Esta capa de producto no existe
 * todavía en el repo -- contrato puramente prospectivo, ningún llamador
 * real hoy.
 */
export function toNotificationCandidate(state: NarrativeState): NarrativeNotificationCandidate | null {
  const story = state.currentActiveStory;
  if (!story || !ELIGIBLE_PRIORITIES.has(story.priority)) return null;

  return { threadId: story.current.id, title: story.current.title, priority: story.priority, reason: story.current.reason };
}
