import type { LifeGraphContext } from "../../life/life-graph-context";
import { createEntityId } from "../../life/value-objects/entity-id";
import type { LifeDomainType } from "../../life/value-objects/life-domain-type";
import type { CuriosityQuestionGenerationStrategy } from "../generation/curiosity-question-generation-strategy";
import type { CuriosityQuestion } from "../entities/curiosity-question";
import type { CuriosityQuestionRepository } from "../repositories/curiosity-question.repository";

/** Por debajo de esto, un dominio cuenta como vacío real -- mismo umbral que `CuriosityStrategyRule.GAP_THRESHOLD` (core/conversation-strategy-engine), una sola constante de significado compartido. */
export const CURIOSITY_GAP_THRESHOLD = 25;

/**
 * A lo sumo una `CuriosityQuestion` `pending` por LifeGraph a la vez
 * (Principio: "una experiencia mágica gana a diez mediocres" -- una
 * curiosidad genuina, no un backlog de preguntas acumulándose). Si ya
 * hay una pendiente, no genera otra -- deja que se resuelva o se
 * descarte primero (`resolveStaleCuriosityQuestions`).
 */
export async function generateCuriosityQuestion(
  repository: CuriosityQuestionRepository,
  strategy: CuriosityQuestionGenerationStrategy,
  context: LifeGraphContext,
  input: {
    weakestDomain: { domain: LifeDomainType; label: string; coverageScore: number };
    knownAboutPerson: string[];
  },
): Promise<CuriosityQuestion | null> {
  if (input.weakestDomain.coverageScore >= CURIOSITY_GAP_THRESHOLD) {
    return null;
  }

  const existing = await repository.getPending(context);
  if (existing) {
    return null;
  }

  const proposed = await strategy.proposeQuestion({
    domain: input.weakestDomain.domain,
    domainLabel: input.weakestDomain.label,
    knownAboutPerson: input.knownAboutPerson,
  });

  if (!proposed) {
    return null;
  }

  const now = new Date();

  return repository.save(context, {
    id: createEntityId(crypto.randomUUID()),
    lifeGraphId: context.lifeGraphId,
    domain: input.weakestDomain.domain,
    question: proposed.question,
    rationale: proposed.rationale,
    status: "pending",
    coverageScoreAtCreation: input.weakestDomain.coverageScore,
    createdAt: now,
    updatedAt: now,
  });
}
