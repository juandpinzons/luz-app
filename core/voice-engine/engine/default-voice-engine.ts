import type { PresenceMode, PresenceStance } from "../../presence-engine";
import type { CommunicationPreferenceSnapshot } from "../../reality";
import type { VoiceRegister, VoiceSignature, VoiceWarmth } from "../entities/voice-signature";
import type { VoiceEngine } from "./voice-engine";

const NO_COMMUNICATION_STYLE: CommunicationPreferenceSnapshot = { items: [] };

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
  /**
   * P0 -- Founder, 2026-08-03: incidente real (montos de gastos de agosto
   * 1-2) donde, ante datos incompletos, la respuesta generó un total
   * numérico en vez de reconocer el vacío. Ver
   * `docs/engineering/investigations/2026-08-02_memory_recall_value_change.md`
   * y `docs/vision/PRESENCE_PRINCIPLES.md` Principio 9 (Zero Fabrication
   * for Personal Data). No resuelve la causa raíz (el vacío de
   * recuperación de memoria de bajo rank, ya diagnosticado y fuera del
   * alcance de este motor) -- resuelve que, cuando el dato no está,
   * LUZ nunca lo reemplace por un número inventado.
   */
  "inventar, redondear o estimar un monto, fecha, total o dato histórico que no puedas trazar directamente a algo que la persona realmente dijo -- si falta información para sumar o precisar algo, dilo directamente (\"no tengo ese dato completo\") y pide lo que falta, nunca completes el hueco con un número que solo suene razonable",
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
  speak(
    stance: PresenceStance,
    communicationStyle: CommunicationPreferenceSnapshot = NO_COMMUNICATION_STYLE,
  ): VoiceSignature {
    return {
      register: REGISTER_BY_MODE[stance.mode],
      warmth: WARMTH_BY_MODE[stance.mode],
      maxLines: stance.mode === "silence" ? SILENCE_MAX_LINES : DEFAULT_MAX_LINES,
      forbid: [...BASE_FORBID],
      userPreferenceNotes: communicationStyle.items.map((item) => item.statement),
    };
  }
}

export function createVoiceEngine(): VoiceEngine {
  return new DefaultVoiceEngine();
}
