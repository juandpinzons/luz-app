import type { PresenceMode, PresenceStance } from "../../presence-engine";
import type { VoiceRegister, VoiceSignature, VoiceWarmth } from "../entities/voice-signature";
import type { VoiceEngine } from "./voice-engine";

/**
 * Límite duro -- "2 a 4 líneas máximo, por encima de cualquier otra
 * instrucción". Única fuente: `AvoidParaphrasingRule`,
 * `AvoidUnnecessaryQuestionsRule` y `FavorBrevityRule` (Conversation
 * Rules) quedaron retiradas cuando este motor se conectó al pipeline
 * real (Fase II) -- su contenido vive aquí, no en dos lugares.
 */
export const DEFAULT_MAX_LINES = 4;
/** Único caso que se aparta del límite general -- ver docblock de `VoiceSignature.maxLines`. */
const SILENCE_MAX_LINES = 1;

/**
 * Consolida el contenido íntegro de las tres Conversation Rules de
 * estilo retiradas (`AvoidParaphrasingRule`, `AvoidUnnecessaryQuestionsRule`,
 * `FavorBrevityRule`) -- incluyendo los dos hallazgos de producción que
 * motivaron sus últimos refuerzos (pilotaje Alpha, día 2 y día 3: el
 * caso de Oscar preguntando "cómo podrías ayudarme" y recibiendo una
 * lista de 4 viñetas). Única fuente de verdad para qué evitar en el
 * estilo de una respuesta -- ninguna otra capa vuelve a decidir esto.
 */
const BASE_FORBID = [
  "repetir o citar literalmente lo que la persona acaba de decir",
  "hacer una pregunta cuya respuesta no cambiaría lo que dirías después",
  "usar markdown (**, __, #, guiones de lista, backticks) -- el texto se muestra tal cual, sin renderizar",
  "usar títulos, listas numeradas o secciones -- un mensaje de texto real, no un documento",
  "responder con un menú o lista de capacidades cuando te preguntan qué puedes hacer o cómo puedes ayudar -- una o dos frases concretas y sigue con una pregunta o propuesta, igual que con cualquier otro mensaje",
  "extenderte más allá del límite de líneas aunque sientas que el tema necesita más espacio -- es señal de que estás resolviendo en vez de acompañar; responde corto y, si hace falta, continúa en el siguiente mensaje",
];

const REGISTER_BY_MODE: Record<PresenceMode, VoiceRegister> = {
  accompany: "cercano",
  celebrate: "cercano",
  listen: "sereno",
  silence: "sereno",
  challenge: "directo",
};

const WARMTH_BY_MODE: Record<PresenceMode, VoiceWarmth> = {
  accompany: "alta",
  celebrate: "alta",
  listen: "media",
  silence: "media",
  challenge: "media",
};

/**
 * Determinista -- deriva de `PresenceStance.mode`, nunca de una
 * llamada a IA. `LUZ_IDENTITY.traits` (`core/persona`: calmada,
 * confiable, paciente, honesta, respetuosa) es la fuente de fondo de
 * `BASE_FORBID`/`WARMTH_BY_MODE`/`REGISTER_BY_MODE` -- ya
 * documentado en esos value objects, no vuelto a citar aquí para no
 * mantener dos copias del mismo razonamiento.
 */
export class DefaultVoiceEngine implements VoiceEngine {
  speak(stance: PresenceStance): VoiceSignature {
    return {
      register: REGISTER_BY_MODE[stance.mode],
      warmth: WARMTH_BY_MODE[stance.mode],
      maxLines: stance.mode === "silence" ? SILENCE_MAX_LINES : DEFAULT_MAX_LINES,
      forbid: [...BASE_FORBID],
    };
  }
}

export function createVoiceEngine(): VoiceEngine {
  return new DefaultVoiceEngine();
}
