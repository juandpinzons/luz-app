import type { ContinuityLoop, LoopClosureResult } from "../../../core/continuity-engine";
import type { EmailSnapshot } from "../../reality/domain";

/**
 * Regla de cierre determinista para `EmailMessage` (Gmail Foundation)
 * -- misión ejemplo "calendar event resolved" aplicado a correo:
 * "email replied". Busca el mensaje que originó el loop dentro del
 * `EmailSnapshot` MÁS RECIENTE:
 *
 * - No aparece en `snapshot.recent` -> `null` (sin evidencia). Cayó
 *   del techo de `EMAIL_SYNC_HARD_CEILING = 10` (Gmail Foundation
 *   nunca guarda mailbox completo) -- ausencia no es evidencia de
 *   resolución, solo de que dejó de rastrearse. `detectTimeoutExceeded`
 *   (`core/continuity-engine/resolution/`) se encarga si esto persiste
 *   demasiado.
 * - Sigue presente pero ya no cumple la condición que abrió el loop
 *   (`awaiting_my_reply`: ya no está en `waitingReply`;
 *   `unread_important_email`: ya no es `unread && importance==="high"`)
 *   -> `email_replied`, cierra `resolved` con desenlace positivo.
 */
export function detectEmailClosure(
  loop: ContinuityLoop,
  snapshot: EmailSnapshot,
  now: Date = new Date(),
): LoopClosureResult | null {
  if (loop.trigger.origin !== "email") return null;

  const message = snapshot.recent.find((candidate) => candidate.id === loop.trigger.sourceId);
  if (!message) return null;

  if (loop.trigger.reason === "awaiting_my_reply") {
    const stillWaitingReply = snapshot.waitingReply.some((candidate) => candidate.id === message.id);
    if (stillWaitingReply) return null;

    return {
      evidence: {
        kind: "email_replied",
        observedAt: now,
        description: `El mensaje "${message.subject}" ya no está pendiente de respuesta.`,
        sourceId: message.id,
      },
      toState: "resolved",
      outcome: { kind: "positive", summary: "El mensaje se respondió (o dejó de estar sin leer).", capturedAt: now },
    };
  }

  if (loop.trigger.reason === "unread_important_email") {
    const stillUnreadImportant = message.unread && message.importance === "high";
    if (stillUnreadImportant) return null;

    return {
      evidence: {
        kind: "email_replied",
        observedAt: now,
        description: `El mensaje "${message.subject}" ya se leyó o dejó de marcarse importante.`,
        sourceId: message.id,
      },
      toState: "resolved",
      outcome: { kind: "positive", summary: "El mensaje ya no está pendiente.", capturedAt: now },
    };
  }

  return null;
}
