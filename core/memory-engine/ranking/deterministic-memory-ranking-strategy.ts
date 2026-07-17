import type { LifeGraphContext } from "../../life/life-graph-context";
import type { Memory } from "../entities/memory";
import type { MemoryRank } from "../value-objects/memory-rank";
import type { MemoryRankingStrategy } from "./memory-ranking-strategy";

/**
 * Categorías de señal (ES/EN) que, cuando aparecen en el contenido,
 * indican que esta memoria representa un salto — no solo un dato más
 * — en lo que LUZ entiende de la persona: una transición de vida, una
 * decisión importante, un valor revelado, una vulnerabilidad, un
 * punto de quiebre emocional, un cambio relacional, crecimiento
 * personal, una lucha recurrente autodescrita, o una aspiración de
 * largo plazo.
 *
 * Deliberadamente independiente de `memory.type` (Classification) y
 * de `personId`: el tipo describe QUÉ es la memoria, esto mide CUÁNTO
 * profundiza la comprensión de la persona — ninguna de las dos cosas
 * se deriva de la otra, y una memoria sin `personId` puede llegar a
 * 100 igual que cualquier otra.
 *
 * "Lucha recurrente" solo detecta cuando la persona misma describe la
 * recurrencia dentro de esta memoria ("otra vez me pasa lo mismo") —
 * nunca la infiere comparando esta memoria contra otras. Reconocer un
 * patrón real a través del tiempo es responsabilidad de Knowledge, no
 * de Memory (mismo límite ya trazado en
 * classification/deterministic-memory-classifier.ts para `pattern`).
 */
const UNDERSTANDING_SIGNALS: ReadonlyArray<{
  category: string;
  keywords: readonly string[];
}> = [
  {
    category: "life_transition",
    keywords: [
      "me mudé",
      "empecé a trabajar",
      "dejé mi trabajo",
      "renuncié",
      "me gradué",
      "me casé",
      "nos divorciamos",
      "nos separamos",
      "nació",
      "falleció",
      "i moved",
      "i quit my job",
      "i started working",
      "i graduated",
      "i got married",
      "we got divorced",
      "we separated",
      "was born",
      "passed away",
    ],
  },
  {
    category: "important_decision",
    keywords: [
      "decidí",
      "tomé la decisión de",
      "elegí",
      "opté por",
      "i decided",
      "i made the decision to",
      "i chose to",
    ],
  },
  {
    category: "revealed_value",
    keywords: [
      "lo que más valoro",
      "creo firmemente",
      "para mí lo más importante es",
      "mi principio es",
      "what matters most to me",
      "i believe deeply",
      "my core value is",
    ],
  },
  {
    category: "vulnerability",
    keywords: [
      "me cuesta",
      "tengo miedo de",
      "me siento inseguro",
      "es difícil para mí admitir",
      "me siento perdido",
      "i'm afraid of",
      "i feel insecure",
      "it's hard for me to admit",
      "i feel lost",
    ],
  },
  {
    category: "emotional_turning_point",
    keywords: [
      "todo cambió cuando",
      "me di cuenta de que",
      "fue un punto de quiebre",
      "everything changed when",
      "i realized that",
      "it was a turning point",
    ],
  },
  {
    category: "relationship_change",
    keywords: [
      "nos distanciamos",
      "nos reconciliamos",
      "rompimos la comunicación",
      "recuperamos la confianza",
      "we grew apart",
      "we reconciled",
      "we stopped talking",
      "we rebuilt trust",
    ],
  },
  {
    category: "personal_growth",
    keywords: [
      "he crecido mucho",
      "estoy trabajando en mí mismo",
      "he aprendido a",
      "logré superar",
      "i've grown a lot",
      "i'm working on myself",
      "i've learned to",
      "i managed to overcome",
    ],
  },
  {
    category: "recurring_struggle",
    keywords: [
      "otra vez me pasa lo mismo",
      "siempre termino",
      "una y otra vez",
      "cada vez que esto pasa",
      "it happens again",
      "i always end up",
      "over and over",
      "every time this happens",
    ],
  },
  {
    category: "long_term_aspiration",
    keywords: [
      "algún día quiero",
      "mi sueño es",
      "aspiro a convertirme en",
      "a largo plazo quiero",
      "someday i want to",
      "my dream is to",
      "i aspire to become",
      "in the long run i want",
    ],
  },
];

