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

  /**
   * Idempotencia (auditoría War Room 2026-07-29, bloque 5, reproducido
   * contra Postgres real): `DefaultReasoningEngine.run()` corre una vez
   * por job (`enrich-knowledge-graph.ts`), y Gather→Correlate suele
   * volver a formar el MISMO cluster de insights mientras siga siendo
   * la ventana relevante de Context Engine -- ya sea por un reintento
   * tras lease expirado, o simplemente por el job del siguiente mensaje
   * de la misma conversación. Sin esta guarda, cada corrida insertaba
   * una `ReasoningConclusion` nueva para exactamente el mismo grupo de
   * insights de apoyo, sin ninguna evidencia nueva real. Se busca una
   * conclusión existente cuyo conjunto de insights de apoyo sea
   * exactamente el mismo que el propuesto -- mismo criterio que
   * `alreadyKnown()` en `detectPredictivePatterns` (reusa evidencia ya
   * persistida como única fuente de verdad, nunca un campo de estado
   * nuevo).
   */
  private async findExistingConclusion(
    supportingInsightIds: EntityId[],
    pipelineContext: PipelineContext,
  ): Promise<ReasoningConclusion | null> {
    if (supportingInsightIds.length === 0) {
      return null;
    }

    const supportingSet = new Set(supportingInsightIds);
    const candidateIds = new Set<EntityId>();

    for (const insightId of supportingInsightIds) {
      const candidates = await this.repository.listByEvidenceRef(
        pipelineContext,
        "insight",
        insightId,
      );
      for (const candidate of candidates) {
        candidateIds.add(candidate.id);
      }
    }

    for (const conclusionId of candidateIds) {
      const evidence = await this.repository.getEvidence(pipelineContext, conclusionId);
      const existingSupportingIds = new Set(
        evidence
          .filter((item) => item.ref.role === "supporting" && item.ref.refType === "insight")
          .map((item) => item.ref.refId),
      );

      const sameSize = existingSupportingIds.size === supportingSet.size;
      const sameMembers = [...existingSupportingIds].every((id) => supportingSet.has(id));

      if (sameSize && sameMembers) {
        return this.repository.getById(pipelineContext, conclusionId);
      }
    }

    return null;
  }

  async persist(
    validated: ValidatedReasoning,
    evidenceMemoryIdsByInsightId: Map<EntityId, EntityId[]>,
    pipelineContext: PipelineContext,
  ): Promise<ReasoningConclusion> {
    const existing = await this.findExistingConclusion(
      validated.supportingInsightIds,
      pipelineContext,
    );
    if (existing) {
      return existing;
    }

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
