import { type EntityId, createEntityId } from "../../../core/life/value-objects/entity-id";
import type { CalendarConnection } from "../domain";
import type { CalendarProvider } from "../providers";

export interface ConnectCalendarInput {
  readonly lifeGraphId: EntityId;
  /** Identificador de cuenta del proveedor (p. ej. el Apple ID / email) -- opaco para este caso de uso, solo se guarda. */
  readonly externalAccountId: string;
}

/**
 * "Conectar" significa poder hablar de verdad con el proveedor, no
 * solo construir un objeto -- `provider.listCalendars()` se llama una
 * vez para validar; unas credenciales inválidas fallan aquí, nunca en
 * silencio en el primer `synchronizeCalendar()` más adelante. `provider`
 * ya viene construido e inyectado por el llamador (con sus
 * credenciales, sea cual sea el proveedor) -- este caso de uso nunca
 * sabe qué proveedor concreto es ni cómo se autentica, solo depende
 * del puerto `CalendarProvider` (`../providers`).
 *
 * No persiste nada -- no existe una capa de persistencia en este
 * cimiento (ver README, "Qué NO hace este módulo"). El
 * `CalendarConnection` devuelto es la fila que un futuro llamador
 * (Product Engineering) decide cómo y dónde guardar.
 */
export async function connectCalendar(
  provider: CalendarProvider,
  input: ConnectCalendarInput,
): Promise<CalendarConnection> {
  const now = new Date();

  const connection: CalendarConnection = {
    id: createEntityId(crypto.randomUUID()),
    lifeGraphId: input.lifeGraphId,
    providerKind: provider.kind,
    externalAccountId: input.externalAccountId,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  await provider.listCalendars(connection);

  return connection;
}
