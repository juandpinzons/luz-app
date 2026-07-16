declare const entityIdBrand: unique symbol;

/**
 * Identificador de una entidad del Life Graph. Marcado con un símbolo
 * único para que TypeScript no permita mezclar un EntityId con
 * cualquier otro string (p. ej. un userId) por accidente.
 */
export type EntityId = string & { readonly [entityIdBrand]: true };

export function createEntityId(value: string): EntityId {
  if (!value) {
    throw new Error("EntityId: el valor no puede estar vacío.");
  }
  return value as EntityId;
}
