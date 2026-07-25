import type { ContextItem } from "../../context-engine";
import type { RealitySnapshot } from "../../reality";
import type { ConversationStrategyDirective } from "../entities/conversation-strategy-directive";
import type { ConversationStrategyType } from "../value-objects/conversation-strategy-type";

/**
 * Lo mínimo que una regla de estrategia necesita — deliberadamente
 * solo tres fuentes, las mismas que ya exige el sprint: `realitySnapshot`
 * (Reality Snapshot, que a su vez ya integró Memory Engine, Knowledge
 * Engine y Life State — nunca una segunda consulta paralela a esos
 * engines), `contextItems` (la salida ya cruzada y recortada de
 * Context Engine) y `isFirstContact`. Nunca el texto crudo de la
 * conversación: decidir el "cómo conversar" a partir de heurísticas de
 * texto libre sería justo el tipo de intuición no-determinista que
 * este engine existe para reemplazar por reglas explicables.
 */
export interface ConversationStrategyRuleInput {
  realitySnapshot: RealitySnapshot;
  contextItems: ContextItem[];
  isFirstContact: boolean;
}

/**
 * Una postura conversacional posible, expresada como comportamiento —
 * mismo patrón que `ConversationRule` (`features/chat/context-builder`)
 * y `ContextFilterStrategy`/`ContextScoringStrategy` (`core/context-engine`):
 * pequeña, independiente, sin conocer a las demás. `id` es la
 * estrategia que esta regla produce — `explain()` siempre devuelve
 * `strategy: this.id`, nunca un valor distinto ni hardcodeado de
 * nuevo.
 *
 * `priority` decide el orden de evaluación dentro de
 * `DefaultConversationStrategyEngine` (mayor primero) — no hay
 * negaciones cruzadas entre reglas ("si no aplica Challenge, entonces
 *..."): cada regla solo describe su propia condición positiva, y el
 * orden por prioridad resuelve los solapamientos, igual que
 * `CONVERSATION_RULES` ya resuelve el suyo por orden de registro.
 */
export interface ConversationStrategyRule {
  readonly id: ConversationStrategyType;
  readonly priority: number;
  appliesTo(input: ConversationStrategyRuleInput): boolean;
  explain(input: ConversationStrategyRuleInput): ConversationStrategyDirective;
}
