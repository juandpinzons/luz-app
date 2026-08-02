import { buildIdentitySnapshot, type BuildIdentitySnapshotInput } from "../../identity-evolution/application/build-identity-snapshot";
import type { IdentitySnapshot } from "../../identity-evolution/domain/identity-snapshot";
import { daySeries, eventSeries, LIFE_GRAPH_ID, makeThemeInput, PERSON_ID } from "../../identity-evolution/tests/fixtures";
import type { ExperienceCard, ExperienceState, RealityChange } from "../../experience/domain/experience-state";
import type { DashboardAction } from "../../dashboard/services/build-follow-up-recommendations";
import type { FollowUpRecommendation } from "../../dashboard/services/build-follow-up-recommendations";
import type { NarrativeMoment } from "../../narrative/domain/narrative-moment";
import type { NarrativeState } from "../../narrative/domain/narrative-state";
import type { NarrativeArc } from "../../narrative/domain/narrative-arc";
import type { PresenceState } from "../../presence/domain/presence-state";

export const NOW = new Date("2026-08-01T12:00:00.000Z");

const ACTION: DashboardAction = { kind: "acknowledge" };

export function makeRecommendation(overrides: Partial<FollowUpRecommendation> = {}): FollowUpRecommendation {
  return {
    id: overrides.id ?? "rec-1",
    type: overrides.type ?? "FOCUS_DOMAIN",
    priority: overrides.priority ?? "high",
    title: overrides.title ?? "Retomar el hábito de ejercicio",
    explanation: overrides.explanation ?? "3 días seguidos sin registrar el hábito.",
    evidence: overrides.evidence ?? [],
    relatedEntities: overrides.relatedEntities ?? [],
    suggestedAction: overrides.suggestedAction ?? ACTION,
    confidence: overrides.confidence ?? 70,
  };
}

export function makePresenceState(overrides: Partial<PresenceState> = {}): PresenceState {
  return {
    asOf: NOW,
    greeting: "Buenas tardes",
    primaryFocus: null,
    secondaryFocus: null,
    attentionNeeded: [],
    recentProgress: [],
    encouragement: null,
    urgency: "low",
    ...overrides,
  };
}

export function makeExperienceCard(overrides: Partial<ExperienceCard> = {}): ExperienceCard {
  return {
    key: overrides.key ?? "focus:1",
    category: overrides.category ?? "focus",
    title: overrides.title ?? "Proyecto LUZ",
    detail: overrides.detail ?? "Sigue en desarrollo activo.",
    importance: overrides.importance ?? 2,
    action: overrides.action,
  };
}

export function makeExperienceState(overrides: Partial<ExperienceState> = {}): ExperienceState {
  return {
    asOf: NOW,
    primary: null,
    secondary: [],
    postponed: [],
    tone: "low",
    isNewPrimary: false,
    whatChanged: [] as RealityChange[],
    fingerprint: {
      memoriesStored: 0,
      goalsCompleted: 0,
      projectsCompleted: 0,
      observationCount: 0,
      recommendationCount: 0,
      relationshipTotal: 0,
    },
    ...overrides,
  };
}

export function makeNarrativeMoment(overrides: Partial<NarrativeMoment> = {}): NarrativeMoment {
  return {
    key: overrides.key ?? "moment:1",
    title: overrides.title ?? "Cumpleaños de Camila",
    detail: overrides.detail ?? "Hoy es su cumpleaños.",
    priority: overrides.priority ?? "medium",
    reason: overrides.reason ?? "celebration_moment",
    score: overrides.score ?? 3,
    relatedEntities: overrides.relatedEntities ?? [],
    relatedThreadId: overrides.relatedThreadId,
  };
}

export function makeNarrativeState(overrides: Partial<NarrativeState> = {}): NarrativeState {
  return {
    asOf: NOW,
    currentActiveStory: null,
    silencedCandidate: null,
    continuation: null,
    recentChanges: [],
    openStories: [],
    recentlyClosedStories: [],
    celebrationCandidates: [],
    longRunningStories: [],
    storiesReadyForReflection: [],
    storiesReadyForFollowUp: [],
    storiesReadyToBeForgotten: [],
    storiesWaitingQuietly: [],
    recurringArcs: [],
    dormantArcs: [],
    ...overrides,
  };
}

/** Construye un `NarrativeArc` mínimo pero válido -- solo lo necesario para `currentActiveStory?.echo`/`.current.title` en los escenarios de eco temporal. */
export function makeNarrativeArc(overrides: Partial<NarrativeArc> = {}): NarrativeArc {
  const chapter = {
    id: "loop-1",
    title: "Aprender guitarra",
    reason: "continuing_open_story" as const,
    priority: "medium" as const,
    score: 2,
    chapter: { stage: "developing" as const, since: NOW },
    relatedEntities: [],
    endedAsSetback: false,
    summary: "Retomó la guitarra hace unos días.",
    origin: "memory" as const,
    ageDays: 5,
    isLongRunning: false,
    isFadingWithoutEvidence: false,
    arcKey: "arc:goal:1",
  };
  return {
    key: "arc:goal:1",
    anchorEntity: null,
    state: "active",
    chapters: [chapter],
    current: chapter,
    isReturningAfterSetback: false,
    echo: null,
    score: 2,
    priority: "medium",
    ...overrides,
  };
}

/** Reutiliza los generadores de `features/identity-evolution/tests/fixtures.ts` para construir un `IdentitySnapshot` REAL (no una forma inventada a mano) -- evita fingir manualmente campos derivados (`trajectory`/`momentum`/`confidence`) que solo `buildIdentitySnapshot` sabe calcular de forma consistente. */
export function makeIdentitySnapshot(
  overrides: { dimensionEvents?: BuildIdentitySnapshotInput["dimensionEvents"]; themes?: BuildIdentitySnapshotInput["themes"] } = {},
): IdentitySnapshot {
  return buildIdentitySnapshot({
    lifeGraphId: LIFE_GRAPH_ID,
    personId: PERSON_ID,
    now: NOW,
    dimensionEvents: overrides.dimensionEvents ?? [],
    themes: overrides.themes ?? [],
  });
}

export const emergingIdentity = () =>
  makeIdentitySnapshot({
    themes: [makeThemeInput({ conceptId: "concept-a", label: "Construyendo LUZ", domain: "career", eventDaysAgo: daySeries(20, 1, 2) })],
  });

export const stableHappyIdentity = () =>
  makeIdentitySnapshot({
    themes: [makeThemeInput({ conceptId: "concept-b", label: "Construyendo LUZ", domain: "career", eventDaysAgo: daySeries(220, 1, 3) })],
  });

export const emptyIdentity = () => makeIdentitySnapshot({});

export { daySeries, eventSeries, makeThemeInput };
