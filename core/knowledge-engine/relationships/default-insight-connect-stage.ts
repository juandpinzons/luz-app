import type { LifeGraphContext } from "../../life/life-graph-context";
import { type EntityId, createEntityId } from "../../life/value-objects/entity-id";
import type { InsightRelationship } from "../entities/insight-relationship";
import type { InsightRepository } from "../repositories/insight.repository";
import type { InsightConnectStage } from "./insight-connect-stage";

/**
 * Dos insights que comparten al menos una misma memoria de evidencia
 * están hablando, verificablemente, de lo mismo -- la señal
 * estructural más fuerte posible entre dos insights, igual que "mismo
 * origen exacto" (`sameOriginMatches`, `DefaultConnectStage`) ya lo es
 * entre dos memorias. Máxima fuerza a propósito: no es una similitud
 * aproximada, es la misma evidencia concreta citada dos veces.
 */
const SHARED_EVIDENCE_STRENGTH = 100;
const SHARED_EVIDENCE_RELATION_TYPE = "shared_evidence";

/**
 * Solo relaciona un hecho verificable entre insights ya persistidos --
 * "no interpreta la relación" (ver `insight-connect-stage.ts`), mismo
 * criterio que `DefaultConnectStage` (`core/memory-engine`) ya
 * establece para memorias. Depende únicamente de `InsightRepository`,
 * igual que `DefaultPersistStage` -- no conoce Drizzle directamente.
 *
 * No comprueba relaciones ya existentes antes de guardar: mismo
 * criterio que ya documenta el schema de
 * `knowledge_engine_insight_relationships` (sin constraint de
 * unicidad sobre el par, igual que `memory_connections` -- deduplicar
 * es decisión de la estrategia a lo largo del tiempo, no del schema).
 * Como este stage corre una sola vez, en el momento en que cada
 * insight se persiste (igual que `DefaultConnectStage` corre una sola
 * vez por memoria capturada), cada par de insights solo se evalúa una
 * vez de todas formas -- no hace falta la comprobación.
 */
export class DefaultInsightConnectStage implements InsightConnectStage {
  constructor(private readonly repository: InsightRepository) {}

  async connect(
    context: LifeGraphContext,
    insightId: EntityId,
  ): Promise<InsightRelationship[]> {
    const insight = await this.repository.getById(context, insightId);
    if (!insight) {
      throw new Error(
        `DefaultInsightConnectStage: no existe Insight ${insightId} en este LifeGraph.`,
      );
    }

    const evidence = await this.repository.getEvidence(context, insightId);
    const memoryIds = new Set(evidence.map((item) => item.memoryId));
    if (memoryIds.size === 0) {
      return [];
    }

    const others = (await this.repository.list(context)).filter(
      (candidate) =>
        candidate.id !== insight.id && candidate.status === "validated",
    );

    const now = new Date();
    const relationships: InsightRelationship[] = [];

    for (const other of others) {
      const otherEvidence = await this.repository.getEvidence(context, other.id);
      const sharesEvidence = otherEvidence.some((item) =>
        memoryIds.has(item.memoryId),
      );
      if (!sharesEvidence) {
        continue;
      }

      const relationship: InsightRelationship = {
        id: createEntityId(crypto.randomUUID()),
        lifeGraphId: context.lifeGraphId,
        fromInsightId: insight.id,
        toInsightId: other.id,
        relationType: SHARED_EVIDENCE_RELATION_TYPE,
        strength: SHARED_EVIDENCE_STRENGTH,
        createdAt: now,
      };

      relationships.push(
        await this.repository.saveRelationship(context, relationship),
      );
    }

    return relationships;
  }
}
