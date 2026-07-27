import type { PresenceStance } from "../../presence-engine";
import type { VoiceSignature } from "../entities/voice-signature";

/**
 * Traduce la intención relacional ya decidida (Presence) al estilo
 * propio de LUZ -- nunca decide QUÉ lograr (Conversation Strategy) ni
 * CÓMO estar presente (Presence), nunca genera texto. Determinista,
 * síncrono, sin IO: mismo criterio de testeabilidad que el resto de
 * esta cadena.
 */
export interface VoiceEngine {
  speak(stance: PresenceStance): VoiceSignature;
}
