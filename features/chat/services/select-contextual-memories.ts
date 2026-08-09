import type { Database } from "../../../core/db/client";
import type { LifeGraphContext } from "../../../core/life";
import { DeterministicMemoryClassifier } from "../../../core/memory-engine/classification/deterministic-memory-classifier";
import { MIN_SCORE_WITH_UNDERSTANDING_SIGNAL } from "../../../core/memory-engine/ranking/deterministic-memory-ranking-strategy";
import {
  createMemoryEngine,
  DrizzleMemoryRepository,
  type Memory,
} from "../../../core/memory-engine";
import { isAggregationQuery } from "./detect-aggregation-intent";

/**
 * Incremento 1 (dirección del Founder: la inteligencia de selección
 * vive en `features/chat`, Memory Engine sigue siendo solo proveedor
 * de candidatas -- sin tocar su contrato). Antes, 30: internamente,
 * `MemoryEngine.retrieve({limit})` expande esto a un pool de SQL de
 * `min(limit * 3, 150)` (`CANDIDATE_POOL_CEILING`,
 * `structured-memory-retrieval-strategy.ts`) ordenado únicamente por
 * `rankScore` -- con 30, ese pool era 90, dejando cualquier memoria
 * fuera del top-90 por rank sin ninguna posibilidad de competir por
 * texto, sin importar qué tan bien coincidiera con la pregunta (medido
 * contra la distribución real de rank del Founder: ~89 de 179
 * memorias, 50%, nunca entraban).
 *
 * 150 satura ese mismo techo ya existente en Memory Engine (no lo
 * cambia, no lo cruza) -- es el máximo real obtenible sin tocar
 * `core/memory-engine`. Reduce cuánto decide el rank por sí solo
 * (ahora decide "cuáles 150 se ven", no "cuáles 30"); no lo elimina
 * como señal (`RANK_WEIGHT` abajo sigue intacto) ni lo intenta
 * eliminar de Memory Engine, que es exactamente lo que esta dirección
 * pidió no hacer. Límite conocido y declarado: una cuenta con más de
 * 150 memorias activas seguiría teniendo un residuo fuera de alcance
 * -- no resuelto aquí, nombrado explícitamente para la siguiente
 * decisión, no escondido.
 */
const CANDIDATE_POOL_SIZE = 150;
const MIN_TOKEN_LENGTH = 4;
/**
 * War Room 2026-08-09 (P1-7/P1-8): techo más alto solo para preguntas
 * de agregación detectadas (`isAggregationQuery`) -- el límite normal
 * (5, `RELEVANT_MEMORY_LIMIT`) nunca alcanza para sumar varias
 * menciones reales. Sigue acotado -- nunca la lista completa de la
 * persona, mismo espíritu que `CANDIDATE_POOL_SIZE` ya establece.
 */
const AGGREGATION_LIMIT = 15;

/** Igual que `sameOriginMatches`/`samePersonMatches` en DefaultConnectStage — coincidencia estructural, nunca similitud semántica. */
const SHARED_TOKEN_WEIGHT = 20;
const TYPE_MATCH_BONUS = 15;
const RANK_WEIGHT = 0.3;

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
    if (b.has(token)) count += 1;
  }
  return count;
}