/**
 * Puntaje base según cuántas categorías DISTINTAS de comprensión se
 * detectaron — con retornos decrecientes a propósito: la primera señal
 * mueve el puntaje mucho más que la quinta, porque cada señal
 * adicional refuerza que la memoria es reveladora sin multiplicar
 * linealmente. Los saltos entre niveles (30, 20, 15, 10, 10) están
 * todos por encima del bono de recencia (máximo 4): la recencia nunca
 * puede cruzar un nivel de comprensión, solo desempatar dentro de uno.
 */
const BASE_SCORE_BY_MATCH_COUNT = [15, 45, 65, 80, 90, 100] as const;

/**
 * El puntaje que obtiene una memoria con exactamente una señal de
 * comprensión detectada — expuesto para que otras etapas (ver
 * lifecycle/default-connect-stage.ts) puedan usar "al menos una señal
 * de comprensión" como criterio de calidad, en vez de inventar su
 * propio número.
 */
export const MIN_SCORE_WITH_UNDERSTANDING_SIGNAL = BASE_SCORE_BY_MATCH_COUNT[1];

const MAX_RECENCY_BONUS_DAYS = 28;
const MAX_RECENCY_BONUS = 4;

function scoreByMatchCount(matchCount: number): number {
  const index = Math.min(matchCount, BASE_SCORE_BY_MATCH_COUNT.length - 1);
  return BASE_SCORE_BY_MATCH_COUNT[index];
}

/**
 * 0 a +4, decayendo a 0 en ~4 semanas — nunca negativo. Una memoria
 * vieja de alto valor jamás pierde prioridad por su edad: la recencia
 * solo puede acercar dos memorias de valor similar, nunca invertir el
 * orden entre una de más valor y una de menos.
 */
function recencyBonus(referenceDate: Date, now: Date): number {
  const ageDays = Math.max(
    0,
    (now.getTime() - referenceDate.getTime()) / (1000 * 60 * 60 * 24),
  );
  const decayedDays = Math.floor(
    (ageDays / MAX_RECENCY_BONUS_DAYS) * MAX_RECENCY_BONUS,
  );

  return Math.max(0, MAX_RECENCY_BONUS - decayedDays);
}

/**
 * Determinista y sin llamadas a IA a propósito (M2/PR-014, mismo
 * principio que DeterministicMemoryClassifier): el objetivo de esta
 * fase es un Memory Engine correcto y confiable, no todavía uno
 * inteligente. No depende de `MemoryRepository` ni compara esta
 * memoria contra otras — reconocer tendencias reales a través del
 * tiempo es Knowledge, no esta estrategia. Implementa
 * `MemoryRankingStrategy` como cualquier otra estrategia: reemplazarla
 * más adelante es escribir otra clase, sin tocar el contrato ni
 * ningún llamador.
 */
export class DeterministicMemoryRankingStrategy
  implements MemoryRankingStrategy
{
  async rank(_context: LifeGraphContext, memory: Memory): Promise<MemoryRank> {
    const normalized = memory.content.toLowerCase();

    const matchCount = UNDERSTANDING_SIGNALS.filter(({ keywords }) =>
      keywords.some((keyword) => normalized.includes(keyword)),
    ).length;

    const now = new Date();
    const referenceDate = memory.occurredAt ?? memory.createdAt;

    const score = Math.min(
      100,
      scoreByMatchCount(matchCount) + recencyBonus(referenceDate, now),
    );

    return { score, rankedAt: now };
  }
}
