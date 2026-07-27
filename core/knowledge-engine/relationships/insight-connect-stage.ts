import type { LifeGraphContext } from "../../life/life-graph-context";
import type { EntityId } from "../../life/value-objects/entity-id";
import type { InsightRelationship } from "../entities/insight-relationship";

/**
 * Relaciona un insight ya persistido con otros insights ya persistidos.
 * No interpreta la relación -- mismo contrato que `ConnectStage`
 * (`core/memory-engine/lifecycle/connect-stage.ts`) aplicado a Insight
 * en vez de Memory: ambos conectan una entidad recién guardada con lo
 * que ya existe, a partir de un hecho verificable, nunca de una
 * interpretación de significado.
 */
export interface InsightConnectStage {
  connect(
    context: LifeGraphContext,
    insightId: EntityId,
  ): Promise<InsightRelationship[]>;
}
