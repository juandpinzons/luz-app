import type { LifeGraph } from "../entities/life-graph";
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
}
