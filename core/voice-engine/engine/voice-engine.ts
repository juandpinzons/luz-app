import type { PresenceStance } from "../../presence-engine";
import type { CommunicationPreferenceSnapshot } from "../../reality";
import type { VoiceSignature } from "../entities/voice-signature";

/**
 * Traduce la intención relacional ya decidida (Presence) al estilo
 * propio de LUZ -- nunca decide QUÉ lograr (Conversation Strategy) ni
 * CÓMO estar presente (Presence), nunca genera texto. Determinista,
 * síncrono, sin IO: mismo criterio de testeabilidad que el resto de
 * esta cadena.
 *
 * `communicationStyle` (Fast User Understanding) es el único dato que
 * este engine lee fuera de Presence -- `core/reality` es kernel
 * compartido (ADR-0013), no otro engine, así que leerlo directo no
 * rompe "nunca conoce a otro engine" (mismo criterio que
 * `ConversationStrategyRuleInput.realitySnapshot`). Opcional y con
 * default vacío: todo llamador existente (`speak(stance)`, sin
 * segundo argumento) sigue funcionando exactamente igual.
 */
export interface VoiceEngine {
  speak(
    stance: PresenceStance,
    communicationStyle?: CommunicationPreferenceSnapshot,
  ): VoiceSignature;
}
