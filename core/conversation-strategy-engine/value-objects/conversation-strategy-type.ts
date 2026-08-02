/**
 * Las posturas conversacionales que LUZ puede adoptar antes de llamar
 * al LLM (Fase II, Sprint "Conversational Strategy Engine") — el
 * modelo recibe cuál ya se decidió, nunca decide esto por su cuenta.
 * `follow_up` en snake_case como el resto del vocabulario interno del
 * dominio (`ContextItemSource`, `ResponseIntent`); la presentación
 * (`FollowUp`) es responsabilidad de quien renderiza el prompt, no de
 * este value object (`features/chat`, no `core/`). `reflect`
 * (Knowledge Engine V2, Reasoning Engine) comparte una
 * `ReasoningConclusion` ya sólida (confianza >=55); `confirm` (Fast
 * User Understanding) es su contraparte para una hipótesis todavía en
 * formación (confianza 30-54) -- nunca se comparte como hecho, se
 * ofrece a confirmar de forma orgánica. `release` (redesign del
 * pipeline conversacional, Beta) es la contraparte de `reflect` para
 * Identity Evolution -- comparte una creencia que dejó de sostenerse
 * (`RealitySnapshot.fadingBeliefs`), en vez de una que se sostiene.
 * `reopen` retoma una intención sin resolver al reabrir una
 * conversación nueva -- distinto de `follow_up` (memoria que se
 * enfrió DENTRO de una conversación en curso, nunca al reabrir).
 * `acknowledge_closure` reconoce que un Goal/Project se completó, con
 * exclusividad real frente a `celebrate` (mismo motivo, dos reglas, un
 * solo ganador por turno vía prioridad).
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
  "reflect",
  "confirm",
  "release",
  "reopen",
  "acknowledge_closure",
] as const;

export type ConversationStrategyType = (typeof CONVERSATION_STRATEGY_TYPES)[number];
