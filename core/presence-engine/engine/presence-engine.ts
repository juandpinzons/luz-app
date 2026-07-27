import type { ConversationStrategyDirective } from "../../conversation-strategy-engine";
import type { PresenceStance } from "../entities/presence-stance";

export interface PresenceEngineOptions {
  /**
   * `false` en todo consumidor reactivo (el chat): la persona ya
   * mandó un mensaje, hay una respuesta esperada por contrato de UI,
   * así que `"silence"` no es una opción real ahí -- ver docblock de
   * `DefaultPresenceEngine`. Un futuro consumidor no-reactivo (una
   * decisión de "¿vale la pena escribirle ahora?") es quien pasaría
   * `true`.
   */
  allowSilence?: boolean;
}

/**
 * Decide CÓMO está presente LUZ ahora mismo -- nunca QUÉ debe lograr
 * la respuesta (eso ya lo decidió `ConversationStrategyEngine`), nunca
 * genera texto. Determinista, síncrono, sin IO: mismo criterio de
 * testeabilidad que `ConversationStrategyEngine.select()`.
 */
export interface PresenceEngine {
  decide(
    directive: ConversationStrategyDirective,
    options?: PresenceEngineOptions,
  ): PresenceStance;
}
