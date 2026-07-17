import type { Evidence } from "../entities/evidence";
import type { Insight } from "../entities/insight";
import { createEntityId } from "../../life/value-objects/entity-id";
import type { PipelineContext } from "../pipeline-context";
import type { InsightRepository } from "../repositories/insight.repository";
import type { ValidatedInsight } from "../validation/insight-validation-strategy";
import type { PersistStage } from "./persist-stage";

/**
 * Orquesta, nunca persiste directamente — depende de `InsightRepository`,
 * igual que `DefaultCaptureStage`/`DefaultArchiveStage` dependen de
 * `MemoryRepository` en M2. Solo escribe insights con
 * `status === "validated"`, mismo criterio que ya usaba
 * `core/knowledge/pipeline/persist.ts` (legado): un insight rechazado
 * nunca se persiste — no queda rastro suyo en `knowledge_engine_insights`.
 * Deliberadamente sin registro de auditoría de rechazados: mantener el
 * mismo comportamiento ya establecido, no inventar uno nuevo sin que se
 * pida explícitamente (ver Riesgos en el informe de este PR).
 */
export class DefaultPersistStage implements PersistStage {
  constructor(private readonly repository: InsightRepository) {}

  async persist(
    insights: ValidatedInsight[],
    context: PipelineContext,
  ): Promise<void> {
    const toPersist = insights.filter(
      (insight) => insight.status === "validated",
    );

    if (toPersist.length === 0) {
      return;
    }

    const now = new Date();

    for (const validated of toPersist) {
      const insight: Insight = {
        id: createEntityId(crypto.randomUUID()),
        lifeGraphId: context.lifeGraphId,
        type: validated.type,
        description: validated.description,
        confidence: validated.confidence,
        status: validated.status,
        createdAt: now,
        updatedAt: now,
        // Mismo momento en que Validate decidió, no un nuevo "ahora" en
        // Persist — son el mismo evento (Principio 5: Knowledge Time es
        // cuándo LUZ entendió algo, no cuándo se escribió en disco).
        validatedAt: validated.confidence.assignedAt,
      };

      const saved = await this.repository.save(context, insight);

      for (const memoryItem of validated.evidence) {
        const evidence: Evidence = {
          id: createEntityId(crypto.randomUUID()),
          lifeGraphId: context.lifeGraphId,
          insightId: saved.id,
          memoryId: memoryItem.id,
          createdAt: now,
        };

        await this.repository.saveEvidence(context, evidence);
      }
    }
  }
}
