export const VOICE_REGISTERS = ["cercano", "sereno", "directo"] as const;
export type VoiceRegister = (typeof VOICE_REGISTERS)[number];

export const VOICE_WARMTH_LEVELS = ["alta", "media"] as const;
export type VoiceWarmth = (typeof VOICE_WARMTH_LEVELS)[number];

/**
 * Cómo suena LUZ en esta respuesta puntual -- dato estructurado, nunca
 * una frase de prompt ya redactada. Quien finalmente arma el mensaje
 * `system` para el LLM (hoy `render-context.ts`) es responsable de
 * traducir esto a texto; `core/voice-engine` nunca sabe que existe un
 * LLM del otro lado, mismo límite que ya protege a Presence Engine y a
 * Conversation Strategy Engine.
 */
export interface VoiceSignature {
  register: VoiceRegister;
  warmth: VoiceWarmth;
  /**
   * Límite duro de líneas -- mismo número y mismo criterio que
   * `FavorBrevityRule` ya impone hoy ("2 a 4 líneas máximo... por
   * encima de cualquier otra instrucción"), ahora como dato en vez de
   * una frase fija. `"silence"` (Presence) es la única excepción real:
   * ahí el límite baja a 1, la expresión más restringida posible de
   * "casi no interrumpir" dentro de un canal que igual espera alguna
   * respuesta (ver docblock de `DefaultPresenceEngine`).
   */
  maxLines: number;
  /**
   * Patrones de estilo prohibidos para esta respuesta -- el mismo
   * contenido que hoy vive repartido en `AvoidParaphrasingRule`/
   * `AvoidUnnecessaryQuestionsRule`/la cláusula de markdown de
   * `FavorBrevityRule`, consolidado aquí como la única fuente. Texto
   * legible (para quien lo traduzca a prompt), pero es dato de esta
   * capa, no prosa ya terminada para el modelo.
   */
  forbid: string[];
}
