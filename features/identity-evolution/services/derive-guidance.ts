import type { EntityId } from "../../../core/life/value-objects/entity-id";
import type { LifeDomainType } from "../../../core/life/value-objects/life-domain-type";
import type {
  ConversationGuidance,
  ExperienceGuidance,
  NarrativeGuidance,
  PresenceGuidance,
} from "../domain/identity-guidance";
import type { IdentityDimension } from "../domain/identity-dimension";
import type { IdentityRankedUnitRef } from "../domain/identity-snapshot";
import type { IdentityTheme } from "../domain/identity-theme";
import { SIGNIFICANCE_THRESHOLD } from "./decay";
import type { RankedIdentity } from "./rank-identity";

/** El dominio detrás de una unidad rankeada -- directo si es una dimensión, prestado de `Concept.domain` si es un tema (puede ser `null` si el concepto todavía no tiene área clasificada). */
function domainOfUnit(unit: IdentityRankedUnitRef | null, themes: readonly IdentityTheme[]): LifeDomainType | null {
  if (!unit) return null;
  if (unit.unitKind === "dimension") return unit.key as LifeDomainType;
  const theme = themes.find((candidate) => candidate.themeKey === unit.key);
  return theme?.domain ?? null;
}

function themeKeyOfUnit(unit: IdentityRankedUnitRef | null): EntityId | null {
  if (!unit || unit.unitKind !== "theme") return null;
  return unit.key as EntityId;
}

/**
 * Las cuatro salidas de guía de `IdentitySnapshot` -- todas derivadas
 * de lo que `rankIdentity` ya decidió, nunca una segunda pasada de
 * ranking (mismo criterio anti-duplicación que
 * `NarrativeConversationContext`/`toPresenceContinuitySignal` en
 * `features/narrative`). Ninguna produce una frase lista: solo datos
 * para que un futuro consumidor real decida qué decir.
 */
export function deriveGuidance(
  ranked: RankedIdentity,
  dimensions: readonly IdentityDimension[],
  themes: readonly IdentityTheme[],
): {
  conversationGuidance: ConversationGuidance;
  narrativeGuidance: NarrativeGuidance;
  presenceGuidance: PresenceGuidance;
  experienceGuidance: ExperienceGuidance;
} {
  const primaryDomain = domainOfUnit(ranked.primaryIdentity, themes);
  const primaryThemeKey = themeKeyOfUnit(ranked.primaryIdentity);

  const conversationGuidance: ConversationGuidance = {
    leadWithDomain: primaryDomain,
    leadWithTheme: primaryThemeKey,
    worthAcknowledging: ranked.emergingThemes.map((unit) => unit.key),
    avoidDominating: ranked.deemphasized.map((unit) => unit.key),
  };

  const narrativeGuidance: NarrativeGuidance = {
    primaryThemeKey,
    recurringThemeKeys: ranked.stableThemes
      .filter((unit) => unit.unitKind === "theme")
      .map((unit) => unit.key),
    resolvedChapterKeys: ranked.resolvedChapters.map((unit) => unit.key),
  };

  const deemphasizeDomains = [
    ...new Set(
      dimensions
        .filter(
          (dimension) =>
            (dimension.momentum === "declining" || dimension.momentum === "dormant") &&
            dimension.peakWeight >= SIGNIFICANCE_THRESHOLD,
        )
        .map((dimension) => dimension.domain),
    ),
  ];

  const presenceGuidance: PresenceGuidance = {
    suggestedFocusDomain: primaryDomain,
    deemphasizeDomains,
  };

  const spotlightCandidate =
    ranked.primaryIdentity?.unitKind === "theme"
      ? ranked.primaryIdentity
      : ranked.emergingThemes.find((unit) => unit.unitKind === "theme") ?? null;

  const experienceGuidance: ExperienceGuidance = {
    spotlightThemeKey: spotlightCandidate ? (spotlightCandidate.key as EntityId) : null,
    retireThemeKeys: ranked.resolvedChapters
      .filter((unit) => unit.unitKind === "theme")
      .map((unit) => unit.key),
  };

  return { conversationGuidance, narrativeGuidance, presenceGuidance, experienceGuidance };
}
