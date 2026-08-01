import { LIFE_DOMAIN_LABEL } from "../../../core/life/value-objects/life-domain-label";
import { LIFE_DOMAIN_TYPES } from "../../../core/life/value-objects/life-domain-type";
import type { EvolutionEvent } from "../../../core/temporal-evolution";
import type { IdentityDimension } from "../domain/identity-dimension";
import { computeUnitTimelineWithHistory } from "./compute-unit-timeline";
import { SIGNAL_BASE_WEIGHT, type IdentityEvidenceEvent } from "./decay";
import { deriveRepresentation } from "./derive-representation";

/**
 * Un `IdentityDimension` por cada una de las 8 `LifeDomainType`,
 * siempre las 8 -- una dimensión sin evidencia real sigue siendo un
 * hecho legítimo ("LUZ no sabe nada de esto todavía"), nunca se omite
 * del arreglo (ver docblock de `IdentityDimension`).
 *
 * `EvolutionEvent` (`core/temporal-evolution`) ya es la línea de tiempo
 * neutral de cambios de Belief + descubrimiento de Insight que
 * `features/identity/services/describe-evolution.ts` construye sobre
 * TODA la historia disponible (no acotada a una ventana corta, ver
 * docblock de `application/assemble-identity-evolution.ts`) -- este
 * módulo no vuelve a tocar `core/belief-engine` directamente, solo
 * agrupa por `domain` lo que ese ensamblador ya entregó.
 *
 * `insight_discovered` nunca trae `domain` (ver `EvolutionEvent`), así
 * que naturalmente no participa aquí -- ver `decay.ts`.
 */
export function buildDimensions(
  events: readonly EvolutionEvent[],
  now: Date,
): readonly IdentityDimension[] {
  return LIFE_DOMAIN_TYPES.map((domain) => {
    const domainEvidence: IdentityEvidenceEvent[] = events
      .filter((event) => event.domain === domain)
      .map((event) => ({ occurredAt: event.occurredAt, weight: SIGNAL_BASE_WEIGHT[event.kind] }));

    const label = LIFE_DOMAIN_LABEL[domain];
    const { current: timeline, previousMomentum } = computeUnitTimelineWithHistory(domainEvidence, now);

    const dimension: IdentityDimension = {
      domain,
      label,
      weight: timeline.weight,
      peakWeight: timeline.peakWeight,
      weightAtComparisonCheckpoint: timeline.weightAtComparisonCheckpoint,
      delta: timeline.delta,
      momentum: timeline.momentum,
      previousMomentum,
      confidence: timeline.confidence,
      earliestEvidenceAgeDays: timeline.earliestEvidenceAgeDays,
      latestEvidenceAgeDays: timeline.latestEvidenceAgeDays,
      evidenceCount: timeline.evidenceCount,
      representation: deriveRepresentation(label, timeline),
    };
    return dimension;
  });
}
