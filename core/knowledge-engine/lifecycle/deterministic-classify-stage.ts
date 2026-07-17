import type { InsightType } from "../value-objects/insight-type";
import type { ClassifiedItem, ClassifyStage } from "./classify-stage";
import type { ExtractedItem } from "./extract-stage";
import type { PipelineContext } from "../pipeline-context";

/**
 * Señales por palabra clave (ES/EN) para los tipos que SÍ pueden
 * reconocerse leyendo un único fragmento extraído, sin comparar contra
 * nada más. El orden es el criterio de desempate: ante un empate de
 * señales, gana el tipo que aparece primero aquí.
 *
 * `pattern` y `recommendation` quedan deliberadamente fuera de esta
 * etapa — no porque Knowledge no pueda reconocerlos, sino porque
 * `ClassifyStage` corre sobre `ExtractedItem[]` aislados, antes de que
 * `InsightRelationshipStrategy` conecte memorias relacionadas
 * (`RelatedItem.relatedMemories`) y antes de que `InsightGenerationStrategy`
 * tenga ese contexto cruzado para proponer algo. Un patrón real
 * requiere corroboración a través de varias memorias — exactamente el
 * límite que `DeterministicMemoryRankingStrategy` ya documentó como
 * "responsabilidad de Knowledge, no de Memory"; aquí seguimos precisando
 * DE CUÁL etapa de Knowledge: Relate/Generate, no Classify. Una
 * `recommendation` tampoco es algo que un fragmento de evidencia
 * describa por sí mismo — es una síntesis que LUZ propone, y esa síntesis
 * vive en Generate. Ninguna de las dos es una limitación de este
 * clasificador: son capacidades que ya tienen una etapa dueña más
 * adelante en el mismo pipeline.
 */
const TYPE_SIGNALS: ReadonlyArray<{
  type: Exclude<InsightType, "pattern" | "recommendation" | "fact">;
  keywords: readonly string[];
}> = [
  {
    type: "risk",
    keywords: [
      "me preocupa",
      "estoy preocupado",
      "estoy preocupada",
      "tengo miedo de",
      "no puedo dejar de",
      "cada vez es peor",
      "me cuesta mucho",
      "estoy agotado",
      "estoy agotada",
      "no he podido dejar",
      "podría perder",
      "estoy en riesgo de",
      "i'm worried about",
      "i'm afraid of",
      "i can't stop",
      "it's getting worse",
      "i'm exhausted",
      "i might lose",
      "i'm at risk of",
      "i'm struggling with",
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
      "valoro",
      "para mí es importante",
      "i like",
      "i love",
      "i prefer",
      "i dislike",
      "i hate",
      "i value",
      "it matters to me",
    ],
  },
];

/** Tipo de reserva cuando ninguna señal coincide: el más neutral, el que menos presupone. */
const DEFAULT_TYPE: InsightType = "fact";

/**
 * Puntaje de `importance` según cuántas palabras clave DISTINTAS
 * respaldan el tipo ganador — con retornos decrecientes: la primera
 * coincidencia mueve el puntaje mucho más que la cuarta. Un ítem sin
 * ninguna señal (tipo por defecto `fact`) recibe el puntaje más bajo,
 * no cero: sigue siendo evidencia real, solo sin una razón fuerte
 * todavía para priorizarla.
 */
const IMPORTANCE_BY_MATCH_COUNT = [20, 55, 75, 90, 100] as const;

function importanceByMatchCount(matchCount: number): number {
  const index = Math.min(matchCount, IMPORTANCE_BY_MATCH_COUNT.length - 1);
  return IMPORTANCE_BY_MATCH_COUNT[index];
}

function classifyOne(item: ExtractedItem): ClassifiedItem {
  const normalized = item.text.toLowerCase();

  let bestType: InsightType = DEFAULT_TYPE;
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

  return {
    ...item,
    type: bestType,
    importance: importanceByMatchCount(bestScore),
  };
}

/**
 * Determinista y sin llamadas a IA a propósito — primera iteración de
 * una capacidad que seguirá evolucionando (correcta hoy, mejor mañana,
 * nunca engañosa sobre lo que hace). Mismo principio que
 * `DeterministicMemoryClassifier` en `core/memory-engine`. Implementa
 * `ClassifyStage` como cualquier otra estrategia: reemplazarla más
 * adelante (LLM, embeddings) es escribir otra clase, sin tocar el
 * contrato ni ningún llamador — ni `DefaultKnowledgeEngine` (una vez
 * exista) sabrá la diferencia.
 *
 * Nunca lee `context`: clasificar el contenido de un `ExtractedItem`
 * no depende de quién es la persona ni de qué memoria disparó esta
 * corrida — la misma disciplina que `DeterministicMemoryClassifier`
 * mantiene con `personId` (M2/PR-014: el tipo nunca varía por quién
 * es la persona, sino por lo que el contenido dice).
 */
export class DeterministicClassifyStage implements ClassifyStage {
  async classify(
    items: ExtractedItem[],
    _context: PipelineContext,
  ): Promise<ClassifiedItem[]> {
    return items.map(classifyOne);
  }
}
