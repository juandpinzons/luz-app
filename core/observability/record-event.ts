import type { Database } from "../db/client";
import { events, type Event as EventRow } from "../db/schema/events";
import { logger } from "./logger";

export interface RecordEventInput {
  type: EventRow["type"];
  userId?: string;
  route?: string;
  message?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Persiste un evento operacional Y lo loguea (Sprint de Observabilidad,
 * Alpha). Nunca debe romper el flujo que lo llama — un fallo al
 * guardar un evento no puede tumbar un login ni ocultar un error real
 * detrás de otro error. Mismo criterio de tolerancia a fallos que
 * `sendMessage` usa para Memory/Context.
 */
export async function recordEvent(
  db: Database,
  input: RecordEventInput,
): Promise<void> {
  logger.log({
    event: `event.${input.type}`,
    userId: input.userId,
    route: input.route,
    message: input.message,
    severity: input.type === "error" ? "error" : "info",
  });

  try {
    await db.insert(events).values({
      type: input.type,
      userId: input.userId,
      route: input.route,
      message: input.message,
      metadata: input.metadata,
    });
  } catch (error) {
    logger.log({
      event: "event.persist_failed",
      severity: "error",
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
