/**
 * POR QUÉ un `NarrativeThread`/`NarrativeMoment` merece atención ahora --
 * mismo criterio que `LoopReason`/`RealityChangeType`: cada valor
 * corresponde 1:1 a una condición determinista real evaluada en
 * `services/`, nunca un motivo inventado sin una regla detrás. Es el
 * campo de explicabilidad obligatorio de todo engine de LUZ ("Every
 * Insight must be explainable" -- siempre se puede responder "¿por qué
 * está esto aquí?" señalando exactamente uno de estos valores más el
 * dato real que lo produjo).
 *
 * Cuando más de una condición es cierta a la vez, `derive-reason.ts`
 * elige la más específica según un orden fijo documentado ahí -- nunca
 * se combinan dos motivos en uno solo.
 */
export const NARRATIVE_REASONS = [
  /** Hoy coincide con el aniversario real de `Relationship.since` (`LoopReason === "relationship_milestone"`). */
  "milestone_today",
  /** Desenlace positivo real (`LoopOutcome.kind === "positive"`) o una recomendación `CELEBRATE_PROGRESS` real -- nunca inventado. */
  "celebration_moment",
  /** `loop.state === "follow_up"` -- la fecha de seguimiento programada ya se cumplió, momento real de resurfacear. */
  "follow_up_due",
  /** `LoopReason === "important_meeting"`, o correlación exacta con un `CalendarEvent` próximo con asistentes reales. */
  "important_meeting_upcoming",
  /** `LoopReason === "deadline"`/`"future_commitment"`, o correlación con un `DueLifeItem`/`CalendarEvent` dentro de la ventana de proximidad. */
  "approaching_deadline",
  /** `EmailSnapshot.important && unread` -- correo real marcado importante por Gmail, sin leer. */
  "unread_important_email",
  /** `EmailSnapshot.waitingReply` -- alguien más escribió, la persona no ha respondido todavía. */
  "awaiting_reply",
  /** Cerca del propio umbral de `detectTimeoutExceeded` (`core/continuity-engine`) sin haber cerrado todavía -- aviso honesto, nunca una decisión de cerrar (Narrative jamás transiciona loops). */
  "fading_without_evidence",
  /** Capítulo `resolution` -- se acaba de cerrar con un desenlace real, la noticia sigue fresca. */
  "recently_resolved",
  /** Capítulo `reflection` -- cerró hace poco, todavía vale la pena mirar atrás. */
  "worth_reflecting_on",
  /** Abierta/en desarrollo, sin resolverse, por `LONG_RUNNING_THRESHOLD_DAYS` o más. */
  "long_running_unresolved",
  /** `loop.state === "waiting"` -- LUZ ya decidió cuándo volver a mirar esto. */
  "waiting_quietly",
  /** Recién detectada o en desarrollo, sin ninguna otra condición especial todavía -- motivo por defecto, nunca un vacío. */
  "continuing_open_story",
] as const;

export type NarrativeReason = (typeof NARRATIVE_REASONS)[number];
