import type { LifeGraph } from "../entities/life-graph";
import type { LifeGraphContext } from "../life-graph-context";
import type { Person } from "../entities/person";
import type { EntityId } from "../value-objects/entity-id";

/**
 * Repositorio del aggregate root. No sigue el patrón `LifeRepository<T>`
 * de las demás entidades: ellas se leen dentro de un `LifeGraph` ya
 * resuelto (`LifeGraphContext`), pero el LifeGraph mismo es justo lo
 * que todavía no existe en ese momento — se busca por su propio id.
 *
 * Solo persiste y recupera. Crear un LifeGraph junto con su primer
 * miembro es orquestación entre dos entidades, no una operación de
 * persistencia pura — esa responsabilidad vive en
 * `services/life-graph-bootstrap.ts` (mejora arquitectónica de
 * Milestone 2, corrige el diseño original de este archivo).
 */
export interface LifeGraphRepository {
  getById(id: EntityId): Promise<LifeGraph | null>;
  save(lifeGraph: LifeGraph): Promise<void>;
  getMembers(lifeGraphId: EntityId): Promise<Person[]>;
  saveMember(person: Person): Promise<void>;
  /** Un `LifeGraphContext` por cada LifeGraph existente (`personId` = `ownerPersonId`) -- sin filtro de actividad, este agregado no tiene ese concepto (ver `entities/life-graph.ts`). Una sola consulta, nunca N+1 sobre `getById`. Para jobs batch (p. ej. `continuity-worker`) que necesitan recorrer cada cuenta, nunca para una ruta de request real. */
  listAllContexts(): Promise<LifeGraphContext[]>;
}
