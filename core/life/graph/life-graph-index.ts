import type { LifeGraphContext } from "../life-graph-context";
import type { EntityId } from "../value-objects/entity-id";
import type { LifeEdge } from "./life-edge";
import type { LifeNode } from "./life-node";

/**
 * Vista de grafo (nodos/aristas) sobre las entidades de `core/life`.
 * Renombrada de `LifeGraph` a `LifeGraphIndex` (ADR-0011) para no
 * colisionar con la entidad `LifeGraph`, el aggregate root del dominio
 * — son conceptos distintos que antes compartían nombre por accidente.
 * Solo la interfaz; la implementación decide si se materializa sobre
 * `entity_relations` o sobre un store dedicado.
 */
export interface LifeGraphIndex {
  getNode(context: LifeGraphContext, id: EntityId): Promise<LifeNode | null>;
  getEdges(
    context: LifeGraphContext,
    nodeId: EntityId,
  ): Promise<LifeEdge[]>;
  addNode(context: LifeGraphContext, node: LifeNode): Promise<void>;
  addEdge(context: LifeGraphContext, edge: LifeEdge): Promise<void>;
}
