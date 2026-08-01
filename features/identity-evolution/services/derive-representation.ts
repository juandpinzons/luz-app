import type { IdentityRepresentation } from "../domain/identity-representation";
import { PRESENCE_THRESHOLD } from "./decay";
import type { UnitTimelineResult } from "./compute-unit-timeline";

/**
 * Texto final para mostrar -- plantilla + números reales de
 * `UnitTimelineResult`, nunca IA (ver docblock de
 * `domain/identity-representation.ts`). Única función que decide CÓMO
 * suena cada `IdentityMomentum` en español; `compute-unit-timeline.ts`
 * ya decidió QUÉ momentum es.
 */
export function deriveRepresentation(label: string, timeline: UnitTimelineResult): IdentityRepresentation {
  const { momentum, weight, peakWeight, momentumReason } = timeline;

  if (momentum === "emerging") {
    return { label, summary: `"${label}" está tomando espacio en su identidad ahora mismo. ${momentumReason}` };
  }
  if (momentum === "renewing") {
    return { label, summary: `"${label}" está volviendo a tomar espacio. ${momentumReason}` };
  }
  if (momentum === "declining") {
    return { label, summary: `"${label}" está perdiendo protagonismo. ${momentumReason}` };
  }
  if (momentum === "dormant") {
    return {
      label,
      summary: `"${label}" fue una parte real de su identidad (llegó a pesar ${peakWeight}) y hoy quedó en segundo plano. La historia sigue existiendo, solo dejó de dominar la conversación.`,
    };
  }
  if (weight >= PRESENCE_THRESHOLD) {
    return { label, summary: `"${label}" es una parte estable de su identidad actual (peso ${weight}/100).` };
  }
  return { label, summary: `"${label}" todavía no es parte activa de su identidad -- sin evidencia reciente suficiente.` };
}
