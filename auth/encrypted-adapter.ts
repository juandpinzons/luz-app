import type { Adapter } from "next-auth/adapters";
import { encryptContentOrNull } from "../core/security/content-cipher";

/**
 * Envuelve el `Adapter` de `@auth/drizzle-adapter` para cifrar
 * `refresh_token`/`access_token`/`id_token` antes de que
 * `linkAccount` los inserte en `accounts` (ADR-0024, cierra el
 * CRITICAL #5 de LUZ-POL-003 -- estaban en texto plano).
 *
 * Solo `linkAccount` necesita envolverse: es el único método del
 * adapter que ESCRIBE estos campos (`node_modules/@auth/drizzle-adapter/lib/pg.js`
 * -- `insert(accountsTable).values(data)` directo). Nada en este
 * repositorio lee `accounts.access_token`/`refresh_token`/`id_token`
 * de vuelta -- confirmado por grep (Gmail usa su propia tabla
 * `email_connections`, ya cifrada con `secret-cipher.ts`, no esta) --
 * así que no hace falta envolver `getAccount`/`getUserByAccount` con
 * un descifrado: ningún consumidor real lee esos campos como texto
 * usable. Si eso deja de ser cierto (p.ej. Auth.js empieza a refrescar
 * el token de esta cuenta para llamar a una API de Google desde aquí
 * mismo, no solo para iniciar sesión), este wrapper necesita un
 * `getAccount` que descifre también -- no decidido hoy, este comentario
 * es la señal para revisarlo si ese día llega.
 */
export function withEncryptedAccountTokens(adapter: Adapter): Adapter {
  const originalLinkAccount = adapter.linkAccount?.bind(adapter);

  if (!originalLinkAccount) {
    return adapter;
  }

  return {
    ...adapter,
    async linkAccount(account): Promise<void> {
      await originalLinkAccount({
        ...account,
        refresh_token: encryptContentOrNull(account.refresh_token) ?? undefined,
        access_token: encryptContentOrNull(account.access_token) ?? undefined,
        id_token: encryptContentOrNull(account.id_token) ?? undefined,
      });
    },
  };
}
