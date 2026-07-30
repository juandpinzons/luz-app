import {
  type CalendarConnection,
  type CalendarDescriptor,
  type CalendarEvent,
  type CalendarProviderKind,
  type CalendarSyncCursor,
  type CalendarSyncOptions,
  type CalendarSyncResult,
  type ExternalEventId,
  createExternalCalendarId,
} from "../../domain";
import type { CalendarProvider } from "../calendar-provider";
import { AppleCalendarClient } from "./apple-calendar-client";
import { mapCollectionToDescriptor, mapSyncEntriesToEvents } from "./apple-calendar-mapper";

/** Un objeto plano de un nivel, todos los valores `string` -- forma esperada dentro del `CalendarSyncCursor.token` opaco de este proveedor. */
function isPlainStringRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * `CalendarSyncCursor.token` es opaco por contrato (Fase I,
 * `../../domain/calendar-sync-cursor.ts`) -- este proveedor lo usa
 * para guardar UN `sync-token` de CalDAV POR CALENDARIO, porque
 * WebDAV-Sync (RFC 6578) sincroniza por colección, nunca por cuenta
 * completa, mientras que `CalendarProvider.sync()` (el contrato
 * congelado) no tiene parámetro de calendario. Codificar este estado
 * compuesto DENTRO de la opacidad ya declarada es exactamente para lo
 * que esa opacidad existe -- cero cambio de interfaz.
 */
function decodeCursorState(token: string): Readonly<Record<string, string>> {
  const parsed: unknown = JSON.parse(token);

  if (!isPlainStringRecord(parsed)) {
    throw new Error(
      "AppleCalendarProvider: cursor.token no tiene la forma esperada (objeto plano de string a string).",
    );
  }

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string") {
      throw new Error(
        `AppleCalendarProvider: cursor.token tiene un valor no-string para el calendario "${key}".`,
      );
    }
    result[key] = value;
  }
  return result;
}

function encodeCursorState(state: Readonly<Record<string, string>>): string {
  return JSON.stringify(state);
}

/**
 * Implementación de `CalendarProvider` (`../calendar-provider`, sin
 * modificar) sobre iCloud CalDAV. Ver `../../README.md` para la
 * justificación de por qué CalDAV -- no EventKit (on-device, sin
 * binding server-side) ni ninguna API REST propia (Apple no publica
 * una).
 *
 * Credenciales SOLO por constructor (vía `AppleCalendarClient`), nunca
 * en `listCalendars()`/`sync()` -- el dominio y el puerto no conocen
 * cómo esta clase se autentica, ver `AppleCalendarClient` para el
 * detalle (Basic Auth + contraseña específica de app; iCloud CalDAV no
 * soporta OAuth).
 */
export class AppleCalendarProvider implements CalendarProvider {
  readonly kind: CalendarProviderKind = "apple";

  constructor(private readonly client: AppleCalendarClient) {}

  async listCalendars(connection: CalendarConnection): Promise<CalendarDescriptor[]> {
    void connection; // El cliente ya está autenticado contra una única cuenta -- no hace falta la conexión para decidir A QUIÉN preguntarle.
    const collections = await this.client.listCalendars();
    return collections.map(mapCollectionToDescriptor);
  }

  async sync(
    connection: CalendarConnection,
    cursor: CalendarSyncCursor | null,
    options?: CalendarSyncOptions,
  ): Promise<CalendarSyncResult> {
    const collections = await this.client.listCalendars();
    const previousState = cursor ? decodeCursorState(cursor.token) : {};

    const upserted: CalendarEvent[] = [];
    const deleted: ExternalEventId[] = [];
    const nextState: Record<string, string> = {};

    for (const collection of collections) {
      const calendarId = createExternalCalendarId(collection.href);
      const previousToken = previousState[collection.href];

      try {
        if (previousToken) {
          const report = await this.client.syncCollection(collection.href, previousToken);
          const mapped = mapSyncEntriesToEvents(report.entries, calendarId);
          upserted.push(...mapped.upserted);
          deleted.push(...mapped.deleted);
          nextState[collection.href] = report.newSyncToken;
          continue;
        }

        // Primera vez que se sincroniza ESTE calendario. RFC 6578: un
        // sync-token vacío en sync-collection devuelve el estado
        // COMPLETO actual, sin acotar por tiempo -- si el llamador pidió
        // una ventana, se usa `queryByTimeRange` (RFC 4791 time-range
        // filter) para la carga inicial en su lugar, y `syncCollection`
        // se llama aparte solo para sembrar el sync-token de arranque
        // (su propio listado de resultados se descarta en ese caso, ya
        // se obtuvo la carga real por la vía acotada).
        if (options?.window) {
          const entries = await this.client.queryByTimeRange(collection.href, options.window);
          const mapped = mapSyncEntriesToEvents(entries, calendarId);
          upserted.push(...mapped.upserted);
        }

        const seedReport = await this.client.syncCollection(collection.href, null);
        if (!options?.window) {
          const mapped = mapSyncEntriesToEvents(seedReport.entries, calendarId);
          upserted.push(...mapped.upserted);
          deleted.push(...mapped.deleted);
        }
        nextState[collection.href] = seedReport.newSyncToken;
      } catch (error) {
        // Aislamiento por calendario -- confirmado necesario contra
        // iCloud real: cuentas reales incluyen colecciones especiales
        // (p. ej. una de notificaciones internas) que rechazan
        // `calendar-query` con 403 aunque sí acepten `sync-collection`.
        // Sin este aislamiento, UN calendario así abortaba `sync()`
        // completo, descartando los resultados ya obtenidos de los
        // demás calendarios de la misma cuenta. Si había un token
        // previo, se conserva sin cambios (se reintenta el mismo paso
        // incremental la próxima vez); si no lo había, simplemente no
        // entra a `nextState` (se reintenta como primera sincronización
        // la próxima vez).
        console.error(
          `AppleCalendarProvider.sync: se omitió el calendario "${collection.displayName}" por un error.`,
          error,
        );
        if (previousToken) {
          nextState[collection.href] = previousToken;
        }
      }
    }

    return {
      connectionId: connection.id,
      cursor: {
        providerKind: this.kind,
        token: encodeCursorState(nextState),
        issuedAt: new Date(),
      },
      upserted,
      deleted,
      // iCloud no ha sido verificado empíricamente en esta sesión
      // truncando `sync-collection` (RFC 6578 §3.7 lo permite, pero es
      // opcional del lado del servidor) -- `hasMore` queda `false`
      // siempre en esta implementación. Si una verificación real
      // contra una cuenta con calendarios muy grandes muestra
      // truncamiento, la detección se agrega aquí, sin tocar
      // `CalendarProvider` ni `runCalendarSync` (ambos ya manejan
      // `hasMore: true` correctamente, ver `../../application`).
      hasMore: false,
      syncedAt: new Date(),
    };
  }
}
