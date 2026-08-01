/**
 * Hacia dónde se mueve un `IdentityDimension`/`IdentityTheme` ahora
 * mismo, derivado siempre de evidencia real (nunca inferido de una sola
 * conversación) -- ver `services/compute-unit-timeline.ts` para la
 * clasificación exacta.
 *
 * - `emerging` -- creciendo, sin historial previo relevante (primera vez
 *   que este tema pesa algo real en la identidad de la persona).
 * - `renewing` -- creciendo de nuevo, DESPUÉS de un período real de
 *   silencio, tras haber pesado significativamente antes (un regreso,
 *   no un tema nuevo).
 * - `stable` -- sin cambio significativo; parte sostenida de la
 *   identidad actual (o ausencia sostenida, si el peso ya era bajo).
 * - `declining` -- perdiendo peso activamente ahora mismo.
 * - `dormant` -- ya tocó fondo: fue significativo alguna vez (peso
 *   máximo real por encima del umbral), hoy pesa poco, y ya no está
 *   cayendo -- un capítulo resuelto, no uno en proceso de cerrarse.
 *
 * `IdentityShift` (no este tipo) es quien representa la TRANSICIÓN
 * entre dos de estos estados como evento fechado y explicable -- este
 * enum describe el estado de reposo actual, nunca el movimiento en sí.
 */
export const IDENTITY_MOMENTUM_KINDS = [
  "emerging",
  "renewing",
  "stable",
  "declining",
  "dormant",
] as const;

export type IdentityMomentum = (typeof IDENTITY_MOMENTUM_KINDS)[number];
