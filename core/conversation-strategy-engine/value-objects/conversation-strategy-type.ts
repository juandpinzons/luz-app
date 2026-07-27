/**
 * Las ocho posturas conversacionales que LUZ puede adoptar antes de
 * llamar al LLM (Fase II, Sprint "Conversational Strategy Engine") —
 * el modelo recibe cuál ya se decidió, nunca decide esto por su
 * cuenta. `follow_up` en snake_case como el resto del vocabulario
 * interno del dominio (`ContextItemSource`, `ResponseIntent`); la
 * presentación (`FollowUp`) es responsabilidad de quien renderiza el
 * prompt, no de este value object (`features/chat`, no `core/`).
 */
export const CONVERSATION_STRATEGY_TYPES = [
  "listen",
  "clarify",
  "encourage",
  "challenge",
  "celebrate",
  "remind",
  "plan",
  "follow_up",
  "curiosity",
] as const;

export type ConversationStrategyType = (typeof CONVERSATION_STRATEGY_TYPES)[number];
