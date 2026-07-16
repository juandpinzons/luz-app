import type { EntityId } from "../value-objects/entity-id";

/**
 * Persona real, miembro de exactamente un `LifeGraph` (ADR-0011).
 * `Person` no carga ninguna responsabilidad de frontera: pertenecer al
 * grafo se expresa con `lifeGraphId`, no con un campo que la distinga
 * como "raíz" — quién es el owner del grafo lo decide `LifeGraph.
 * ownerPersonId`, no esta entidad. El vínculo con otro miembro (tipo,
 * cercanía) vive en `Relationship`, no aquí.
 */
export interface Person {
  id: EntityId;
  lifeGraphId: EntityId;
  name: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
