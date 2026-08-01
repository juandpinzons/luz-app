import type { LoopClosureResult } from "./loop-closure-result";

/**
 * Cierre por señal humana explícita -- misión ejemplo "explicit
 * abandonment". A diferencia de toda otra regla en este módulo, esta
 * NUNCA se auto-detecta: no existe forma determinista de inferir "la
 * persona ya no quiere que LUZ siga esto" a partir de datos, requiere
 * una acción explícita de un consumidor futuro (chat, UI). Expuesta
 * como contrato puro -- misión: "Do NOT deeply integrate yet. Expose
 * clean contracts" -- para que ese consumidor futuro tenga una función
 * lista, sin tener que reinventar la forma de `LoopEvidence`.
 */
export function abandonLoopExplicitly(reason: string, now: Date = new Date()): LoopClosureResult {
  return {
    evidence: {
      kind: "user_explicit_abandon",
      observedAt: now,
      description: reason,
    },
    toState: "abandoned",
  };
}
