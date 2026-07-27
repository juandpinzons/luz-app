import type { PresenceMode, PresenceStance } from "../../presence-engine";
import type { VoiceRegister, VoiceSignature, VoiceWarmth } from "../entities/voice-signature";
import type { VoiceEngine } from "./voice-engine";

/**
 * Límite duro heredado de `FavorBrevityRule` -- "2 a 4 líneas máximo,
 * por encima de cualquier otra instrucción". Este refactor lo
 * consolida aquí como dato; retirar la prosa duplicada de esa regla es
 * el cableado pendiente (ver nota en el reporte de esta sesión), no
 * algo que este archivo haga por su cuenta mientras esa regla siga
 * siendo la única fuente activa en producción.
 */
const DEFAULT_MAX_LINES = 4;
/** Único caso que se aparta del límite general -- ver docblock de `VoiceSignature.maxLines`. */
const SILENCE_MAX_LINES = 1;

/**
 * Mismo contenido que hoy vive en `AvoidParaphrasingRule` (no repetir
 * literalmente lo que la persona acaba de decir),
 * `AvoidUnnecessaryQuestionsRule` (no preguntar si la respuesta no
 * cambiaría lo que dirías) y la cláusula de markdown que
 * `FavorBrevityRule` agregó (sprint de presencia, 2026-07-25) -- una
 * sola fuente, ahora como datos.
 */
const BASE_FORBID = [
  "repetir o citar literalmente lo que la persona acaba de decir",
  "hacer una pregunta cuya respuesta no cambiaría lo que dirías después",
  "usar markdown (**, __, #, guiones de lista, backticks) -- el texto se muestra tal cual, sin renderizar",
  "usar títulos, listas numeradas o secciones -- un mensaje de texto real, no un documento",
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
