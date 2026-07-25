import type {
  ConversationRule,
  ConversationRuleInput,
} from "./conversation-rule";

/**
 * `docs/product/CONVERSATION_MANUAL_V1.md` no tiene una línea
 * literal para esto, pero se deriva directamente de "Qué merece
 * convertirse en memoria" (el Manual ya asume que lo memorizado no se
 * vuelve a preguntar) y del hallazgo de investigación `PE2`
 * (`docs/research/HUMAN_BEHAVIOR_PATTERNS.md`) sobre información
 * auto-declarada. Distinta de `FavorPrioritizedContextRule` — esta
 * regla no dice "conecta con el pasado", dice "no le pidas de nuevo lo
 * que ya sabes" — son dos comportamientos separados que comparten una
 * condición de activación parecida, a propósito no fusionados en una
 * sola regla.
 *
 * Dispara con `memory` o `life` (Context Engine, Fase II) — ambas son
 * hechos ya registrados sobre la persona (qué pasó, qué está
 * trabajando activamente), a diferencia de `insight`, que es una
 * interpretación, no un dato puntual que tenga sentido "no volver a
 * pedir".
 */
export class AvoidRepeatingKnownInfoRule implements ConversationRule {
  readonly id = "avoid-repeating-known-info";

  applies(input: ConversationRuleInput): boolean {
    return input.contextItems.some(
      (item) => item.source === "memory" || item.source === "life",
    );
  }

  directive(_input: ConversationRuleInput): string {
    return "No le pidas a la persona información que ya está registrada en la memoria o el estado de vida relevante de arriba — dala por conocida, salvo que ella la mencione de nuevo.";
  }
}
