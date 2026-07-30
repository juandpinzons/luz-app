/**
 * Ventana de tiempo a sincronizar -- obligatoria en la primera
 * sincronización (sin `CalendarSyncCursor` previo) porque el
 * calendario de una persona real es efectivamente ilimitado hacia
 * atrás (años de eventos recurrentes) y hacia adelante; los tres
 * proveedores objetivo exigen algún acotamiento en la carga inicial,
 * ninguno ofrece "tráeme todo". En sincronizaciones incrementales
 * (con cursor) la ventana es opcional -- el cursor ya acota qué cambió
 * desde la última vez.
 */
export interface CalendarSyncWindow {
  readonly from: Date;
  readonly to: Date;
}

/**
 * Parámetros de una llamada a `CalendarProvider.sync()`. `pageSizeHint`
 * es exactamente eso -- una sugerencia, nunca una garantía: cada
 * proveedor pagina a su manera (o no pagina en absoluto para
 * calendarios pequeños), y `CalendarSyncResult.hasMore` es la única
 * señal confiable de que falta más por traer.
 */
export interface CalendarSyncOptions {
  readonly window?: CalendarSyncWindow;
  readonly pageSizeHint?: number;
}
