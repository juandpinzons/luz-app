import type { Database } from "../../../core/db/client";
import type { LifeDomainType } from "../../../core/life/value-objects/life-domain-type";
import {
  assembleConversationalVariety,
  toConversationVarietyRuleSignal,
  toCuriosityFatiguedDomain,
  type ConversationVarietyRuleSignal,
} from "../../conversational-variety";

/**
 * El único cruce real `features/chat` -> `features/conversational-variety`
 * -- mismo lugar exacto donde ya viven los otros dos cruces de este
 * tipo (`assemble-reality-snapshot.ts` -> `features/identity-evolution`,
 * `assemble-reconnection-context.ts` -> `features/narrative`), nunca
 * en `features/chat/context-builder/`. Llama a
 * `assembleConversationalVariety` una sola vez y deriva los dos
 * primitivos reducidos que sus dos consumidores reales necesitan --
 * ninguno de los dos recibe el `ConversationVarietySnapshot` completo.
 */
export interface ConversationVarietyContext {
  /** Para `ConversationRuleInput.variety` (`AvoidTopicMonotonyRule`). */
  readonly ruleSignal: ConversationVarietyRuleSignal;
  /** Para `ConversationStrategyRuleInput.fatiguedDomain` (`CuriosityStrategyRule`). */
  readonly fatiguedDomain: LifeDomainType | null;
}

export async function assembleConversationVarietyContext(
  db: Database,
  userId: string,
  now: Date = new Date(),
): Promise<ConversationVarietyContext> {
  const snapshot = await assembleConversationalVariety(db, userId, now);
  return {
    ruleSignal: toConversationVarietyRuleSignal(snapshot),
    fatiguedDomain: toCuriosityFatiguedDomain(snapshot),
  };
}
