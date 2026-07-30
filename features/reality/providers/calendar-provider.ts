import type {
  CalendarConnection,
  CalendarDescriptor,
  CalendarProviderKind,
  CalendarSyncCursor,
  CalendarSyncOptions,
  CalendarSyncResult,
} from "../domain";

/**
 * El único contrato que cada proveedor concreto (`GoogleCalendarProvider`,
 * `AppleCalendarProvider`, `OutlookCalendarProvider` -- ninguno existe
 * todavía, ver README) implementa. Nada en `features/reality/` fuera
 * de una implementación concreta debe importar un SDK, hacer una
 * llamada HTTP, o saber que Google/Apple/Outlook existen -- ese es
 * exactamente el punto de este puerto (mismo principio que
 * `core/connectors/Connector`, ADR-0015: "ningún consumidor conoce un
 * SDK de terceros, ni siquiera indirectamente, solo esta interfaz").
 *
 * Deliberadamente SIN credenciales en ninguna firma: resolver cómo
 * autenticar una llamada real (token, refresh, reintento por 401) es
 * responsabilidad exclusiva de cada clase concreta, inyectada en su
 * propio constructor en una fase futura -- este puerto nunca ve un
 * token, nunca decide cómo se obtiene uno, y por lo tanto no cambia de
 * forma cuando OAuth se implemente. `CalendarConnection` (`../domain`)
 * identifica DE QUÉ cuenta se trata; CÓMO autenticarse contra ella no
 * es parte de esta pregunta.
 *
 * Determinista por diseño: dado el mismo `connection` + `cursor`, se
 * espera el mismo tipo de resultado (una llamada de red real no es
 * determinista byte a byte, pero el CONTRATO sí lo es -- nunca lanza
 * para "no hay cambios", nunca devuelve `undefined` en vez de un
 * arreglo vacío, ver `CalendarSyncResult`).
 */
export interface CalendarProvider {
  readonly kind: CalendarProviderKind;

  /**
   * Los calendarios disponibles dentro de esta cuenta -- quien decide
   * cuáles sincronizar es una decisión de aplicación futura, este
   * método solo informa qué existe.
   */
  listCalendars(connection: CalendarConnection): Promise<CalendarDescriptor[]>;

  /**
   * Una página de sincronización. `cursor: null` significa "primera
   * sincronización, sin estado previo" -- en ese caso `options.window`
   * es obligatorio en la práctica (ver docblock de
   * `CalendarSyncOptions`), aunque el tipo no lo fuerce aquí para no
   * acoplar este contrato a esa regla de negocio; la valida quien
   * orqueste el flujo (`../application/run-calendar-sync`), no el
   * puerto. Con `cursor` no nulo, es una sincronización incremental:
   * el proveedor decide qué tanto de `options` sigue aplicando.
   *
   * Nunca lanza por "sin cambios desde el cursor" -- eso es un
   * `CalendarSyncResult` con `upserted`/`deleted` vacíos y `hasMore:
   * false`, el mismo camino feliz que cualquier otro resultado.
   */
  sync(
    connection: CalendarConnection,
    cursor: CalendarSyncCursor | null,
    options?: CalendarSyncOptions,
  ): Promise<CalendarSyncResult>;
}
