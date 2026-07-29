import type { Belief, BeliefRepository } from "../../../core/belief-engine";
import type { LifeGraphContext } from "../../../core/life/life-graph-context";
import type { LifeDomainType } from "../../../core/life/value-objects/life-domain-type";
import type { DomainMovement } from "../../../core/predictive-engine";

function hasDomain(belief: Belief): belief is Belief & { domain: LifeDomainType } {
  return belief.domain !== undefined;
}

/**
 * Traduce `belief_history` real (`core/belief-engine`) a la forma
 * neutral que `core/predictive-engine` sabe comparar -- misma frontera
 * anti-corrupción que `describe-evolution.ts` aplica para
 * `core/temporal-evolution` (ADR-0013 style: el módulo de dominio
 * nunca importa `Belief` directamente). Extraído de
 * `detect-predictive-patterns.ts` porque Identity Model necesita
 * exactamente el mismo cálculo para predicciones pendientes -- un
 * consumidor nuevo de un dato ya calculado, no una razón para
 * recalcularlo con otra lógica.
 */
export async function collectDomainMovements(
  beliefRepository: BeliefRepository,
  context: LifeGraphContext,
): Promise<DomainMovement[]> {
  const beliefs = await beliefRepository.list(context);
  const beliefsWithDomain = beliefs.filter(hasDomain);

  // War Room 2026-07-29: mismo hallazgo y misma solución que
  // `describe-evolution.ts` -- round-trips secuenciales por Belief,
  // ahora en paralelo, mismo método público de `BeliefRepository`.
  const histories = await Promise.all(
    beliefsWithDomain.map((belief) => beliefRepository.getHistory(context, belief.id)),
  );

  const movements: DomainMovement[] = [];
  beliefsWithDomain.forEach((belief, index) => {
    for (const entry of histories[index]) {
      if (entry.previousConfidence === undefined) continue;
      if (entry.newConfidence === entry.previousConfidence) continue;

      movements.push({
        beliefId: belief.id,
        domain: belief.domain,
        direction: entry.newConfidence > entry.previousConfidence ? "strengthening" : "weakening",
        changedAt: entry.changedAt,
      });
    }
  });

  return movements;
}
