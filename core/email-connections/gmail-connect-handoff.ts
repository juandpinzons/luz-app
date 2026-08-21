import { randomBytes } from "node:crypto";
import { and, eq, isNull, lt } from "drizzle-orm";
import type { Database } from "../db/client";
import { gmailConnectHandoffs } from "../db/schema";

/**
 * Vida corta a propósito -- solo necesita sobrevivir el salto WebView
 * propia de la app -> navegador de sistema -> `/api/gmail/connect`,
 * nunca minutos de por medio. Mismo criterio que
 * `auth/mobile-session-handoff-repository.ts::HANDOFF_TTL_MS`, pero un
 * poco más generoso porque acá la persona todavía tiene que completar
 * el consentimiento real de Google antes de que el código se consuma
 * (el handoff de login se consume de inmediato al volver; este se
 * consume recién en `/api/gmail/connect`, antes de redirigir a Google).
 */
const HANDOFF_TTL_MS = 5 * 60_000;

/**
 * Emite un código de intercambio de un solo uso que lleva "esta persona
 * ya autenticada quiere conectar Gmail" desde la WebView propia de la
 * app (que sí tiene la cookie de sesión de Auth.js) hasta
 * `/api/gmail/connect` corriendo en el navegador de sistema (que no la
 * tiene -- cookie jar separado en iOS). Ver docblock de
 * `gmailConnectHandoffs` en `core/db/schema/email-connections.ts` para
 * el porqué completo de este puente y en qué se diferencia del de
 * login.
 */
export async function createGmailConnectHandoff(db: Database, userId: string): Promise<string> {
  const exchangeCode = randomBytes(32).toString("base64url");

  await db.delete(gmailConnectHandoffs).where(lt(gmailConnectHandoffs.expiresAt, new Date())).catch(() => {
    // Poda oportunista, nunca debe bloquear un intento real de conectar Gmail por fallar.
  });

  await db.insert(gmailConnectHandoffs).values({
    exchangeCode,
    userId,
    expiresAt: new Date(Date.now() + HANDOFF_TTL_MS),
  });

  return exchangeCode;
}

/**
 * Consume el código -- `null` si no existe, ya expiró, o ya se usó (un
 * solo uso, mismo criterio que un token de reseteo de contraseña).
 * Marca `consumedAt` en la misma operación en la que se valida, para
 * que dos peticiones concurrentes con el mismo código nunca puedan
 * consumirlo ambas -- idéntico patrón a
 * `consumeMobileSessionHandoff`.
 */
export async function consumeGmailConnectHandoff(db: Database, exchangeCode: string): Promise<string | null> {
  const [row] = await db
    .update(gmailConnectHandoffs)
    .set({ consumedAt: new Date() })
    .where(and(eq(gmailConnectHandoffs.exchangeCode, exchangeCode), isNull(gmailConnectHandoffs.consumedAt)))
    .returning();

  if (!row || row.expiresAt.getTime() < Date.now()) {
    return null;
  }

  return row.userId;
}
