import { and, eq } from "drizzle-orm";
import { createEntityId, type EntityId } from "../life/value-objects/entity-id";
import type { Database } from "../db/client";
import { youtubeConnections, type YoutubeConnectionRow } from "../db/schema/youtube-connections";
import { decryptSecret, encryptSecret } from "../security/secret-cipher";
import type { YoutubeConnection, YoutubeProviderKind, YoutubeCredentials } from "./domain";

/**
 * Capa de persistencia real de `YoutubeConnection` -- mismo patrón
 * exacto que `core/email-connections/repository.ts`. Único lugar de
 * todo el repo (junto con las rutas OAuth que lo llaman) que cifra/
 * descifra credenciales de YouTube.
 */

export interface StoredYoutubeConnection {
  connection: YoutubeConnection;
  /** `null` si la conexión está `disconnected` -- `disconnectStoredYoutubeConnection` limpia el secreto en reposo, nunca solo cambia `status`. */
  credentials: YoutubeCredentials | null;
}

function toDomainConnection(row: YoutubeConnectionRow): YoutubeConnection {
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

function toYoutubeCredentials(row: YoutubeConnectionRow): YoutubeCredentials | null {
  if (row.encryptedCredentials === null) {
    return null;
  }
  if (row.providerKind !== "youtube") {
    throw new Error(
      `toYoutubeCredentials: la conexión ${row.id} es de proveedor "${row.providerKind}", no "youtube" -- ningún otro proveedor tiene un adaptador real todavía.`,
    );
  }

  const decrypted = JSON.parse(decryptSecret(row.encryptedCredentials)) as YoutubeCredentials;
  return decrypted;
}

/**
 * Guarda (o reemplaza, si ya existía una conexión de este proveedor
 * para este `LifeGraph`) una conexión ya validada por `connectYoutube()`
 * (`features/reality/application`) -- este repositorio nunca valida
 * credenciales por su cuenta, solo persiste lo que el llamador ya
 * confirmó que funciona contra el proveedor real.
 */
export async function saveYoutubeConnection(
  db: Database,
  lifeGraphId: EntityId,
  providerKind: YoutubeProviderKind,
  externalAccountId: string,
  credentials: YoutubeCredentials,
): Promise<YoutubeConnection> {
  const now = new Date();
  const encryptedCredentials = encryptSecret(JSON.stringify(credentials));

  const [row] = await db
    .insert(youtubeConnections)
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
      target: [youtubeConnections.lifeGraphId, youtubeConnections.providerKind],
      set: { externalAccountId, encryptedCredentials, status: "active", updatedAt: now },
    })
    .returning();

  return toDomainConnection(row);
}

/** `null` si esta persona nunca conectó este proveedor. */
export async function getStoredYoutubeConnection(
  db: Database,
  lifeGraphId: EntityId,
  providerKind: YoutubeProviderKind,
): Promise<StoredYoutubeConnection | null> {
  const [row] = await db
    .select()
    .from(youtubeConnections)
    .where(and(eq(youtubeConnections.lifeGraphId, lifeGraphId), eq(youtubeConnections.providerKind, providerKind)))
    .limit(1);

  if (!row) return null;

  return { connection: toDomainConnection(row), credentials: toYoutubeCredentials(row) };
}

/**
 * Se llama tras una sincronización en vivo exitosa -- avanza
 * `updatedAt` y, si `refreshedCredentials` viene (el `accessToken` se
 * renovó en memoria durante esta llamada), re-guarda el token nuevo.
 */
export async function markYoutubeConnectionSynced(
  db: Database,
  id: EntityId,
  refreshedCredentials?: YoutubeCredentials,
): Promise<void> {
  await db
    .update(youtubeConnections)
    .set({
      status: "active",
      updatedAt: new Date(),
      ...(refreshedCredentials ? { encryptedCredentials: encryptSecret(JSON.stringify(refreshedCredentials)) } : {}),
    })
    .where(eq(youtubeConnections.id, id));
}

/** Se llama cuando una sincronización en vivo falla por algo que NO es reautorización -- nunca borra la fila. */
export async function markYoutubeConnectionError(db: Database, id: EntityId): Promise<void> {
  await db.update(youtubeConnections).set({ status: "error", updatedAt: new Date() }).where(eq(youtubeConnections.id, id));
}

/** Se llama cuando `YoutubeClient` señala `YoutubeAuthExpiredError`. */
export async function markYoutubeConnectionNeedsReauth(db: Database, id: EntityId): Promise<void> {
  await db
    .update(youtubeConnections)
    .set({ status: "needs_reauth", updatedAt: new Date() })
    .where(eq(youtubeConnections.id, id));
}

/**
 * Conserva la fila, nunca la borra -- pero SÍ borra el secreto en
 * reposo (`encryptedCredentials: null`), no solo cambia `status`. Mismo
 * criterio de seguridad que `disconnectStoredEmailConnection`.
 */
export async function disconnectStoredYoutubeConnection(
  db: Database,
  lifeGraphId: EntityId,
  providerKind: YoutubeProviderKind,
): Promise<void> {
  await db
    .update(youtubeConnections)
    .set({ status: "disconnected", encryptedCredentials: null, updatedAt: new Date() })
    .where(and(eq(youtubeConnections.lifeGraphId, lifeGraphId), eq(youtubeConnections.providerKind, providerKind)));
}
