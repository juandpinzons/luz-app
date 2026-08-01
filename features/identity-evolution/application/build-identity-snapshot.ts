import type { EntityId } from "../../../core/life/value-objects/entity-id";
import type { EvolutionEvent } from "../../../core/temporal-evolution";
import type { IdentitySnapshot } from "../domain/identity-snapshot";
import { buildDimensions } from "../services/build-dimensions";
import { buildThemes, type IdentityThemeEvidenceInput } from "../services/build-themes";
import { computeConfidence } from "../services/compute-unit-timeline";
import { COMPARISON_WINDOW_DAYS, LOOKBACK_DAYS, SIGNAL_BASE_WEIGHT, type IdentityEvidenceEvent } from "../services/decay";
import { detectShifts, detectTrajectory } from "../services/detect-shifts";
import { deriveGuidance } from "../services/derive-guidance";
import { rankIdentity } from "../services/rank-identity";

export interface BuildIdentitySnapshotInput {
  readonly lifeGraphId: EntityId;
  readonly personId: EntityId;
  /** Por defecto, `new Date()`. Aceptado aparte para escenarios sintéticos deterministas y para que un consumidor futuro pueda anclar el snapshot al mismo instante que otro objeto (`RealitySnapshot.capturedAt`, `HomeState.asOf`). */
  readonly now?: Date;
  /**
   * Línea de tiempo completa de `core/temporal-evolution` -- evidencia
   * de nivel DIMENSIÓN (`Belief` creado/reforzado/debilitado/expirado/
   * retractado, agrupado por `LifeDomainType`). Se espera SIN acotar
   * por ventana (`describeEvolution(db, context, N).timeline` ya
   * entrega la historia completa, `N` solo afecta a `.summary` -- ver
   * `application/assemble-identity-evolution.ts`); este builder es
   * quien decide su propia ventana (`LOOKBACK_DAYS`), no quien la
   * recibe ya recortada.
   */
  readonly dimensionEvents: readonly EvolutionEvent[];
  /** Evidencia de nivel TEMA -- un elemento por `Concept` real de la persona, ver `IdentityThemeEvidenceInput`. */
  readonly themes: readonly IdentityThemeEvidenceInput[];
}

/**
 * Punto de entrada público de la capa de Evolución de Identidad.
 * Responde la pregunta que le da nombre a la misión: **no "qué le pasó
 * a esta persona", sino "quién es esta persona HOY"** -- consume SOLO
 * contratos ya calculados por otros módulos (`EvolutionEvent` de
 * `core/temporal-evolution`, `Concept`/`ConceptEvidence` ya traducidos
 * por el llamador), nunca un repositorio, nunca IA, nunca aleatoriedad.
 * Determinístico de punta a punta: mismas entradas + mismo `now`
 * siempre producen el mismo `IdentitySnapshot`, byte a byte.
 */
export function buildIdentitySnapshot(input: BuildIdentitySnapshotInput): IdentitySnapshot {
  const now = input.now ?? new Date();

  const dimensions = buildDimensions(input.dimensionEvents, now);
  const themes = buildThemes(input.themes, now);

  const ranked = rankIdentity(dimensions, themes);
  const recentShifts = detectShifts(ranked.fullRanking);
  const trajectory = detectTrajectory(ranked.fullRanking);

  const allEvidence: IdentityEvidenceEvent[] = [
    ...input.dimensionEvents.map((event) => ({ occurredAt: event.occurredAt, weight: SIGNAL_BASE_WEIGHT[event.kind] })),
    ...input.themes.flatMap((theme) =>
      theme.events.map((event) => ({ occurredAt: event.occurredAt, weight: SIGNAL_BASE_WEIGHT.concept_evidence })),
    ),
  ];
  const overallConfidence = computeConfidence(allEvidence, now, LOOKBACK_DAYS);

  const { conversationGuidance, narrativeGuidance, presenceGuidance, experienceGuidance } = deriveGuidance(
    ranked,
    dimensions,
    themes,
  );

  return {
    lifeGraphId: input.lifeGraphId,
    personId: input.personId,
    asOf: now,
    lookbackDays: LOOKBACK_DAYS,
    comparisonWindowDays: COMPARISON_WINDOW_DAYS,
    dimensions,
    themes,
    primaryIdentity: ranked.primaryIdentity,
    secondaryIdentity: ranked.secondaryIdentity,
    emergingThemes: ranked.emergingThemes,
    decliningThemes: ranked.decliningThemes,
    stableThemes: ranked.stableThemes,
    resolvedChapters: ranked.resolvedChapters,
    deemphasized: ranked.deemphasized,
    recentShifts,
    trajectory,
    overallConfidence,
    conversationGuidance,
    narrativeGuidance,
    presenceGuidance,
    experienceGuidance,
  };
}
