import type { DetectedLoopCandidate } from "../../../core/continuity-engine";
import type { EmailMessage, EmailSnapshot } from "../../reality/domain";

function buildCandidate(
  message: EmailMessage,
  reason: "awaiting_my_reply" | "unread_important_email",
  now: Date,
): DetectedLoopCandidate {
  const title = message.subject || message.sender.displayName || message.sender.email;

  return {
    trigger: {
      origin: "email",
      reason,
      sourceId: message.id,
      detectedAt: now,
      summary: title,
    },
    title,
    priority: reason === "unread_important_email" ? "high" : "medium",
    relatedEntities: [{ kind: "email_message", id: message.id, title }],
  };
}

/**
 * Regla de apertura determinista para `EmailSnapshot` (Gmail
 * Foundation) -- misión ejemplo "important email". Vive en
 * `features/continuity/`, mismo motivo que `detect-from-calendar.ts`
 * (Gmail Foundation es `features/reality/`, no `core/`).
 *
 * Dos señales, ya deterministas en el propio `EmailSnapshot`
 * (`features/reality/application/get-email-snapshot.ts`), nunca
 * reinterpretadas aquí:
 * - `waitingReply` -> `awaiting_my_reply` (alguien más escribió, la
 *   persona no ha respondido -- el loop es "debo responder").
 * - `important` Y todavía `unread` -> `unread_important_email` (Gmail
 *   ya lo marcó importante y sigue sin leer). Un mensaje importante ya
 *   LEÍDO no abre loop -- sin evidencia de que siga pendiente.
 *
 * Un mensaje presente en ambas listas cuenta solo una vez, como
 * `awaiting_my_reply` (evita dos loops por el mismo mensaje).
 */
export function detectFromEmailSnapshot(snapshot: EmailSnapshot, now: Date = new Date()): DetectedLoopCandidate[] {
  const candidates: DetectedLoopCandidate[] = [];
  const alreadyCovered = new Set<string>();

  for (const message of snapshot.waitingReply) {
    candidates.push(buildCandidate(message, "awaiting_my_reply", now));
    alreadyCovered.add(message.id);
  }

  for (const message of snapshot.important) {
    if (alreadyCovered.has(message.id)) continue;
    if (!message.unread) continue;
    candidates.push(buildCandidate(message, "unread_important_email", now));
  }

  return candidates;
}
