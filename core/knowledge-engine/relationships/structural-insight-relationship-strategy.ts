import type { RealityMemoryItem } from "../../reality/memory-context-snapshot";
import type { RealitySnapshot } from "../../reality/reality-snapshot";
import type { EntityId } from "../../life/value-objects/entity-id";
import type { ClassifiedItem } from "../lifecycle/classify-stage";
import type { PipelineContext } from "../pipeline-context";
import type {
  InsightRelationshipStrategy,
  RelatedItem,
} from "./insight-relationship-strategy";

/**
 * Largo mínimo de un token para contar como señal — descarta palabras
 * cortas/funcionales (ES/EN: "de", "la", "el", "que", "the", "and")
 * sin necesitar una lista de stopwords completa. Igual que
 * `DeterministicClassifyStage`, esto es coincidencia de texto literal,
 * nunca similitud semántica.
 */
const MIN_TOKEN_LENGTH = 4;

/**
 * Cuántas palabras significativas distintas deben coincidir para que
 * una memoria cuente como estructuralmente relacionada por contenido —
 * conservador a propósito: una sola palabra compartida ("trabajo",
 * "familia") es demasiado común para ser una señal confiable por sí
 * sola. Punto de partida revisable, no una medida (misma honestidad que
 * `VALIDATION_CONFIDENCE_THRESHOLD` en PR-3).
 */
const MIN_SHARED_TOKENS = 2;

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length >= MIN_TOKEN_LENGTH),
  );
}

function countShared(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  let count = 0;
  for (const token of a) {
    if (b.has(token)) {
      count += 1;
    }
  }
  return count;
}

/**
 * Detectores de relación estructural — mismo patrón que
 * `DefaultConnectStage` (`core/memory-engine`): cada uno produce
 * candidatos a partir de un hecho verificable, nunca de una
 * interpretación de significado. Pensada para crecer: una futura señal
 * (mismo `GoalId`/`ProjectId` una vez Knowledge los referencie) es otro
 * detector más aquí, no un rediseño de esta etapa.
 */

/**
 * La memoria que disparó esta corrida (`context.memoryId`) siempre
 * cuenta como relacionada — coincidencia de identidad, la señal
 * estructural más fuerte posible (igual que `sameOriginMatches` en
 * `DefaultConnectStage`). Garantiza que todo lo extraído en esta
 * corrida pueda siempre explicarse por al menos la memoria de origen
 * (Principio 3), incluso cuando Extract parafraseó tanto que ya no
 * comparte palabras literales con ella.
 */
function triggeringMemoryMatches(
  memoryItems: readonly RealityMemoryItem[],
  context: PipelineContext,
): RealityMemoryItem[] {
  return memoryItems.filter((memoryItem) => memoryItem.id === context.memoryId);
}

/** Coincidencia de contenido: palabras significativas compartidas por encima del umbral. */
function sharedKeywordMatches(
  item: ClassifiedItem,
  memoryItems: readonly RealityMemoryItem[],
): RealityMemoryItem[] {
  const itemTokens = tokenize(item.text);

  if (itemTokens.size === 0) {
    return [];
  }

  return memoryItems.filter(
    (memoryItem) =>
      countShared(itemTokens, tokenize(memoryItem.content)) >= MIN_SHARED_TOKENS,
  );
}

/**
 * Determinista y sin llamadas a IA a propósito — primera iteración de
 * una capacidad que seguirá evolucionando, no una limitación. Implementa
 * `InsightRelationshipStrategy` como cualquier otra estrategia:
 * sustituirla después (embeddings, similitud semántica sobre el mismo
 * texto) es escribir otra clase, sin tocar el contrato ni ningún
 * llamador.
 *
 * Compara texto porque `RealityMemoryItem.content` es la única fuente
 * con datos reales hoy — no porque `InsightRelationshipStrategy` exija
 * texto (ver el docblock del contrato). Una fuente futura no textual
 * (Calendar, ubicación, sensores) no se resolvería extendiendo esta
 * clase: sería una implementación hermana del mismo contrato, con sus
 * propios detectores de hecho verificable (superposición de ventana de
 * tiempo, proximidad geográfica...) — este archivo seguiría intacto.
 *
 * Nunca lee `personId`: relacionar depende de qué memorias comparten
 * origen o contenido con el ítem, nunca de quién es la persona — misma
 * disciplina que PR-2 y PR-3.
 */
export class StructuralInsightRelationshipStrategy
  implements InsightRelationshipStrategy
{
  async relate(
    snapshot: RealitySnapshot,
    items: ClassifiedItem[],
    context: PipelineContext,
  ): Promise<RelatedItem[]> {
    const memoryItems = snapshot.memory.items;

    return items.map((item) => {
      const matches = new Map<EntityId, RealityMemoryItem>();

      for (const match of triggeringMemoryMatches(memoryItems, context)) {
        matches.set(match.id, match);
      }
      for (const match of sharedKeywordMatches(item, memoryItems)) {
        matches.set(match.id, match);
      }

      return {
        ...item,
        relatedMemories: Array.from(matches.values()),
      };
    });
  }
}
