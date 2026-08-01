import {
  createContinuityLoop,
  detectContinuityLoops,
  isTerminalLoopState,
  type ContinuityLoop,
  type DetectedLoopCandidate,
  type RelationshipDetectionInput,
} from "../../../core/continuity-engine";
import type { CuriosityQuestion } from "../../../core/curiosity-engine";
import type { Goal, Project } from "../../../core/life";
import type { EntityId } from "../../../core/life/value-objects/entity-id";
import type { Memory } from "../../../core/memory-engine";
import type { CalendarSnapshot, EmailSnapshot } from "../../reality/domain";
import type { FollowUpRecommendation } from "../../dashboard/services/build-follow-up-recommendations";
import { detectFromCalendarSnapshot } from "./detect-from-calendar";
import { detectFromEmailSnapshot } from "./detect-from-email";
import { detectFromRecommendation } from "./detect-from-recommendation";

export interface DetectAllContinuityLoopsInput {
  readonly lifeGraphId: EntityId;
  readonly memories?: readonly Memory[];
  readonly goals?: readonly Goal[];
  readonly projects?: readonly Project[];
  readonly relationships?: readonly RelationshipDetectionInput[];
  readonly curiosityQuestions?: readonly CuriosityQuestion[];
  readonly calendarSnapshot?: CalendarSnapshot;
  readonly emailSnapshot?: EmailSnapshot;
  readonly recommendations?: readonly FollowUpRecommendation[];
  readonly existingLoops: readonly ContinuityLoop[];
  readonly now?: Date;
}

function alreadyTracked(existingLoops: readonly ContinuityLoop[], candidate: DetectedLoopCandidate): boolean {
  return existingLoops.some(
    (loop) =>
      !isTerminalLoopState(loop.state) &&
      loop.trigger.origin === candidate.trigger.origin &&
      loop.trigger.sourceId === candidate.trigger.sourceId &&
      loop.trigger.reason === candidate.trigger.reason,
  );
}

/**
 * Orquestador COMPLETO -- envuelve `detectContinuityLoops`
 * (`core/continuity-engine`, fuentes puramente `core/`) y le suma las
 * reglas de origen `features/` (Calendar/Gmail/Recommendation). Único
 * punto que un consumidor de producto necesita llamar para "detecta
 * todo lo que aplique" -- misión: "may originate from Memory/Calendar/
 * Gmail/Goal/Project/Habit/Relationship/Curiosity/Recommendation/
 * Conversation/Life Event/Belief" en un solo lugar.
 *
 * Todas las fuentes son opcionales -- un llamador que solo tiene
 * `calendarSnapshot` a mano (p. ej. un job que solo sincronizó
 * calendario) no necesita construir arreglos vacíos para el resto.
 */
export function detectAllContinuityLoops(input: DetectAllContinuityLoopsInput): ContinuityLoop[] {
  const now = input.now ?? new Date();

  const coreLoops = detectContinuityLoops({
    lifeGraphId: input.lifeGraphId,
    memories: input.memories,
    goals: input.goals,
    projects: input.projects,
    relationships: input.relationships,
    curiosityQuestions: input.curiosityQuestions,
    existingLoops: input.existingLoops,
    now,
  });

  const featureCandidates: DetectedLoopCandidate[] = [];
  if (input.calendarSnapshot) {
    featureCandidates.push(...detectFromCalendarSnapshot(input.calendarSnapshot, now));
  }
  if (input.emailSnapshot) {
    featureCandidates.push(...detectFromEmailSnapshot(input.emailSnapshot, now));
  }
  for (const recommendation of input.recommendations ?? []) {
    const candidate = detectFromRecommendation(recommendation, now);
    if (candidate) featureCandidates.push(candidate);
  }

  // Se deduplica contra lo ya conocido Y contra lo que `coreLoops` acaba
  // de producir en esta misma llamada -- un origen distinto nunca
  // colisiona en la práctica, pero la comprobación es igual de barata.
  const knownLoops = [...input.existingLoops, ...coreLoops];
  const newFeatureLoops = featureCandidates
    .filter((candidate) => !alreadyTracked(knownLoops, candidate))
    .map((candidate) =>
      createContinuityLoop({
        lifeGraphId: input.lifeGraphId,
        trigger: candidate.trigger,
        title: candidate.title,
        priority: candidate.priority,
        relatedEntities: candidate.relatedEntities,
        now,
      }),
    );

  return [...coreLoops, ...newFeatureLoops];
}
