import type { LifeGraphContext } from "../../life/life-graph-context";
import { type EntityId, createEntityId } from "../../life/value-objects/entity-id";
import type { Memory } from "../entities/memory";
import type { MemoryConnection } from "../entities/memory-connection";
import { MIN_SCORE_WITH_UNDERSTANDING_SIGNAL } from "../ranking/deterministic-memory-ranking-strategy";
import type { MemoryRepository } from "../repositories/memory.repository";
import type { ConnectStage } from "./connect-stage";

const SAME_ORIGIN_STRENGTH = 100;
const SAME_PERSON_STRENGTH = 50;

interface StructuralMatch {
  targetId: EntityId;
  strength: number;
}

/**
 * Detectores de relación estructural. Cada uno produce candidatos a
 * partir de un hecho verificable entre dos memorias, nunca de una
 * interpretación de significado. La lista está pensada para crecer:
 * una futura señal (mismo GoalId/ProjectId/HabitId, el día que Memory
 * los referencie) es otro detector más aquí, no un rediseño de esta
 * etapa.
 */

/** Mismo origen exacto: extraídas del mismo `(source, sourceId)`. */
function sameOriginMatches(
  memory: Memory,
  candidates: readonly Memory[],
): StructuralMatch[] {
  if (!memory.sourceId) {
    return [];
  }

  return candidates
    .filter(
      (candidate) =>
        candidate.source === memory.source &&
        candidate.sourceId === memory.sourceId,
    )
    .map((candidate) => ({
      targetId: candidate.id,
      strength: SAME_ORIGIN_STRENGTH,
    }));
}

/**
 * Misma persona, sin límite fijo de cantidad: el criterio de calidad
 * es que la memoria candidata haya superado la misma barra de "al
 * menos una señal de comprensión" que usa el ranking (PR-014) —
 * cuántas memorias cumplen eso varía según la persona, no un número
 * inventado. Una memoria sin rank calculado todavía no puede
 * verificar esa barra, así que no califica.
 */
function samePersonMatches(
  memory: Memory,
  candidates: readonly Memory[],
): StructuralMatch[] {
  if (!memory.personId) {
    return [];
  }

  return candidates
    .filter(
      (candidate) =>
        candidate.personId === memory.personId &&
        (candidate.rank?.score ?? 0) >= MIN_SCORE_WITH_UNDERSTANDING_SIGNAL,
    )
    .map((candidate) => ({
      targetId: candidate.id,
      strength: SAME_PERSON_STRENGTH,
    }));
}

/**
 * Solo relaciona hechos verificables entre memorias ya capturadas —
 * "no interpreta la relación" (ver connect-stage.ts). Depende
 * únicamente de `MemoryRepository`, igual que Archive/Forget: no
 * conoce Drizzle directamente. Candidatos limitados a memorias
 * `active` (lo archivado/olvidado no participa en la red vigente de
 * comprensión) distintas de la memoria misma.
 */
export class DefaultConnectStage implements ConnectStage {
  constructor(private readonly repository: MemoryRepository) {}

  async connect(
    context: LifeGraphContext,
    memoryId: EntityId,
  ): Promise<MemoryConnection[]> {
    const memory = await this.repository.getById(context, memoryId);

    if (!memory) {
      throw new Error(
        `DefaultConnectStage: no existe Memory ${memoryId} en este LifeGraph.`,
      );
    }

    const all = await this.repository.list(context);
    const candidates = all.filter(
      (candidate) =>
        candidate.id !== memory.id && candidate.status === "active",
    );

    const matches = [
      ...sameOriginMatches(memory, candidates),
      ...samePersonMatches(memory, candidates),
    ];

    // Un candidato puede calificar por más de un detector — se queda
    // con la señal más fuerte, no se duplica la conexión.
    const strongestByTarget = new Map<EntityId, number>();
    for (const match of matches) {
      const current = strongestByTarget.get(match.targetId) ?? 0;
      if (match.strength > current) {
        strongestByTarget.set(match.targetId, match.strength);
      }
    }

    const now = new Date();
    const connections: MemoryConnection[] = [];

    for (const [targetId, strength] of strongestByTarget) {
      const connection: MemoryConnection = {
        id: createEntityId(crypto.randomUUID()),
        lifeGraphId: context.lifeGraphId,
        fromMemoryId: memory.id,
        toMemoryId: targetId,
        strength,
        createdAt: now,
      };

      connections.push(
        await this.repository.saveConnection(context, connection),
      );
    }

    return connections;
  }
}
