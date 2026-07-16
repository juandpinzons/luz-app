import type { Database } from "../../db/client";
import { evidence, insights } from "../../db/schema";
import type {
  PersistStage,
  PipelineContext,
  ValidatedInsight,
} from "../types";

/**
 * Etapa 6/6: Persist — escribe los insights ya validados junto con su
 * evidencia. A diferencia de las demás etapas, esta sí tiene lógica
 * real en este entregable: es un mapeo directo a `insights`/`evidence`
 * (core/db/schema), sin depender de IA ni de embeddings, así que no
 * hay razón para dejarla como stub.
 */
export class DrizzlePersistStage implements PersistStage {
  constructor(private readonly db: Database) {}

  async persist(
    validatedInsights: ValidatedInsight[],
    context: PipelineContext,
  ): Promise<void> {
    const toPersist = validatedInsights.filter(
      (insight) => insight.status === "validated",
    );

    if (toPersist.length === 0) {
      return;
    }

    await this.db.transaction(async (tx) => {
      for (const insight of toPersist) {
        const [inserted] = await tx
          .insert(insights)
          .values({
            userId: context.userId,
            type: insight.type,
            description: insight.description,
            confidence: insight.confidence,
            status: insight.status,
            validatedAt: new Date(),
          })
          .returning({ id: insights.id });

        if (!inserted) {
          throw new Error("PersistStage: no se pudo insertar el insight.");
        }

        if (insight.evidence.length > 0) {
          await tx.insert(evidence).values(
            insight.evidence.map((source) => ({
              insightId: inserted.id,
              sourceType: source.type,
              sourceId: source.id,
            })),
          );
        }
      }
    });
  }
}
