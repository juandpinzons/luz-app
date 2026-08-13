import { detectCrisisSignal } from "../features/chat/services/detect-crisis-signal";
import type { SmokeFlow } from "./types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * `detectCrisisSignal` es una función pura -- sin red, sin DB, mismo
 * criterio que `ai-provider-registry.test.ts`. Cubre las dos formas de
 * falla que más importan: un falso negativo real (frase explícita que
 * no dispara) y el falso positivo ya identificado antes de desplegar
 * (el modismo "morir(me) de <emoción>", el caso más común en español
 * real que colisiona con la familia de señales "blandas").
 */
export const crisisSignalFlow: SmokeFlow = {
  name: "crisis-signal",
  async run() {
    const shouldDetect = [
      "quiero morirme, ya no aguanto",
      "llevo días pensando en suicidarme",
      "lo único que pienso es en quitarme la vida",
      "creo que sería mejor matarme",
      "I just want to kill myself",
      "SUICIDIO es lo único que pienso",
      "me quiero morir, de verdad, no es exageración",
    ];
    for (const message of shouldDetect) {
      assert(
        detectCrisisSignal(message),
        `debía detectar señal de crisis en: "${message}"`,
      );
    }

    const shouldNotDetect = [
      "perdí mi casa en el terremoto y tengo mucho miedo",
      "me siento devastada, no sé qué hacer",
      "me muero de la risa con ese meme, gracias por la distracción",
      "me quiero morir de la vergüenza, dije algo torpe en la reunión",
      "I could die of embarrassment right now",
      "no aguanto más este tráfico",
      "hola, ¿cómo estás?",
    ];
    for (const message of shouldNotDetect) {
      assert(
        !detectCrisisSignal(message),
        `NO debía detectar señal de crisis en: "${message}"`,
      );
    }
  },
};
