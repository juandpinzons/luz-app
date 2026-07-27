import type { EntityId } from "../../life/value-objects/entity-id";
import type { LifeDomainType } from "../../life/value-objects/life-domain-type";
import type { EvolutionEvent } from "../entities/evolution-event";

/**
 * Entrada neutral de un cambio de confianza de Belief -- mismo criterio
 * anti-corrupción que `ContradictionCandidate`: `core/temporal-evolution`
 * nunca importa `Belief`/`BeliefHistoryEntry` de `core/belief-engine`.
 * Quien ensambla esto (capa de aplicación) traduce.
 */
export interface BeliefChangeInput {
  beliefId: EntityId;
  statement: string;
  domain?: LifeDomainType;
  previousConfidence?: number;
  newConfidence: number;
  changedAt: Date;
}

export interface InsightDiscoveryInput {
  insightId: EntityId;
  description: string;
  validatedAt: Date;
}

/**
 * Pura, sin IO -- deriva la línea de tiempo directamente de cambios ya
 * persistidos (`belief_history`, `knowledge_engine_insights.validatedAt`),
 * nunca de un snapshot guardado aparte (Principio 6). Orden
 * descendente por fecha: lo más reciente primero, forma natural de
 * responder "¿cómo ha cambiado?".
 */
export function buildEvolutionTimeline(
  beliefChanges: BeliefChangeInput[],
  insightDiscoveries: InsightDiscoveryInput[],
): EvolutionEvent[] {
  const events: EvolutionEvent[] = [];

  for (const change of beliefChanges) {
    if (change.previousConfidence === undefined) {
      events.push({
        kind: "belief_created",
        refType: "belief",
        refId: change.beliefId,
        domain: change.domain,
        description: `Nueva creencia: "${change.statement}"`,
        occurredAt: change.changedAt,
      });
      continue;
    }

    if (change.newConfidence === change.previousConfidence) {
      continue;
    }

    const strengthened = change.newConfidence > change.previousConfidence;
    events.push({
      kind: strengthened ? "belief_strengthened" : "belief_weakened",
      refType: "belief",
      refId: change.beliefId,
      domain: change.domain,
      description: strengthened
        ? `Se reforzó: "${change.statement}" (${change.previousConfidence} → ${change.newConfidence})`
        : `Se debilitó: "${change.statement}" (${change.previousConfidence} → ${change.newConfidence})`,
      occurredAt: change.changedAt,
    });
  }

  for (const discovery of insightDiscoveries) {
    events.push({
      kind: "insight_discovered",
      refType: "insight",
      refId: discovery.insightId,
      description: discovery.description,
      occurredAt: discovery.validatedAt,
    });
  }

  return events.sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime());
}
