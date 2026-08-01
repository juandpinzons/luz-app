import type { OrbMaturityStage } from "../domain/orb-state";

/**
 * Debajo de esto, la relación apenas empieza -- el orbe se muestra
 * "spark" (pequeño, tenue). Encima de `RADIANT_THRESHOLD`, hay una
 * historia real detrás -- "radiant" (pleno, con una segunda capa de
 * luz). Umbrales sobre mensajes reales, nunca inventados: el mismo
 * conteo que ya usa `app/admin/page.tsx` para "Mensajes".
 *
 * Exportados (Auditoría de Experiencia V1, hallazgo H4): el Dashboard
 * (`features/dashboard/components/dashboard-activity-summary.tsx`)
 * reutiliza estos mismos cortes para su propio indicador de presencia
 * -- nunca un segundo umbral inventado aparte, para que "spark" o
 * "radiant" signifique exactamente lo mismo en cualquier pantalla.
 */
export const STEADY_THRESHOLD = 15;
export const RADIANT_THRESHOLD = 100;

/** Ventana para considerar una fecha límite "próxima" -- ni tan corta que casi nunca aplique, ni tan larga que deje de sentirse inminente. */
const UPCOMING_DEADLINE_DAYS = 3;
const UPCOMING_DEADLINE_WINDOW_MS = UPCOMING_DEADLINE_DAYS * 24 * 60 * 60 * 1000;

export interface MaturityInputs {
  totalMessageCount: number;
  now: Date;
  /** Hay al menos una faceta real de estilo de comunicación ya identificada (`RealitySnapshot.communicationStyle`). */
  hasCommunicationStyleSignal: boolean;
  /** Hay una hipótesis en formación sobre la persona (`RealitySnapshot.growingBeliefs`). */
  hasGrowingBelief: boolean;
  /** Hay una pregunta de curiosidad genuina pendiente (`RealitySnapshot.curiosity`). */
  hasPendingCuriosityQuestion: boolean;
  /** La fecha más próxima entre goals/projects activos con `dueDate`/`targetDate`, si hay alguna. */
  nearestDeadlineAt: Date | null;
}

export interface MaturitySignature {
  maturityStage: OrbMaturityStage;
  /** 0 (apenas empezando) a 1 (relación asentada) -- intensidad/saturación de base, antes de cualquier ajuste por el momento (`derive-orb-moment.ts`/`derive-orb-animation.ts`). */
  warmth: number;
  /** Hay una hipótesis en formación, una pregunta pendiente o algo por vencer pronto -- nunca decorativo, siempre trazable a una señal real. */
  anticipation: boolean;
}

/**
 * Profundidad de la relación -- deliberadamente estable entre visitas
 * (solo cambia cuando el historial real crece), a diferencia de
 * `OrbMoment` (`derive-orb-moment.ts`), que puede cambiar de una
 * visita a la siguiente. Misma lógica que ya vivía en
 * `generate-welcome.ts` antes de esta misión -- reubicada, no
 * rediseñada.
 */
export function deriveMaturity(inputs: MaturityInputs): MaturitySignature {
  const { totalMessageCount } = inputs;

  const maturityStage: OrbMaturityStage =
    totalMessageCount >= RADIANT_THRESHOLD
      ? "radiant"
      : totalMessageCount >= STEADY_THRESHOLD
        ? "steady"
        : "spark";

  const messageWarmth = Math.min(totalMessageCount / RADIANT_THRESHOLD, 1);
  const understandingWarmth = inputs.hasCommunicationStyleSignal ? 0.15 : 0;
  const warmth = Math.min(0.25 + messageWarmth * 0.6 + understandingWarmth, 1);

  const hasUpcomingDeadline =
    inputs.nearestDeadlineAt !== null &&
    inputs.nearestDeadlineAt.getTime() - inputs.now.getTime() <= UPCOMING_DEADLINE_WINDOW_MS &&
    inputs.nearestDeadlineAt.getTime() >= inputs.now.getTime();

  const anticipation = inputs.hasGrowingBelief || inputs.hasPendingCuriosityQuestion || hasUpcomingDeadline;

  return { maturityStage, warmth, anticipation };
}
