import type { EntityId } from "../../../core/life/value-objects/entity-id";
import type { EmailProviderKind } from "./email-provider-kind";

/**
 * Ciclo de vida de una conexión de correo -- mismo vocabulario y misma
 * razón de ser que `CalendarConnectionStatus`
 * (`./calendar-connection.ts`): nunca un booleano `connected: boolean`
 * que no puede distinguir "nunca se conectó" de "se desconectó" de "el
 * token expiró y hay que reautorizar". Definido de forma independiente
 * (no reutiliza `CalendarConnectionStatus`) a propósito -- mismo
 * criterio que ya usa este módulo para `CalendarEventStatus` vs
 * `CalendarAttendeeResponseStatus`: cada unión vive sola, ninguna
 * obliga a las demás a cambiar de forma si un proveedor de correo
 * necesita un estado que uno de calendario no tiene (o viceversa).
 *
 * - `active`: sincroniza con normalidad.
 * - `needs_reauth`: el access token dejó de servir y el refresh token
 *   (si existía) tampoco pudo renovarlo -- ver
 *   `providers/gmail/gmail-client.ts`. El proveedor debe pedir
 *   reautorización antes de intentar `sync()` de nuevo.
 * - `disconnected`: la persona la desconectó a propósito. Se conserva
 *   la fila (nunca se borra) para no perder el historial de qué estuvo
 *   conectado.
 * - `error`: la última sincronización falló por algo que no es
 *   reautorización (p. ej. el proveedor caído) -- reintentable sin
 *   intervención de la persona, a diferencia de `needs_reauth`.
 */
export const EMAIL_CONNECTION_STATUSES = ["active", "needs_reauth", "disconnected", "error"] as const;
export type EmailConnectionStatus = (typeof EMAIL_CONNECTION_STATUSES)[number];

/**
 * Un vínculo autorizado entre un `LifeGraph` y una cuenta de un
 * proveedor de correo. Deliberadamente SIN credenciales (`accessToken`/
 * `refreshToken`) -- mismo principio que `CalendarConnection`
 * (`./calendar-connection.ts`): la credencial viaja separada del resto
 * del contrato (ver `GmailCredentials`,
 * `providers/gmail/gmail-client.ts`), nunca mezclada en la entidad de
 * dominio. Este cimiento modela QUÉ es una conexión, no CÓMO se
 * autentica -- persistirla (y por lo tanto decidir cómo guardar la
 * credencial real) es una decisión de una fase futura, tal como ya lo
 * fue para Calendar Foundation (ver `../README.md`).
 */
export interface EmailConnection {
  readonly id: EntityId;
  readonly lifeGraphId: EntityId;
  readonly providerKind: EmailProviderKind;
  /** Identificador de cuenta del proveedor (la dirección de correo de la cuenta) -- opaco, nunca interpretado aquí. */
  readonly externalAccountId: string;
  readonly status: EmailConnectionStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
