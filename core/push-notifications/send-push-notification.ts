import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { events } from "../db/schema/events";
import { describeError } from "../observability/describe-error";
import { logger } from "../observability/logger";
import { recordEvent } from "../observability/record-event";
import { ApnsNotConfiguredError, isApnsTokenPermanentlyInvalid, sendApnsNotification } from "./apns-client";
import { deleteDevicePushToken, listDevicePushTokensForUser } from "./repository";

export interface PushNotificationInput {
  readonly userId: string;
  readonly title: string;
  readonly body: string;
  readonly data?: Readonly<Record<string, unknown>>;
  /** Identifica el TIPO de disparador (p. ej. `"continuity_loop"`, `"knowledge_insight"`) -- junto con `sourceId`, la clave de dedupe. */
  readonly triggerType: string;
  /** El id de la cosa concreta que disparó esto (p. ej. el id del loop de continuidad, el id del job de Knowledge Engine) -- nunca se le vuelve a avisar a la misma persona del mismo evento dos veces. */
  readonly sourceId: string;
}

/**
 * Reutiliza `events_user_type_created_at_idx` (ya existente, mismo
 * patrón que `experience_card_shown`) -- filtra primero por
 * `userId`+`type`, después por `metadata->>'sourceId'` en JSONB. No
 * hace falta un índice GIN nuevo: el volumen real de "push enviados
 * por persona" es bajo, y el índice compuesto ya reduce el conjunto a
 * revisar a un puñado de filas antes del filtro JSONB.
 */
async function alreadySent(db: Database, userId: string, triggerType: string, sourceId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        eq(events.type, "push_notification_sent"),
        sql`${events.metadata}->>'triggerType' = ${triggerType}`,
        sql`${events.metadata}->>'sourceId' = ${sourceId}`,
      ),
    )
    .limit(1);

  return row !== undefined;
}

/**
 * Envía una notificación real a todos los dispositivos registrados de
 * una persona -- nunca lanza hacia el llamador (mismo criterio de
 * tolerancia a fallos que `recordEvent`: un fallo al enviar push no
 * puede tumbar el cron que lo dispara). Se degrada a un no-op logueado
 * si APNs todavía no está configurado (`ApnsNotConfiguredError`, antes
 * de que el Founder complete Apple Developer Program) -- nunca falla
 * en silencio total, pero tampoco trata "no configurado todavía" como
 * un error real.
 */
export async function sendPushNotification(db: Database, input: PushNotificationInput): Promise<void> {
  try {
    if (await alreadySent(db, input.userId, input.triggerType, input.sourceId)) {
      return;
    }

    const tokens = await listDevicePushTokensForUser(db, input.userId);
    if (tokens.length === 0) {
      return;
    }

    let anySucceeded = false;
    for (const token of tokens) {
      try {
        await sendApnsNotification(token.deviceToken, token.environment, {
          title: input.title,
          body: input.body,
          data: input.data,
        });
        anySucceeded = true;
      } catch (error) {
        if (error instanceof ApnsNotConfiguredError) {
          logger.log({ event: "push.not_configured", severity: "info", userId: input.userId });
          return; // Ningún token va a funcionar todavía -- no vale la pena seguir intentando los demás.
        }
        if (isApnsTokenPermanentlyInvalid(error)) {
          await deleteDevicePushToken(db, input.userId, token.deviceToken);
          continue;
        }
        logger.log({
          event: "push.delivery_failed",
          severity: "error",
          userId: input.userId,
          ...describeError(error),
        });
      }
    }

    if (anySucceeded) {
      await recordEvent(db, {
        type: "push_notification_sent",
        userId: input.userId,
        metadata: { triggerType: input.triggerType, sourceId: input.sourceId },
      });
    }
  } catch (error) {
    logger.log({ event: "push.send_failed", severity: "error", userId: input.userId, ...describeError(error) });
  }
}
