import type { EntityId } from "./value-objects/entity-id";

/**
 * Identidad de dominio para todo lo que vive dentro de un `LifeGraph`
 * (ADR-0011). Sucesor de `UserContext` para este módulo: en vez de un
 * id de cuenta, lleva la frontera de tenencia (`lifeGraphId`) y quién,
 * dentro de ese grafo, está actuando (`personId`).
 *
 * `auth/user-context.ts` será el único lugar que sepa resolver un
 * AccountId hacia este contrato — todavía no lo hace. Memory, Knowledge
 * y el resto de la app siguen recibiendo `UserContext`
 * (`core/identity/user-context.ts`) hasta que se migren en su propio
 * milestone; ambos contratos conviven a propósito mientras dure la
 * migración incremental.
 */
export interface LifeGraphContext {
  lifeGraphId: EntityId;
  personId: EntityId;
}
