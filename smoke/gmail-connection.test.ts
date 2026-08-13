import { and, eq } from "drizzle-orm";
import { db } from "../core/db/client";
import { emailConnections } from "../core/db/schema";
import {
  disconnectStoredEmailConnection,
  getStoredEmailConnection,
  saveEmailConnection,
} from "../core/email-connections/repository";
import { getLiveEmailContext } from "../core/email-connections/get-live-email-context";
import type { GmailCredentials } from "../features/reality/providers/gmail";
import type { SmokeFlow } from "./types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const FAKE_ACCOUNT = "smoke-gmail-fixture@example.com";

const FAKE_CREDENTIALS: GmailCredentials = {
  accessToken: "smoke-fake-access-token",
  refreshToken: "smoke-fake-refresh-token",
  expiresAt: Date.now() + 3_600_000,
  clientId: "smoke-fake-client-id",
  clientSecret: "smoke-fake-client-secret",
};

/**
 * Cubre exactamente hasta donde se puede verificar sin una cuenta Gmail
 * real y un flujo de consentimiento OAuth interactivo (ninguno posible
 * en este entorno -- mismo límite que `features/reality/README.md` ya
 * documenta para Gmail Foundation): el round-trip de cifrado contra
 * Postgres real, el repositorio (`core/email-connections/repository.ts`),
 * y la rama pura de `getLiveEmailContext` que nunca toca la red (sin
 * conexión / conexión desconectada). Nunca llama `refreshGmail` con
 * credenciales falsas -- eso sería una llamada de red real contra
 * `gmail.googleapis.com` con un token inválido, no una verificación
 * útil ni determinista.
 */
export const gmailConnectionFlow: SmokeFlow = {
  name: "gmail-connection",
  async run(ctx) {
    const lifeGraphId = ctx.lifeGraphContext.lifeGraphId;

    await db
      .delete(emailConnections)
      .where(and(eq(emailConnections.lifeGraphId, lifeGraphId), eq(emailConnections.providerKind, "gmail")));

    try {
      const noRowOutcome = await getLiveEmailContext(db, lifeGraphId);
      assert(
        noRowOutcome.status === "not_connected",
        `sin ninguna fila, getLiveEmailContext debería devolver not_connected, obtuvo: ${noRowOutcome.status}`,
      );

      const saved = await saveEmailConnection(db, lifeGraphId, "gmail", FAKE_ACCOUNT, FAKE_CREDENTIALS);
      assert(saved.status === "active", `saveEmailConnection debería dejar status "active", obtuvo: ${saved.status}`);
      assert(
        saved.externalAccountId === FAKE_ACCOUNT,
        `externalAccountId debería ser "${FAKE_ACCOUNT}", obtuvo: "${saved.externalAccountId}"`,
      );

      const stored = await getStoredEmailConnection(db, lifeGraphId, "gmail");
      assert(stored !== null, "getStoredEmailConnection debería encontrar la fila recién guardada");
      assert(
        stored.credentials.accessToken === FAKE_CREDENTIALS.accessToken &&
          stored.credentials.refreshToken === FAKE_CREDENTIALS.refreshToken &&
          stored.credentials.clientId === FAKE_CREDENTIALS.clientId &&
          stored.credentials.clientSecret === FAKE_CREDENTIALS.clientSecret &&
          stored.credentials.expiresAt === FAKE_CREDENTIALS.expiresAt,
        "las credenciales descifradas deberían ser exactamente iguales a las guardadas -- round-trip de cifrado roto",
      );

      await disconnectStoredEmailConnection(db, lifeGraphId, "gmail");
      const disconnectedOutcome = await getLiveEmailContext(db, lifeGraphId);
      assert(
        disconnectedOutcome.status === "not_connected",
        `tras desconectar, getLiveEmailContext debería devolver not_connected, obtuvo: ${disconnectedOutcome.status}`,
      );
    } finally {
      await db
        .delete(emailConnections)
        .where(and(eq(emailConnections.lifeGraphId, lifeGraphId), eq(emailConnections.providerKind, "gmail")));
    }
  },
};
