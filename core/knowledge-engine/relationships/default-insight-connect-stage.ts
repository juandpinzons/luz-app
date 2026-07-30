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

    if (others.length === 0) {
      return [];
    }

    // Una sola consulta (`inArray`) para la evidencia de TODOS los
    // demás insights, no una por insight -- antes esto era O(total de
    // insights históricos del LifeGraph) ida-y-vueltas secuenciales en
    // CADA insight nuevo persistido, el peor cuello de botella
    // encontrado en la auditoría de rendimiento (Fase I "Graph
    // Performance"): un grafo de conocimiento que crece con el tiempo
    // (la premisa central de LUZ) volvía cada vez más lento conectar el
    // siguiente insight.
    const otherEvidence = await this.repository.getEvidenceForInsights(
      context,
      others.map((other) => other.id),
    );
    const memoryIdsByOtherInsight = new Map<EntityId, Set<EntityId>>();
    for (const item of otherEvidence) {
      const set = memoryIdsByOtherInsight.get(item.insightId) ?? new Set<EntityId>();
      set.add(item.memoryId);
      memoryIdsByOtherInsight.set(item.insightId, set);
    }

    const matchingOthers = others.filter((other) => {
      const otherMemoryIds = memoryIdsByOtherInsight.get(other.id);
      if (!otherMemoryIds) return false;
      for (const memoryId of otherMemoryIds) {
        if (memoryIds.has(memoryId)) return true;
      }
      return false;
    });

    const now = new Date();

    // Cada relación es una fila independiente -- escribirlas en
    // paralelo es seguro y evita más ida-y-vueltas secuenciales cuando
    // un insight comparte evidencia con varios otros a la vez.
    return Promise.all(
      matchingOthers.map((other) =>
        this.repository.saveRelationship(context, {
          id: createEntityId(crypto.randomUUID()),
          lifeGraphId: context.lifeGraphId,
          fromInsightId: insight.id,
          toInsightId: other.id,
          relationType: SHARED_EVIDENCE_RELATION_TYPE,
          strength: SHARED_EVIDENCE_STRENGTH,
          createdAt: now,
        }),
      ),
    );
  }
}
