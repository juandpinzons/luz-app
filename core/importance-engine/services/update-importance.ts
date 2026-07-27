import type { LifeGraphContext } from "../../life/life-graph-context";
import { createEntityId, type EntityId } from "../../life/value-objects/entity-id";
import type { ImportanceRepository } from "../repositories/importance.repository";
import { DeterministicImportanceScoringStrategy } from "../scoring/deterministic-importance-scoring-strategy";
import type { ImportanceSignals } from "../scoring/importance-signals";

const strategy = new DeterministicImportanceScoringStrategy();

/**
 * Recalcula y persiste la importancia de una entidad -- upsert, seguro
 * de llamar tantas veces como la entidad reciba nueva evidencia
 * (`onConflictDoUpdate` en el repositorio). Llamado desde los
 * servicios de consolidación de cada engine (Belief, Concept,
 * Contradiction) después de que la entidad cambia, nunca desde un job
 * separado que recorra todo el LifeGraph -- la importancia se
 * mantiene al día de forma incremental, igual que el resto del
 * pipeline (Principio 8: LUZ decide, de forma determinista, en el
 * momento en que ya tiene la evidencia en mano).
 */
export async function updateImportance(
  repository: ImportanceRepository,
  context: LifeGraphContext,
  entityType: string,
  entityId: EntityId,
  signals: ImportanceSignals,
): Promise<void> {
  const { score, reason } = strategy.compute(signals);

  await repository.save(context, {
    id: createEntityId(crypto.randomUUID()),
    lifeGraphId: context.lifeGraphId,
    entityType,
    entityId,
    score,
    reason,
    updatedAt: new Date(),
  });
}
