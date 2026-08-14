import { and, eq } from "drizzle-orm";
import { createEntityId, type EntityId } from "../life/value-objects/entity-id";
import type { Database } from "../db/client";
import { emailConnections, type EmailConnectionRow } from "../db/schema/email-connections";
import { decryptSecret, encryptSecret } from "../security/secret-cipher";
import type { GmailCredentials } from "../../features/reality/providers/gmail";
import type { EmailConnection, EmailProviderKind } from "../../features/reality/domain";

/**
 * Capa de persistencia real de `EmailConnection`
 * (`features/reality/domain/`) -- Gmail Foundation define la forma
 * pero deliberadamente no persiste nada (ver
 * `features/reality/README.md`, "Gmail Foundation"). Mismo patrón
 * exacto que `core/calendar-connections/repository.ts`.
 *
 * Único lugar de todo el repo (junto con las rutas OAuth que lo llaman)
 * que cifra/descifra credenciales de correo -- ningún otro llamador
 * debe leer `encryptedCredentials` directo de la fila ni loguear el
 * resultado de `decryptSecret`.
 */

export interface StoredEmailConnection {
  connection: EmailConnection;
  /** `null` si la conexión está `disconnected` -- `disconnectStoredEmailConnection` limpia el secreto en reposo, nunca solo cambia `status`. */
  credentials: GmailCredentials | null;
}

function toDomainConnection(row: EmailConnectionRow): EmailConnection {
  return {
    id: createEntityId(row.id),
    lifeGraphId: createEntityId(row.lifeGraphId),
    providerKind: row.providerKind,
    externalAccountId: row.externalAccountId,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Hoy el único proveedor real es Gmail (ver `features/reality/README.md`)
 * -- lanza explícito en vez de devolver credenciales con una forma que
 * el llamador no pidió. `null` si `encryptedCredentials` ya se limpió
 * (conexión `disconnected`) -- nunca intenta descifrar un valor que ya
 * no existe.
 */
function toGmailCredentials(row: EmailConnectionRow): GmailCredentials | null {
  if (row.encryptedCredentials === null) {
    return null;
  }
  if (row.providerKind !== "gmail") {
    throw new Error(
      `toGmailCredentials: la conexión ${row.id} es de proveedor "${row.providerKind}", no "gmail" -- ningún otro proveedor tiene un adaptador real todavía.`,
    );
  }

  const decrypted = JSON.parse(decryptSecret(row.encryptedCredentials)) as GmailCredentials;
  return decrypted;
}

/**
 * Guarda (o reemplaza, si ya existía una conexión de este proveedor
 * para este `LifeGraph`) una conexión ya validada por `connectGmail()`
 * (`features/reality/application`) -- este repositorio nunca valida
 * credenciales por su cuenta, solo persiste lo que el llamador ya
 * confirmó que funciona contra el proveedor real.
 */
export async function saveEmailConnection(
  db: Database,
  lifeGraphId: EntityId,
  providerKind: EmailProviderKind,
  externalAccountId: string,
  credentials: GmailCredentials,
): Promise<EmailConnection> {
  const now = new Date();
  const encryptedCredentials = encryptSecret(JSON.stringify(credentials));

  const [row] = await db
    .insert(emailConnections)
    .values({
      lifeGraphId,
      providerKind,
      externalAccountId,
      encryptedCredentials,
      status: "active",
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [emailConnections.lifeGraphId, emailConnections.providerKind],
      set: { externalAccountId, encryptedCredentials, status: "active", updatedAt: now },
    })
    .returning();

  return toDomainConnection(row);
}

/** `null` si esta persona nunca conectó este proveedor -- mismo criterio que `getStoredCalendarConnection`. */
export async function getStoredEmailConnection(
  db: Database,
  lifeGraphId: EntityId,
  providerKind: EmailProviderKind,
): Promise<StoredEmailConnection | null> {
  const [row] = await db
    .select()
    .from(emailConnections)
    .where(and(eq(emailConnections.lifeGraphId, lifeGraphId), eq(emailConnections.providerKind, providerKind)))
    .limit(1);

  if (!row) return null;

  return { connection: toDomainConnection(row), credentials: toGmailCredentials(row) };
}

/**
 * Se llama tras una sincronización en vivo exitosa -- avanza
 * `updatedAt` y, si `refreshedCredentials` viene (el `accessToken` se
 * renovó en memoria durante esta llamada, ver
 * `GmailClient.getCurrentCredentials()`), re-guarda el token nuevo para
 * que la próxima carga no tenga que refrescar de nuevo innecesariamente.
 */
export async function markEmailConnectionSynced(
  db: Database,
  id: EntityId,
  refreshedCredentials?: GmailCredentials,
): Promise<void> {
  await db
    .update(emailConnections)
    .set({
      status: "active",
      updatedAt: new Date(),
      ...(refreshedCredentials ? { encryptedCredentials: encryptSecret(JSON.stringify(refreshedCredentials)) } : {}),
    })
    .where(eq(emailConnections.id, id));
}

/** Se llama cuando una sincronización en vivo falla por algo que NO es reautorización -- nunca borra la fila. */
export async function markEmailConnectionError(db: Database, id: EntityId): Promise<void> {
  await db.update(emailConnections).set({ status: "error", updatedAt: new Date() }).where(eq(emailConnections.id, id));
}

/** Se llama cuando `GmailClient` señala `GmailAuthExpiredError` -- distinto de un error genérico: la persona necesita reautorizar, reintentar solo no sirve. */
export async function markEmailConnectionNeedsReauth(db: Database, id: EntityId): Promise<void> {
  await db.update(emailConnections).set({ status: "needs_reauth", updatedAt: new Date() }).where(eq(emailConnections.id, id));
}

/**
 * Conserva la fila (historial de que existió esta conexión), nunca la
 * borra -- pero SÍ borra el secreto en reposo (`encryptedCredentials:
 * null`), no solo cambia `status`. Auditoría de seguridad, 2026-08-14:
 * antes de este cambio, desconectar era una transición de estado pura
 * que dejaba el refresh token/contraseña de app cifrados y recuperables
 * indefinidamente.
 */
export async function disconnectStoredEmailConnection(
  db: Database,
  lifeGraphId: EntityId,
  providerKind: EmailProviderKind,
): Promise<void> {
  await db
    .update(emailConnections)
    .set({ status: "disconnected", encryptedCredentials: null, updatedAt: new Date() })
    .where(and(eq(emailConnections.lifeGraphId, lifeGraphId), eq(emailConnections.providerKind, providerKind)));
}
