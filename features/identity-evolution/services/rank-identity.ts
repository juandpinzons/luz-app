import type { IdentityDimension } from "../domain/identity-dimension";
import type { IdentityMomentum } from "../domain/identity-momentum";
import type { IdentityRankedUnitRef } from "../domain/identity-snapshot";
import type { IdentityTheme } from "../domain/identity-theme";
import { PRESENCE_THRESHOLD, SIGNIFICANCE_THRESHOLD } from "./decay";

export interface RankableUnit {
  readonly unitKind: "dimension" | "theme";
  readonly key: string;
  readonly label: string;
  readonly weight: number;
  readonly weightAtComparisonCheckpoint: number;
  readonly delta: number;
  readonly peakWeight: number;
  readonly momentum: IdentityMomentum;
  readonly previousMomentum: IdentityMomentum;
  /** `IdentityConfidence.score` -- usado únicamente como criterio de desempate (ver `sortByWeightDesc`), nunca para ordenar por sí solo. */
  readonly confidenceScore: number;
}

export interface RankedIdentity {
  readonly primaryIdentity: IdentityRankedUnitRef | null;
  readonly secondaryIdentity: IdentityRankedUnitRef | null;
  readonly emergingThemes: readonly IdentityRankedUnitRef[];
  readonly decliningThemes: readonly IdentityRankedUnitRef[];
  readonly stableThemes: readonly IdentityRankedUnitRef[];
  readonly resolvedChapters: readonly IdentityRankedUnitRef[];
  readonly deemphasized: readonly IdentityRankedUnitRef[];
  /** Ranking completo (dimensiones + temas), mayor `weight` primero -- uso interno de `detect-shifts.ts`, no se expone directamente en `IdentitySnapshot`. */
  readonly fullRanking: readonly RankableUnit[];
}

function toRef(unit: RankableUnit): IdentityRankedUnitRef {
  return { unitKind: unit.unitKind, key: unit.key, label: unit.label, weight: unit.weight, momentum: unit.momentum };
}

/**
 * Orden: el peso que indique `weightOf` (mayor primero) ->
 * `confidenceScore` (más evidencia real, mejor repartida en el tiempo,
 * gana un empate) -> tema antes que dimensión (más específico gana un
 * empate real) -> `key` (desempate final, determinista). El segundo y
 * tercer criterio importan sobre todo cuando varias unidades saturan
 * `weight: 100` a la vez (ej. tres temas igual de dominantes hoy) --
 * sin ellos, el desempate sería alfabético puro, que no refleja ninguna
 * señal real (ver README, "Debilidad conocida"). Parametrizada por
 * `weightOf` (no fija en `.weight`) para que `services/detect-shifts.ts`
 * pueda reusar EXACTAMENTE el mismo criterio de desempate al rankear
 * por `.weightAtComparisonCheckpoint` en vez de `.weight` -- dos
 * rankings con desempates distintos podrían decir "el #1 cambió" por
 * puro accidente de ordenamiento, nunca por una razón real.
 */
function compareUnitsBy(weightOf: (unit: RankableUnit) => number) {
  return (a: RankableUnit, b: RankableUnit): number =>
    weightOf(b) - weightOf(a) ||
    b.confidenceScore - a.confidenceScore ||
    Number(b.unitKind === "theme") - Number(a.unitKind === "theme") ||
    a.key.localeCompare(b.key);
}

function sortByWeightDesc(units: readonly RankableUnit[]): RankableUnit[] {
  return [...units].sort(compareUnitsBy((unit) => unit.weight));
}

/**
 * El primer `RankableUnit` cuyo `weightOf(unit) >= PRESENCE_THRESHOLD`,
 * bajo el mismo criterio de desempate que `sortByWeightDesc` -- ver su
 * docblock. `null` cuando ninguno cruza el umbral (nunca se fabrica un
 * "primero" de la nada). Exportada para que `detect-shifts.ts` la
 * reutilice al rankear por `weightAtComparisonCheckpoint`.
 */
export function topUnitBy(
  units: readonly RankableUnit[],
  weightOf: (unit: RankableUnit) => number,
): RankableUnit | null {
  const eligible = units.filter((unit) => weightOf(unit) >= PRESENCE_THRESHOLD);
  if (eligible.length === 0) return null;
  return [...eligible].sort(compareUnitsBy(weightOf))[0] ?? null;
}

/**
 * Combina `IdentityDimension[]` + `IdentityTheme[]` en un solo ranking
 * -- la misión los trata como el mismo tipo de cosa (su propio ejemplo
 * mezcla "Health" con "Building LUZ" en la misma lista), así que
 * `primaryIdentity`/`secondaryIdentity` se eligen sobre el pool
 * combinado. Ver `sortByWeightDesc` para el orden exacto de desempate.
 */
export function rankIdentity(
  dimensions: readonly IdentityDimension[],
  themes: readonly IdentityTheme[],
): RankedIdentity {
  const dimensionUnits: RankableUnit[] = dimensions.map((dimension) => ({
    unitKind: "dimension",
    key: dimension.domain,
    label: dimension.label,
    weight: dimension.weight,
    weightAtComparisonCheckpoint: dimension.weightAtComparisonCheckpoint,
    delta: dimension.delta,
    peakWeight: dimension.peakWeight,
    momentum: dimension.momentum,
    previousMomentum: dimension.previousMomentum,
    confidenceScore: dimension.confidence.score,
  }));
  const themeUnits: RankableUnit[] = themes.map((theme) => ({
    unitKind: "theme",
    key: theme.themeKey,
    label: theme.label,
    weight: theme.weight,
    weightAtComparisonCheckpoint: theme.weightAtComparisonCheckpoint,
    delta: theme.delta,
    peakWeight: theme.peakWeight,
    momentum: theme.momentum,
    previousMomentum: theme.previousMomentum,
    confidenceScore: theme.confidence.score,
  }));

  const fullRanking = sortByWeightDesc([...dimensionUnits, ...themeUnits]);
  const present = fullRanking.filter((unit) => unit.weight >= PRESENCE_THRESHOLD);

  const decliningUnits = fullRanking.filter((unit) => unit.momentum === "declining");
  const resolvedUnits = fullRanking.filter((unit) => unit.momentum === "dormant");
  const wasSignificant = (unit: RankableUnit) => unit.peakWeight >= SIGNIFICANCE_THRESHOLD;

  return {
    primaryIdentity: present[0] ? toRef(present[0]) : null,
    secondaryIdentity: present[1] ? toRef(present[1]) : null,
    emergingThemes: fullRanking
      .filter((unit) => unit.momentum === "emerging" || unit.momentum === "renewing")
      .map(toRef),
    decliningThemes: decliningUnits.map(toRef),
    stableThemes: fullRanking
      .filter((unit) => unit.momentum === "stable" && unit.weight >= PRESENCE_THRESHOLD)
      .map(toRef),
    resolvedChapters: resolvedUnits.map(toRef),
    /** Unión declining + dormant, solo lo que alguna vez fue significativo -- "cosas que ya no deberían dominar la conversación" nunca incluye algo que nunca importó de verdad. */
    deemphasized: sortByWeightDesc([...decliningUnits, ...resolvedUnits].filter(wasSignificant)).map(toRef),
    fullRanking,
  };
}
