import { randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import type { Database } from "../core/db/client";
import { mobileSessionHandoffs } from "./schema";

/** Vida corta a propósito -- solo necesita sobrevivir el salto Universal Link -> WebView propia, nunca minutos de por medio. */
const HANDOFF_TTL_MS = 60_000;

/**
 * Emite un código de intercambio de un solo uso para un `sessionToken`
 * ya creado (por `app/api/mobile-auth/callback/route.ts`, vía el mismo
 * adapter que usa el login web) -- ver docblock de `mobileSessionHandoffs`
 * en `./schema.ts` para el porqué de este puente.
 */
export async function createMobileSessionHandoff(db: Database, sessionToken: string): Promise<string> {
  const exchangeCode = randomBytes(32).toString("base64url");

  await db.insert(mobileSessionHandoffs).values({
    exchangeCode,
    sessionToken,
    expiresAt: new Date(Date.now() + HANDOFF_TTL_MS),
  });

  return exchangeCode;
}

/**
 * Consume el código -- `null` si no existe, ya expiró, o ya se usó
 * (un código nunca se resuelve dos veces, mismo criterio de un solo
 * uso que un token de reseteo de contraseña). Marca `consumedAt` en la
 * misma operación en la que se valida, para que dos peticiones
 * concurrentes con el mismo código nunca puedan consumirlo ambas.
 */
export async function consumeMobileSessionHandoff(db: Database, exchangeCode: string): Promise<string | null> {
  const [row] = await db
    .update(mobileSessionHandoffs)
    .set({ consumedAt: new Date() })
    .where(and(eq(mobileSessionHandoffs.exchangeCode, exchangeCode), isNull(mobileSessionHandoffs.consumedAt)))
    .returning();

  if (!row || row.expiresAt.getTime() < Date.now()) {
    return null;
  }

  return row.sessionToken;
}
