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
   * Límite duro de líneas -- "2 a 4 líneas máximo... por encima de
   * cualquier otra instrucción", como dato en vez de una frase fija.
   * `"silence"` (Presence) es la única excepción real: ahí el límite
   * baja a 1, la expresión más restringida posible de "casi no
   * interrumpir" dentro de un canal que igual espera alguna respuesta
   * (ver docblock de `DefaultPresenceEngine`).
   */
  maxLines: number;
  /**
   * Patrones de estilo prohibidos para esta respuesta -- única fuente
   * de verdad (Fase II: `AvoidParaphrasingRule`/`AvoidUnnecessaryQuestionsRule`/
   * `FavorBrevityRule`, las Conversation Rules que antes tenían este
   * contenido repartido, quedaron retiradas cuando este motor se
   * conectó al pipeline real). Texto legible (para quien lo traduzca a
   * prompt), pero es dato de esta capa, no prosa ya terminada para el
   * modelo.
   */
  forbid: string[];
  /**
   * Frases reales, ya validadas como `Belief`
   * (`category: "communication_style"`, `core/belief-engine`), sobre
   * cómo esta persona prefiere que le hablen -- nunca generadas aquí,
   * nunca reinterpretadas: mismo criterio que `ReflectStrategyRule`
   * comparte una `ReasoningConclusion`, tal cual, sin traducir su
   * significado. Vacío por defecto (`speak()` sin segundo argumento) --
   * la mayoría de las respuestas todavía no tienen ninguna señal real
   * sobre esto.
   */
  userPreferenceNotes: string[];
}
