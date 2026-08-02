/**
 * POR QUÉ se abrió un `ContinuityLoop` -- la regla determinista
 * concreta que disparó (misión: "Define deterministic rules for when a
 * loop should be created... Rules must be explainable"). Cada valor
 * corresponde 1:1 a un ejemplo de la misión Y a exactamente una función
 * de `../detection/` -- nunca un motivo inventado sin una regla real
 * detrás.
 */
export const LOOP_REASONS = [
  /** `Memory.type === "intention"` -- una intención explícita todavía sin resolver. */
  "explicit_intention",
  /** `Memory.type === "event"` -- un evento significativo de vida, todavía sin seguimiento. */
  "significant_life_event",
  /** `CalendarEvent` futuro con al menos un asistente además de la propia cuenta -- una reunión real con otra persona. */
  "important_meeting",
  /** `CalendarEvent` futuro sin asistentes adicionales, o `Goal`/`Project` con fecha próxima -- un compromiso concreto con fecha. */
  "future_commitment",
  /** `Goal.targetDate`/`Project.dueDate` dentro de la ventana de alerta. */
  "deadline",
  /** Hoy coincide con el mes+día de `Relationship.since` -- un aniversario real del vínculo. */
  "relationship_milestone",
  /** `CuriosityQuestion.status === "pending"` -- LUZ ya decidió que esto merece una respuesta futura. */
  "question_pending_answer",
  /** `EmailSnapshot.important` con `unread === true` -- un correo real marcado importante por Gmail, sin leer. */
  "unread_important_email",
  /** `EmailSnapshot.waitingReply` -- alguien más escribió y la persona no ha respondido; el loop es "debo responder", no "espero respuesta". */
  "awaiting_my_reply",
  /** `FollowUpRecommendation` con prioridad `high`/`critical` que el Dashboard ya calculó -- se vuelve loop para no desaparecer al recalcularse. */
  "recommendation_pending",
] as const;

export type LoopReason = (typeof LOOP_REASONS)[number];
