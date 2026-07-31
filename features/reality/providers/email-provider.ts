import type {
  EmailConnection,
  EmailProviderKind,
  EmailSyncCursor,
  EmailSyncOptions,
  EmailSyncResult,
} from "../domain";

/**
 * Un contenedor de mensajes disponible dentro de esta cuenta -- la
 * bandeja de entrada, una etiqueta de sistema (`IMPORTANT`, `SENT`), o
 * una etiqueta personalizada de la persona. Mismo rol que
 * `CalendarDescriptor` (`./calendar-provider.ts`): `EmailProvider.
 * listLabels()` informa qué existe, decidir cuáles usar es una
 * decisión de aplicación futura.
 */
export interface EmailLabelDescriptor {
  readonly id: string;
  readonly displayName: string;
  /** `"system"` = etiqueta propia del proveedor (Gmail: `INBOX`/`UNREAD`/`IMPORTANT`/`CATEGORY_*`, siempre presente en toda cuenta). `"user"` = etiqueta creada por la persona -- puede no existir en ninguna cuenta. */
  readonly kind: "system" | "user";
}

/**
 * El único contrato que cada proveedor concreto (`GmailProvider`,
 * `OutlookMailProvider` -- este último no existe todavía) implementa.
 * Mismo principio que `CalendarProvider` (`./calendar-provider.ts`,
 * sin modificar): nada en `features/reality/` fuera de una
 * implementación concreta debe importar un SDK, hacer una llamada
 * HTTP, o saber que Gmail/Outlook existen.
 *
 * Deliberadamente SIN credenciales en ninguna firma -- mismo criterio
 * que `CalendarProvider`: resolver cómo autenticar una llamada real
 * (access token, refresh, reintento por 401) es responsabilidad
 * exclusiva de cada clase concreta, inyectada en su propio constructor
 * (ver `GmailCredentials`, `./gmail/gmail-client.ts`).
 *
 * Determinista por diseño: dado el mismo `connection` + `cursor`, se
 * espera el mismo tipo de resultado -- nunca lanza para "no hay
 * cambios", nunca devuelve `undefined` en vez de un arreglo vacío (ver
 * `EmailSyncResult`).
 */
export interface EmailProvider {
  readonly kind: EmailProviderKind;

  /**
   * Las etiquetas/carpetas disponibles dentro de esta cuenta. Cumple el
   * mismo doble rol que `CalendarProvider.listCalendars()`: informa qué
   * existe Y sirve como la llamada de validación de `connectGmail()`
   * (`../application/connect-gmail.ts`) -- credenciales inválidas
   * fallan ahí, nunca en silencio en el primer `sync()`.
   */
  listLabels(connection: EmailConnection): Promise<readonly EmailLabelDescriptor[]>;

  /**
   * Una página de sincronización. `cursor: null` significa "primera
   * sincronización, sin estado previo". Con `cursor` no nulo, es una
   * sincronización incremental -- el proveedor decide qué tanto de
   * `options` sigue aplicando.
   *
   * El proveedor concreto es responsable de hacer cumplir
   * `EMAIL_SYNC_HARD_CEILING` (`../domain/email-sync-options.ts`) --
   * este puerto no lo fuerza en su firma (sería acoplar el contrato a
   * una regla de negocio de esta fase concreta), pero ningún
   * `EmailProvider` correcto debe devolver más mensajes conocidos de
   * los que esa constante permite.
   *
   * Nunca lanza por "sin cambios desde el cursor" -- eso es un
   * `EmailSyncResult` con `upserted`/`deleted` vacíos y `hasMore:
   * false`, el mismo camino feliz que cualquier otro resultado.
   */
  sync(
    connection: EmailConnection,
    cursor: EmailSyncCursor | null,
    options?: EmailSyncOptions,
  ): Promise<EmailSyncResult>;
}
