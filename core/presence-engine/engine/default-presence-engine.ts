import type {
  ConversationStrategyDirective,
  ConversationStrategyType,
} from "../../conversation-strategy-engine";
import type { PresenceMode } from "../value-objects/presence-mode";
import type { PresenceStance } from "../entities/presence-stance";
import type { PresenceEngine, PresenceEngineOptions } from "./presence-engine";

/**
 * Mapeo de las 10 posturas de Conversation Strategy a los 5 modos
 * relacionales de Presence -- muchos a pocos a propósito:
 * `PRESENCE_PRINCIPLES.md` describe comportamiento, no una taxonomía
 * de 10 casos. `challenge`/`celebrate` se mapean directo (son, en sí
 * mismos, modos relacionales). `encourage`/`plan`/`remind`/`follow_up`/
 * `reflect` son formas distintas de UNA misma presencia -- sostener a
 * la persona en lo que ya está viviendo (Principio 6, Care Without
 * Dependency: acompañar su vida, no dirigirla). `listen`/`clarify`/
 * `curiosity` son formas de escuchar activamente antes que de aportar
 * (Principio 1, Active Listening) -- ninguna resuelve nada todavía.
 */
const STRATEGY_TO_PRESENCE: Record<ConversationStrategyType, PresenceMode> = {
  challenge: "challenge",
  celebrate: "celebrate",
  encourage: "accompany",
  plan: "accompany",
  remind: "accompany",
  follow_up: "accompany",
  reflect: "accompany",
  listen: "listen",
  clarify: "listen",
  curiosity: "listen",
};

const RATIONALE_BY_MODE: Record<PresenceMode, string> = {
  accompany:
    "Hay algo concreto en la vida de la persona que ya está en curso -- sostenerlo es más presencia que dirigirlo.",
  listen:
    "Nada exige actuar todavía -- Principio 1 (Active Listening): responder desde lo específico de este momento, no desde una categoría.",
  celebrate: "Algo bueno acaba de pasar y nada urgente compite por la atención -- reconocerlo antes de avanzar.",
  challenge: "Un patrón ya identificado merece algo más que acompañar con suavidad -- Principio 7, honestidad que compone confianza con el tiempo.",
  silence:
    "Nada cambió lo suficiente para justificar interrumpir -- Principio 4, Intentional Silence: el silencio es una decisión, no una ausencia de capacidad.",
};

/**
 * Determinista, síncrono, sin IO -- ninguna llamada a IA decide el
 * modo relacional, nunca. `"silence"` solo puede salir de aquí cuando
 * el llamador declara explícitamente `allowSilence: true` Y el modo
 * resultante habría sido `"listen"` (la postura de "nada domina" --
 * el único caso donde no decir nada es una alternativa honesta a
 * decir algo). El chat (reactivo: la persona ya escribió, una
 * respuesta es parte del contrato de esa UI) nunca pasa
 * `allowSilence`, así que en producción hoy este modo no se alcanza
 * desde el chat -- queda listo para un consumidor no-reactivo futuro
 * (p. ej. "¿vale la pena que LUZ escriba primero ahora?"), no es
 * código muerto decorativo.
 */
export class DefaultPresenceEngine implements PresenceEngine {
  decide(
    directive: ConversationStrategyDirective,
    options: PresenceEngineOptions = {},
  ): PresenceStance {
    const mapped = STRATEGY_TO_PRESENCE[directive.strategy];
    const mode: PresenceMode =
      options.allowSilence && mapped === "listen" ? "silence" : mapped;

    return { mode, rationale: RATIONALE_BY_MODE[mode] };
  }
}

export function createPresenceEngine(): PresenceEngine {
  return new DefaultPresenceEngine();
}
