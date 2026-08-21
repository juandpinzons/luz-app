import { NextResponse } from "next/server";
import { getUserContext } from "@/auth/user-context";
import { createGmailConnectHandoff } from "@/core/email-connections/gmail-connect-handoff";
import { db } from "@/core/db/client";
import { createRequestId, logger } from "@/core/observability/logger";

/**
 * Paso previo, dentro de la WebView PROPIA de la app (shell nativo iOS)
 * -- corre ANTES de `Browser.open()`, mientras la cookie de sesión de
 * Auth.js todavía está disponible. Google bloquea el consentimiento
 * OAuth dentro de un WebView embebido ("disallowed_useragent"), así que
 * el resto del flujo de Gmail tiene que correr en el navegador de
 * sistema -- que no comparte cookie jar con la WebView, ver
 * `GMAIL_NATIVE_USER_COOKIE` en `../../shared.ts`. Esta ruta resuelve
 * "quién es" una sola vez, aquí, y lo lleva como código de intercambio
 * de un solo uso (`createGmailConnectHandoff`) para que
 * `/api/gmail/connect` pueda saberlo sin `getUserContext()` cuando lo
 * abra el navegador de sistema.
 *
 * A diferencia del login nativo (`/api/mobile-auth/start`), esta ruta
 * SÍ exige una sesión existente -- conectar Gmail es una acción
 * secundaria de alguien ya autenticado, nunca el login en sí.
 */
export async function POST(): Promise<Response> {
  const requestId = createRequestId();
  const route = "POST /api/gmail/native/start";

  const userContext = await getUserContext();
  if (!userContext) {
    logger.log({ event: "auth.rejected", severity: "warn", requestId, route });
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const exchangeCode = await createGmailConnectHandoff(db, userContext.userId);

  logger.log({ event: "gmail.native_start.handoff_created", requestId, route, userId: userContext.userId });

  return NextResponse.json({ exchangeCode });
}