/**
 * Selecciona qué memorias necesita recordar LUZ para ESTE mensaje — no
 * las de mayor score global (P0, cierre del Alpha: "LUZ no debe
 * recordar 'lo más importante de toda la vida', debe recordar lo más
 * relevante para este mensaje"). Reutiliza únicamente lo que ya existe
 * — sin embeddings, sin infraestructura nueva:
 *
 * - `retrieve()` (ya real) trae un lote de candidatas más amplio que el
 *   límite final, todavía ordenado por rank — sigue siendo la única
 *   consulta a la base de datos para candidatas.
 * - `DeterministicMemoryClassifier` (ya real, ya usado en `capture()`)
 *   clasifica el mensaje actual — coincidir de tipo con una candidata
 *   es una señal real de relevancia.
 * - La misma heurística de palabras compartidas que ya usa
 *   `StructuralInsightRelationshipStrategy` (`core/knowledge-engine`)
 *   —duplicada aquí a propósito, no importada: Memory Engine no debe
 *   depender de Knowledge Engine, la dirección de dependencia va al
 *   revés.
 * - `rank.score` (ya real) sigue pesando, pero como una señal más,
 *   nunca como el único criterio de orden.
 * - `MemoryConnection` (ya real): si la mejor coincidencia tiene
 *   memorias conectadas que no entraron por contenido, se agregan
 *   hasta completar el límite — "esto se conecta con aquello" es
 *   memoria activa, no solo recuperación por texto.
 *
 * Primera iteración de una capacidad que seguirá evolucionando (pesos
 * ajustables, no una fórmula final) — nunca una limitación permanente.
 *
 * War Room 2026-08-09 (P1-7/P1-8, `ALPHA_BACKLOG.md`): para una
 * pregunta de agregación (`isAggregationQuery`) el límite normal sube
 * a `AGGREGATION_LIMIT`, y además de lo mejor rankeado por relevancia
 * a ESTE mensaje, se completa con cualquier otra candidata del mismo
 * `type` que ya alcanzó `MIN_SCORE_WITH_UNDERSTANDING_SIGNAL` -- el
 * mismo umbral que P1-6 ya usa para decidir "esto sí profundiza la
 * comprensión de la persona". Sin esto, "cuánto he gastado en total"
 * compite por token literal contra "gasté 30.000 en Uber" y pierde casi
 * siempre (cero palabras compartidas) -- el problema nunca fue que la
 * memoria no existiera, era que esta función solo sabía buscar por
 * parecido textual a UN mensaje puntual, nunca por categoría completa.
 * Sigue sin ninguna consulta nueva a la base de datos: candidates ya
 * trae hasta 150 del mismo `Promise` de arriba.
 */
export async function selectContextualMemories(
  db: Database,
  context: LifeGraphContext,
  currentMessage: string,
  limit: number,
): Promise<Memory[]> {
  const candidates = await createMemoryEngine(db).retrieve(context, {
    limit: CANDIDATE_POOL_SIZE,
  });

  if (candidates.length === 0) {
    return [];
  }

  const messageType = await new DeterministicMemoryClassifier().classify(
    context,
    currentMessage,
  );
  const messageTokens = tokenize(currentMessage);
  const aggregation = isAggregationQuery(currentMessage);
  const effectiveLimit = aggregation ? Math.max(limit, AGGREGATION_LIMIT) : limit;

  const scored = candidates
    .map((memory) => {
      const shared = countShared(messageTokens, tokenize(memory.content));
      const typeBonus = memory.type === messageType ? TYPE_MATCH_BONUS : 0;
      const rankComponent = (memory.rank?.score ?? 0) * RANK_WEIGHT;

      return {
        memory,
        score: shared * SHARED_TOKEN_WEIGHT + typeBonus + rankComponent,
      };
    })
    .sort((a, b) => b.score - a.score);

  // Deliberadamente `limit` (el original, no `effectiveLimit`) -- esta
  // franja sigue siendo "lo mejor por relevancia real a ESTE mensaje",
  // sin ensanchar. Ensanchar esta franja también (en vez de solo el
  // paso de agregación de abajo) dejaba entrar ruido sin ninguna señal
  // financiera cuando la cuenta tenía pocas memorias en total y nada
  // más competía por esos puestos -- encontrado por el propio smoke
  // test de este cambio (`aggregation-query.test.ts`), no en revisión
  // manual.
  const selected = scored.slice(0, limit).map((entry) => entry.memory);

  if (aggregation && selected.length < effectiveLimit) {
    const selectedIds = new Set(selected.map((memory) => memory.id));
    const sameTypeUnderstood = candidates.filter(
      (memory) =>
        memory.type === messageType &&
        (memory.rank?.score ?? 0) >= MIN_SCORE_WITH_UNDERSTANDING_SIGNAL &&
        !selectedIds.has(memory.id),
    );

    for (const memory of sameTypeUnderstood) {
      if (selected.length >= effectiveLimit) break;
      selected.push(memory);
      selectedIds.add(memory.id);
    }
  }

  if (selected.length > 0 && selected.length < effectiveLimit) {
    const top = selected[0];
    const connections = await new DrizzleMemoryRepository(db).getConnections(
      context,
      top.id,
    );
    const selectedIds = new Set(selected.map((memory) => memory.id));

    for (const connection of connections) {
      if (selected.length >= effectiveLimit) break;

      const connectedId =
        connection.fromMemoryId === top.id
          ? connection.toMemoryId
          : connection.fromMemoryId;

      if (selectedIds.has(connectedId)) continue;

      const connectedMemory = candidates.find((memory) => memory.id === connectedId);
      if (connectedMemory) {
        selected.push(connectedMemory);
        selectedIds.add(connectedId);
      }
    }
  }

  return selected;
}
