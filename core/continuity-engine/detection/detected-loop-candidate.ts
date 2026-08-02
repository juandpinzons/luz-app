import type { LoopRelatedEntity, LoopTrigger } from "../domain/continuity-loop";
import type { LoopPriority } from "../domain/loop-priority";

/**
 * Lo que una regla de apertura determinista produce -- todavía no un
 * `ContinuityLoop` (eso exige `lifeGraphId`, que ninguna regla conoce
 * por sí sola). El orquestador (`./detect-continuity-loops.ts`) es
 * quien lo convierte en un loop real vía `createContinuityLoop`
 * (`../lifecycle/`).
 */
export interface DetectedLoopCandidate {
  readonly trigger: LoopTrigger;
  readonly title: string;
  readonly priority: LoopPriority;
  readonly relatedEntities: readonly LoopRelatedEntity[];
}
