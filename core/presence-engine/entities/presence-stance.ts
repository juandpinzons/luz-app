import type { PresenceMode } from "../value-objects/presence-mode";

/**
 * Lo que Presence Engine le entrega a Voice -- nunca texto, nunca una
 * instrucción de estilo. `rationale` existe por la misma razón que
 * `ConversationStrategyDirective.reason`: cualquier decisión de este
 * dominio debe poder explicarse (Principio 3), incluso una tan
 * pequeña como "por qué este modo y no otro".
 */
export interface PresenceStance {
  mode: PresenceMode;
  rationale: string;
}
