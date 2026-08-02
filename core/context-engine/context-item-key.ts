import type { ContextItem } from "./entities/context";

/**
 * Identificador estable de un `ContextItem` para el sistema de
 * diversidad conversacional (redesign del pipeline conversacional,
 * Beta) -- `null` para fuentes sin id propio (`signal`, ver docblock
 * de `ContextItem.sourceId`), que quedan fuera del cálculo de
 * repetición a propósito: no hay nada que reconocer como "lo mismo de
 * antes" sin un id real. Única función que construye esta clave --
 * tanto quien la escribe (`conversation-signal-log.ts`, al guardar qué
 * ganó un turno) como quien la lee (`DeterministicContextScoringStrategy`,
 * al penalizar repetición) la llaman a esta, nunca reconstruyen el
 * formato por su cuenta.
 */
export function contextItemKey(item: Pick<ContextItem, "source" | "sourceId">): string | null {
  return item.sourceId ? `${item.source}:${item.sourceId}` : null;
}
