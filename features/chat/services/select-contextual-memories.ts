import type { Database } from "../../../core/db/client";
import type { LifeGraphContext } from "../../../core/life";
import { DeterministicMemoryClassifier } from "../../../core/memory-engine/classification/deterministic-memory-classifier";
import {
  createMemoryEngine,
  DrizzleMemoryRepository,
  type Memory,
} from "../../../core/memory-engine";

const CANDIDATE_POOL_SIZE = 30;
const MIN_TOKEN_LENGTH = 4;

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

  const selected = scored.slice(0, limit).map((entry) => entry.memory);

  if (selected.length > 0 && selected.length < limit) {
    const top = selected[0];
    const connections = await new DrizzleMemoryRepository(db).getConnections(
      context,
      top.id,
    );
    const selectedIds = new Set(selected.map((memory) => memory.id));

    for (const connection of connections) {
      if (selected.length >= limit) break;

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
