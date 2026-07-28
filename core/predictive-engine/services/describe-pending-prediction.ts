import { LIFE_DOMAIN_LABEL } from "../../life/value-objects/life-domain-label";
import type { MovementDirection } from "../entities/domain-movement";
import type { PendingPrediction } from "../entities/pending-prediction";

function pastVerbFor(direction: MovementDirection): string {
  return direction === "strengthening" ? "mejoró" : "se debilitó";
}

function pastVerbForRepeat(direction: MovementDirection): string {
  return direction === "strengthening" ? "también mejoró" : "también se debilitó";
}

/**
 * Plantilla determinista, sin IA -- mismo criterio que `describePattern`
 * (Principio 3: nada aquí es interpretación nueva, es el mismo conteo
 * ya validado aplicado a un gatillo que se acaba de repetir).
 */
export function describePendingPrediction(prediction: PendingPrediction): string {
  const fromLabel = LIFE_DOMAIN_LABEL[prediction.fromDomain];
  const toLabel = LIFE_DOMAIN_LABEL[prediction.toDomain];

  return `Hace poco, ${fromLabel} ${pastVerbFor(prediction.fromDirection)}. Otras ${prediction.occurrences} veces que pasó eso, ${toLabel} ${pastVerbForRepeat(prediction.toDirection)} poco después -- podría estar por venir.`;
}
