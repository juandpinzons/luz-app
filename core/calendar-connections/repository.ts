import { and, eq } from "drizzle-orm";
import { createEntityId, type EntityId } from "../life/value-objects/entity-id";
import type { Database } from "../db/client";
import { calendarConnections, type CalendarConnectionRow } from "../db/schema/calendar-connections";
import { decryptSecret, encryptSecret } from "../security/secret-cipher";
import type { AppleCalendarCredentials } from "../../features/reality/providers/apple";
import type { CalendarConnection, CalendarProviderKind } from "../../features/reality/domain";

/**
 * Capa de persistencia real de `CalendarConnection`
 * (`features/reality/domain/`) -- Calendar Foundation define la forma
 * pero deliberadamente no persiste nada (ver
 * `features/reality/README.md`). Esta es esa capa siguiente, tal como
 * ese README la anticipó ("Puntos de extensión #2").
 *
 * Único lugar de todo el repo que cifra/descifra credenciales de
 * calendario -- ningún llamador debe leer `encryptedCredentials`
 * directo de la fila ni loguear el resultado de `decryptSecret`.
 */

export interface StoredCalendarConnection {
  connection: CalendarConnection;
  /** `null` si la conexión está `disconnected` -- `disconnectStoredCalendarConnection` limpia el secreto en reposo, nunca solo cambia `status`. */
  credentials: AppleCalendarCredentials | null;
}

function toDomainConnection(row: CalendarConnectionRow): CalendarConnection {
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
 * Hoy el único proveedor real es Apple (ver `features/reality/README.md`)
 * -- lanza explícito en vez de devolver credenciales con una forma que
 * el llamador no pidió. `null` si `encryptedCredentials` ya se limpió
 * (conexión `disconnected`) -- nunca intenta descifrar un valor que ya
 * no existe.
 */
function toAppleCredentials(row: CalendarConnectionRow): AppleCalendarCredentials | null {
  if (row.encryptedCredentials === null) {
    return null;
  }
  if (row.providerKind !== "apple") {
    throw new Error(
      `toAppleCredentials: la conexión ${row.id} es de proveedor "${row.providerKind}", no "apple" -- ningún otro proveedor tiene un adaptador real todavía.`,
    );
  }

  const decrypted = JSON.parse(decryptSecret(row.encryptedCredentials)) as AppleCalendarCredentials;
  return decrypted;
}

/**
 * Guarda (o reemplaza, si ya existía una conexión de este proveedor
 * para este `LifeGraph`) una conexión ya validada por
 * `connectCalendar()` (`features/reality/application`) -- este
 * repositorio nunca valida credenciales por su cuenta, solo persiste
 * lo que el llamador ya confirmó que funciona contra el proveedor real.
 */
export async function saveCalendarConnection(
  db: Database,
  lifeGraphId: EntityId,
  providerKind: CalendarProviderKind,
  externalAccountId: string,
  credentials: AppleCalendarCredentials,
): Promise<CalendarConnection> {
  const now = new Date();
  const encryptedCredentials = encryptSecret(JSON.stringify(credentials));

  const [row] = await db
    .insert(calendarConnections)
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
      target: [calendarConnections.lifeGraphId, calendarConnections.providerKind],
      set: { externalAccountId, encryptedCredentials, status: "active", updatedAt: now },
    })
    .returning();

  return toDomainConnection(row);
}

/** `null` si esta persona nunca conectó este proveedor -- Calendar Foundation no distingue ese caso (ver `features/home/README.md`, "calendar es null"), esta es la única capa que sí puede. */
export async function getStoredCalendarConnection(
  db: Database,
  lifeGraphId: EntityId,
  providerKind: CalendarProviderKind,
): Promise<StoredCalendarConnection | null> {
  const [row] = await db
    .select()
    .from(calendarConnections)
    .where(and(eq(calendarConnections.lifeGraphId, lifeGraphId), eq(calendarConnections.providerKind, providerKind)))
    .limit(1);

  if (!row) return null;

  return { connection: toDomainConnection(row), credentials: toAppleCredentials(row) };
}

/** Se llama tras una sincronización en vivo exitosa (ver `app/calendar/page.tsx`) -- avanza `updatedAt` para que `deriveSyncStatus` (`features/reality/application/get-calendar-snapshot.ts`) dejе de reportar "never_synced". */
export async function markCalendarConnectionSynced(db: Database, id: EntityId): Promise<void> {
  await db
    .update(calendarConnections)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(calendarConnections.id, id));
}

/** Se llama cuando una sincronización en vivo falla -- nunca borra la fila (mismo criterio que `disconnectCalendar`, `features/reality/application/disconnect-calendar.ts`: se conserva el historial). */
export async function markCalendarConnectionError(db: Database, id: EntityId): Promise<void> {
  await db.update(calendarConnections).set({ status: "error", updatedAt: new Date() }).where(eq(calendarConnections.id, id));
}

/**
 * Conserva la fila (historial de que existió esta conexión), nunca la
 * borra -- pero SÍ borra el secreto en reposo (`encryptedCredentials:
 * null`), no solo cambia `status`. Auditoría de seguridad, 2026-08-14:
 * antes de este cambio, desconectar era una transición de estado pura
 * que dejaba la contraseña de app de Apple cifrada y recuperable
 * indefinidamente.
 */
export async function disconnectStoredCalendarConnection(
  db: Database,
  lifeGraphId: EntityId,
  providerKind: CalendarProviderKind,
): Promise<void> {
  await db
    .update(calendarConnections)
    .set({ status: "disconnected", encryptedCredentials: null, updatedAt: new Date() })
    .where(and(eq(calendarConnections.lifeGraphId, lifeGraphId), eq(calendarConnections.providerKind, providerKind)));
}
