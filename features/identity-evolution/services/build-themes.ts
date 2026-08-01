import type { EntityId } from "../../../core/life/value-objects/entity-id";
import type { LifeDomainType } from "../../../core/life/value-objects/life-domain-type";
import type { IdentityTheme } from "../domain/identity-theme";
import { computeUnitTimelineWithHistory } from "./compute-unit-timeline";
import { SIGNAL_BASE_WEIGHT, type IdentityEvidenceEvent } from "./decay";
import { deriveRepresentation } from "./derive-representation";

/**
 * Entrada neutral para un tema -- un `Concept` real (`core/concept-graph`)
 * más las fechas de su propia `ConceptEvidence`. Quien ensambla esto
 * (`application/assemble-identity-evolution.ts`) es quien traduce el
 * tipo real `Concept`/`ConceptEvidence` a esta forma -- misma frontera
 * anti-corrupción que `BeliefChangeInput` en `core/temporal-evolution`.
 */
export interface IdentityThemeEvidenceInput {
  readonly conceptId: EntityId;
  readonly label: string;
  readonly domain?: LifeDomainType;
  readonly events: readonly { readonly occurredAt: Date }[];
}

/**
 * Un `IdentityTheme` por cada `Concept` recibido -- a diferencia de
 * `buildDimensions`, no hay un universo cerrado de temas posibles: solo
 * existen temas para conceptos reales que la persona ya tiene. Un
 * concepto sin evidencia dentro de la ventana evaluada igual produce un
 * `IdentityTheme` (con `weight: 0`, `momentum: "stable"`) -- nunca se
 * omite, mismo principio que `IdentityDimension`.
 */
export function buildThemes(
  themes: readonly IdentityThemeEvidenceInput[],
  now: Date,
): readonly IdentityTheme[] {
  return themes.map((theme) => {
    const evidence: IdentityEvidenceEvent[] = theme.events.map((event) => ({
      occurredAt: event.occurredAt,
      weight: SIGNAL_BASE_WEIGHT.concept_evidence,
    }));

    const { current: timeline, previousMomentum } = computeUnitTimelineWithHistory(evidence, now);

    const identityTheme: IdentityTheme = {
      themeKey: theme.conceptId,
      conceptId: theme.conceptId,
      label: theme.label,
      domain: theme.domain,
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
      representation: deriveRepresentation(theme.label, timeline),
    };
    return identityTheme;
  });
}
