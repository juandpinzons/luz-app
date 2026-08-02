import type { CuriosityQuestion } from "../../curiosity-engine";
import type { Goal, Project, Relationship } from "../../life";
import type { EntityId } from "../../life/value-objects/entity-id";
import type { Memory } from "../../memory-engine";
import type { ContinuityLoop } from "../domain/continuity-loop";
import { isTerminalLoopState } from "../domain/loop-state";
import { createContinuityLoop } from "../lifecycle/transition-loop";
import { detectFromCuriosityQuestion } from "./detect-from-curiosity";
import { detectFromMemory } from "./detect-from-memory";
import { detectGoalDeadline } from "./detect-from-goal";
import { detectProjectDeadline } from "./detect-from-project";
import { detectRelationshipMilestone } from "./detect-from-relationship";
import type { DetectedLoopCandidate } from "./detected-loop-candidate";

export interface RelationshipDetectionInput {
  readonly relationship: Relationship;
  /** Ya resuelto por el llamador -- ver docblock de `detectRelationshipMilestone`. */
  readonly personName?: string;
}

/**
 * Fuentes puramente `core/` -- Memory/Goal/Project/Relationship/
 * Curiosity. Calendar/Gmail/Recommendation viven en
 * `features/continuity/detection/` (`core/` nunca depende de
 * `features/`, ver `../README.md`) y se combinan con el resultado de
 * esta función ahí, no aquí.
 */
export interface DetectContinuityLoopsInput {
  readonly lifeGraphId: EntityId;
  readonly memories?: readonly Memory[];
  readonly goals?: readonly Goal[];
  readonly projects?: readonly Project[];
  readonly relationships?: readonly RelationshipDetectionInput[];
  readonly curiosityQuestions?: readonly CuriosityQuestion[];
  /**
   * Loops ya conocidos de este LifeGraph -- OBLIGATORIO, nunca opcional
   * con default `[]`: sin esto, correr detección dos veces sobre el
   * mismo Goal con la misma fecha crearía un `ContinuityLoop` duplicado
   * cada vez. Un candidato se descarta si YA existe un loop no terminal
   * con el mismo `(origin, sourceId, reason)` -- mismo trigger exacto,
   * sin importar cuántas veces se vuelva a detectar.
   */
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
 * Orquestador de las reglas de apertura de origen `core/`. Corre cada
 * regla sobre cada fuente provista (todas opcionales -- un llamador que
 * solo tiene Goals a mano no necesita construir arreglos vacíos para
 * el resto), descarta lo ya rastreado, y convierte cada candidato
 * sobreviviente en un `ContinuityLoop` real vía `createContinuityLoop`.
 * Pura, sin I/O -- el llamador decide cómo y dónde persistir (mismo
 * patrón que `connectGmail`/`refreshGmail`, `features/reality/`).
 */
export function detectContinuityLoops(input: DetectContinuityLoopsInput): ContinuityLoop[] {
  const now = input.now ?? new Date();
  const candidates: DetectedLoopCandidate[] = [];

  for (const memory of input.memories ?? []) {
    const candidate = detectFromMemory(memory, now);
    if (candidate) candidates.push(candidate);
  }
  for (const goal of input.goals ?? []) {
    const candidate = detectGoalDeadline(goal, now);
    if (candidate) candidates.push(candidate);
  }
  for (const project of input.projects ?? []) {
    const candidate = detectProjectDeadline(project, now);
    if (candidate) candidates.push(candidate);
  }
  for (const entry of input.relationships ?? []) {
    const candidate = detectRelationshipMilestone(entry.relationship, entry.personName, now);
    if (candidate) candidates.push(candidate);
  }
  for (const question of input.curiosityQuestions ?? []) {
    const candidate = detectFromCuriosityQuestion(question, now);
    if (candidate) candidates.push(candidate);
  }

  return candidates
    .filter((candidate) => !alreadyTracked(input.existingLoops, candidate))
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
}
