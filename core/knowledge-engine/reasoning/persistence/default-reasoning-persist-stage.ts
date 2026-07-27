import type { EntityId } from "../../../life/value-objects/entity-id";
import { createEntityId } from "../../../life/value-objects/entity-id";
import type { PipelineContext } from "../../pipeline-context";
import type { ReasoningConclusion } from "../entities/reasoning-conclusion";
import type { ReasoningRepository } from "../repositories/reasoning.repository";
import type { ValidatedReasoning } from "../validation/reasoning-validation-strategy";
import type { ReasoningPersistStage } from "./reasoning-persist-stage";

/**
 * Persiste la conclusión y su evidencia -- insights de apoyo Y las
 * memorias que los respaldan (para que explorar una conclusión llegue
 * hasta la evidencia real, no se quede en "un insight lo dice"),
 * insights contradictorios como su propio `role`. Mismo criterio que
 * `DefaultPersistStage`: la conclusión se guarda primero, su evidencia
 * después, en el mismo orden que ya establece `Insight`+`Evidence`.
 */
export class DefaultReasoningPersistStage implements ReasoningPersistStage {
  constructor(private readonly repository: ReasoningRepository) {}

  async persist(
    validated: ValidatedReasoning,
    evidenceMemoryIdsByInsightId: Map<EntityId, EntityId[]>,
    pipelineContext: PipelineContext,
  ): Promise<ReasoningConclusion> {
    const now = new Date();

    const conclusion: ReasoningConclusion = {
      id: createEntityId(crypto.randomUUID()),
      lifeGraphId: pipelineContext.lifeGraphId,
      statement: validated.statement,
      confidence: validated.confidence,
      status: "validated",
      uncertaintyNotes: validated.uncertaintyNotes,
      createdAt: now,
      updatedAt: now,
    };

    const saved = await this.repository.save(pipelineContext, conclusion);

    for (const insightId of validated.supportingInsightIds) {
      await this.repository.saveEvidence(pipelineContext, saved.id, {
        refType: "insight",
        refId: insightId,
        role: "supporting",
      });

      for (const memoryId of evidenceMemoryIdsByInsightId.get(insightId) ?? []) {
        await this.repository.saveEvidence(pipelineContext, saved.id, {
          refType: "memory",
          refId: memoryId,
          role: "supporting",
        });
      }
    }

    for (const insightId of validated.contradictingInsightIds) {
      await this.repository.saveEvidence(pipelineContext, saved.id, {
        refType: "insight",
        refId: insightId,
        role: "contradicting",
      });
    }

    return saved;
  }
}
