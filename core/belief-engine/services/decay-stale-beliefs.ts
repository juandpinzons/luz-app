import type { LifeGraphContext } from "../../life/life-graph-context";
import { createEntityId } from "../../life/value-objects/entity-id";
import type { BeliefRepository } from "../repositories/belief.repository";

/** Sin refuerzo en 90 días -- empieza a perder soporte (Principio 4: el conocimiento es probabilístico, no permanente). */
const DECAY_WINDOW_DAYS = 90;
/** No vuelve a decaer antes de esto -- evita descontar el mismo Belief varias veces el mismo día en una cuenta muy activa. */
const MIN_RECHECK_DAYS = 7;
const DECAY_STEP = 15;
const EXPIRE_THRESHOLD = 20;

function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Best-effort, corre una vez por LifeGraph al final de cada
 * enriquecimiento (`enrich-knowledge-graph.ts`) -- barato porque la
 * lista de Beliefs por LifeGraph es pequeña. Nunca borra un Belief:
 * solo lo mueve a `status: "expired"` cuando su confianza cae por
 * debajo de `EXPIRE_THRESHOLD` sin refuerzo reciente -- "desaparecer"
 * (Principio 4) es un estado, no un DELETE, igual que Memory ya
 * estableció para "forget".
 */
export async function decayStaleBeliefs(
  repository: BeliefRepository,
  context: LifeGraphContext,
  now: Date = new Date(),
): Promise<void> {
  const beliefs = await repository.list(context);

  for (const belief of beliefs) {
    if (belief.status !== "active") {
      continue;
    }
    if (daysBetween(belief.lastReinforcedAt, now) < DECAY_WINDOW_DAYS) {
      continue;
    }
    if (daysBetween(belief.confidence.assignedAt, now) < MIN_RECHECK_DAYS) {
      continue;
    }

    const newConfidence = Math.max(0, belief.confidence.score - DECAY_STEP);
    const nextStatus = newConfidence <= EXPIRE_THRESHOLD ? "expired" : "active";

    // `saveWithHistory` (no `save()` + `appendHistory()` por separado):
    // ambas escrituras deben quedar en la misma transacción, o un
    // crash entre ellas (auditoría War Room 2026-07-29, bloque 5) deja
    // un Belief ya decayido sin ninguna fila de historial que lo
    // explique -- y el guard de `MIN_RECHECK_DAYS` de arriba, basado en
    // `confidence.assignedAt`, nunca reintentaría ese decay para
    // completar el historial faltante.
    await repository.saveWithHistory(
      context,
      {
        ...belief,
        status: nextStatus,
        confidence: { score: newConfidence, assignedAt: now },
        updatedAt: now,
      },
      {
        id: createEntityId(crypto.randomUUID()),
        lifeGraphId: context.lifeGraphId,
        beliefId: belief.id,
        previousConfidence: belief.confidence.score,
        newConfidence,
        changeReason: `Sin refuerzo en ${DECAY_WINDOW_DAYS}+ días`,
        changedAt: now,
      },
    );
  }
}
