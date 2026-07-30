import type { EntityId } from "../../../core/life/value-objects/entity-id";
import type { CalendarProviderKind } from "./calendar-provider-kind";

/**
 * Ciclo de vida de una conexión -- vocabulario de estado explícito
 * (mismo criterio que `BeliefStatus`/`MemoryStatus`, `core/belief-engine`/
 * `core/memory-engine`), nunca un booleano `connected: boolean` que no
 * puede distinguir "nunca se conectó" de "se desconectó" de "el token
 * expiró y hay que reautorizar".
 *
 * - `active`: sincroniza con normalidad.
 * - `needs_reauth`: la credencial (fuera del alcance de este cimiento,
 *   ver `CalendarConnection` abajo) dejó de servir -- el proveedor
 *   debe pedir reautorización antes de intentar `sync()` de nuevo.
 * - `disconnected`: la persona la desconectó a propósito. Se conserva
 *   la fila (nunca se borra) para no perder el historial de qué
 *   estuvo conectado.
 * - `error`: la última sincronización falló por algo que no es
 *   reautorización (p. ej. el proveedor caído) -- reintentable sin
 *   intervención de la persona, a diferencia de `needs_reauth`.
 */
export const CALENDAR_CONNECTION_STATUSES = [
  "active",
  "needs_reauth",
  "disconnected",
  "error",
] as const;
export type CalendarConnectionStatus = (typeof CALENDAR_CONNECTION_STATUSES)[number];

/**
 * Un vínculo autorizado entre un `LifeGraph` y una cuenta de un
 * proveedor de calendario. Deliberadamente SIN credenciales
 * (`accessToken`/`refreshToken`/OAuth) -- ese es el alcance explícito
 * de una fase futura (mismo patrón ya establecido por
 * `core/connectors/ConnectorCredentials`: la credencial viaja
 * separada del resto del contrato, nunca mezclada en la entidad de
 * dominio). Este cimiento modela QUÉ es una conexión, no CÓMO se
 * autentica.
 *
 * `id`/`lifeGraphId` reutilizan `EntityId` (`core/life`) -- la
 * conexión es una entidad propia de LUZ (algún día una fila en
 * Postgres), a diferencia de `ExternalCalendarId`/`ExternalEventId`,
 * que son opacos y vienen del proveedor.
 */
export interface CalendarConnection {
  readonly id: EntityId;
  readonly lifeGraphId: EntityId;
  readonly providerKind: CalendarProviderKind;
  /** Identificador de cuenta del proveedor (p. ej. el email de la cuenta de Google/iCloud) -- opaco, nunca interpretado aquí. */
  readonly externalAccountId: string;
  readonly status: CalendarConnectionStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
