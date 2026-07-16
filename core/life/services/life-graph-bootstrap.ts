import type { LifeGraph } from "../entities/life-graph";
import type { Person } from "../entities/person";

export type LifeGraphBootstrapInput = Omit<
  Person,
  "id" | "lifeGraphId" | "createdAt" | "updatedAt"
>;

export interface LifeGraphBootstrapResult {
  lifeGraph: LifeGraph;
  owner: Person;
}

/**
 * Estrategia de creación de un `LifeGraph` nuevo junto con su primer
 * miembro (owner). Orquestar la creación de dos entidades a la vez no
 * es responsabilidad de un repositorio de persistencia puro — por eso
 * vive en `services/` como un factory de aplicación, no en
 * `LifeGraphRepository` (mejora arquitectónica de Milestone 2).
 *
 * Solo la interfaz. La implementación decidirá el orden exacto de
 * persistencia (`LifeGraphRepository.save` + `saveMember`) y la
 * emisión de `LifeGraphCreated`/`PersonAddedToLifeGraph` — ninguna de
 * las dos cosas ocurre todavía.
 */
export interface LifeGraphBootstrap {
  bootstrap(input: LifeGraphBootstrapInput): Promise<LifeGraphBootstrapResult>;
}
