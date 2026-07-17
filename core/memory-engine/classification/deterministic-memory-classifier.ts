import type { LifeGraphContext } from "../../life/life-graph-context";
import type { MemoryType } from "../value-objects/memory-type";
import type { MemoryClassifier } from "./memory-classifier";

/**
 * Señales por palabra clave (ES/EN), en el orden de prioridad que pide
 * la filosofía de LUZ: identidad, relaciones, metas, valores,
 * preferencias, hábitos y eventos significativos profundizan la
 * comprensión de la persona más que un hecho genérico — nunca la
 * recencia, que ni siquiera es un input de este método. El orden de
 * este arreglo ES el criterio de desempate: ante un empate de señales,
 * gana el tipo que aparece primero aquí.
 *
 * `pattern` queda deliberadamente fuera: reconocer un patrón requiere
 * comparar varias memorias entre sí, no leer una sola — no es
 * alcanzable con palabras clave sobre un único contenido. Un futuro
 * engine puede asignarlo; este clasificador nunca lo hace.
 */
const TYPE_SIGNALS: ReadonlyArray<{
  type: Exclude<MemoryType, "pattern" | "fact">;
  keywords: readonly string[];
}> = [
  {
    type: "relationship",
    keywords: [
      "mi pareja",
      "mi esposa",
      "mi esposo",
      "mi novia",
      "mi novio",
      "mi madre",
      "mi padre",
      "mi mamá",
      "mi papá",
      "mi hijo",
      "mi hija",
      "mi hermano",
      "mi hermana",
      "mi amigo",
      "mi amiga",
      "mi jefe",
      "mi familia",
      "relación",
      "amistad",
      "my partner",
      "my wife",
      "my husband",
      "my girlfriend",
      "my boyfriend",
      "my mother",
      "my father",
      "my son",
      "my daughter",
      "my brother",
      "my sister",
      "my friend",
      "my boss",
      "my family",
      "relationship",
      "friendship",
    ],
  },
  {
    type: "goal",
    keywords: [
      "mi meta",
      "mi objetivo",
      "aspiro a",
      "quiero lograr",
      "quiero conseguir",
      "mi sueño",
      "my goal",
      "i aim to",
      "i want to achieve",
      "i'm working towards",
      "my dream",
    ],
  },
  {
    type: "preference",
    keywords: [
      "me gusta",
      "me encanta",
      "prefiero",
      "no me gusta",
      "odio",
      "detesto",
      "creo en",
      "valoro",
      "para mí es importante",
      "i like",
      "i love",
      "i prefer",
      "i dislike",
      "i hate",
      "i value",
      "it matters to me",
      "i believe in",
    ],
  },
  {
    type: "ritual",
    keywords: [
      "todos los días",
      "cada mañana",
      "cada semana",
      "cada noche",
      "siempre que",
      "por rutina",
      "de costumbre",
      "every day",
      "every morning",
      "every week",
      "every night",
      "as a routine",
      "usually i",
      "i always",
    ],
  },
  {
    type: "event",
    keywords: [
      "me casé",
      "nació",
      "me gradué",
      "empecé a trabajar",
      "me mudé",
      "falleció",
      "cumpleaños",
      "aniversario",
      "i got married",
      "was born",
      "i graduated",
      "i started working",
      "i moved",
      "passed away",
      "birthday",
      "anniversary",
    ],
  },
  {
    type: "intention",
    keywords: [
      "voy a",
      "planeo",
      "tengo la intención de",
      "pretendo",
      "i'm going to",
      "i intend to",
      "i plan on",
    ],
  },
];

/** Tipo de reserva cuando ninguna señal coincide: el más neutral, el que menos presupone. */
const DEFAULT_TYPE: MemoryType = "fact";

/**
 * Determinista y sin llamadas a IA a propósito (M2/PR-010): el
 * objetivo de esta fase es un Memory Engine correcto y confiable, no
 * todavía uno inteligente. Implementa `MemoryClassifier` como
 * cualquier otra estrategia — reemplazarla por una más sofisticada
 * (ej. basada en LLM) más adelante es escribir otra clase, sin tocar
 * el contrato ni ningún llamador.
 */
export class DeterministicMemoryClassifier implements MemoryClassifier {
  async classify(
    _context: LifeGraphContext,
    content: string,
  ): Promise<MemoryType> {
    const normalized = content.toLowerCase();

    let bestType: MemoryType = DEFAULT_TYPE;
    let bestScore = 0;

    for (const { type, keywords } of TYPE_SIGNALS) {
      const score = keywords.reduce(
        (count, keyword) => (normalized.includes(keyword) ? count + 1 : count),
        0,
      );

      if (score > bestScore) {
        bestScore = score;
        bestType = type;
      }
    }

    return bestType;
  }
}
