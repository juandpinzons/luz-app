import type { NarrativePriority } from "./narrative-priority";
import type { NarrativeMoment } from "./narrative-moment";
import type { NarrativeThread } from "./narrative-thread";

/**
 * Proyección común de `NarrativeThread`/`NarrativeMoment` para efectos
 * de ranking (`services/select-primary-narrative.ts`,
 * `services/build-celebration-candidates.ts`) -- la misma "moneda" que
 * `ExperienceCard` cumple para `features/experience/`. Nunca se expone
 * como parte de `NarrativeState`: es una forma interna de comparar
 * historias y momentos en la misma escala antes de decidir quién gana
 * cada categoría de salida.
 *
 * `currentActiveStory` (`NarrativeState`) SOLO puede salir de una
 * candidata `kind: "thread"` -- un momento de un solo instante no tiene
 * capítulo ni progresión, así que nunca puede ser "la historia activa".
 * Sí puede ganar `celebrationCandidates`, que no exige continuidad.
 */
export type NarrativeCandidate =
  | {
      readonly kind: "thread";
      readonly key: string;
      readonly score: number;
      readonly priority: NarrativePriority;
      readonly thread: NarrativeThread;
    }
  | {
      readonly kind: "moment";
      readonly key: string;
      readonly score: number;
      readonly priority: NarrativePriority;
      readonly moment: NarrativeMoment;
    };
