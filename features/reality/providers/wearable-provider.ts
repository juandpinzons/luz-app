import type { WearableImportResult } from "../domain/wearable-import-result";
import type { WearableProviderKind } from "../domain/wearable-provider-kind";

/**
 * El contrato que cada adaptador concreto (`GarminProvider`, hoy el
 * único) implementa -- mismo espíritu que `CalendarProvider`
 * (ADR-0015: ningún consumidor conoce un SDK/formato de terceros, solo
 * esta interfaz), con una diferencia deliberada: `parseExport` es
 * SÍNCRONA y PURA (sin `Promise`, sin I/O). A diferencia de Calendar/
 * Email (una llamada de red real a un servidor que sigue vivo), no
 * existe hoy una API de Garmin con la que una persona pueda
 * autenticarse el mismo día (Garmin Health API es B2B, requiere
 * aprobación de partner, no self-serve) -- lo único disponible es un
 * archivo que la persona ya exportó a mano desde Garmin Connect.
 * Cuando exista un adaptador con sincronización en vivo real, ese
 * proveedor implementará un método distinto (`sync`, async, mismo
 * patrón que `CalendarProvider`) -- este puerto no se fuerza a
 * anticipar esa forma todavía.
 */
export interface WearableProvider {
  readonly kind: WearableProviderKind;

  /**
   * `raw` es el contenido del archivo tal cual lo exportó el
   * proveedor (JSON hoy) -- nunca un path de archivo ni un stream,
   * para que esto siga siendo puro y fácil de probar con un fixture en
   * memoria. Lanza `Error` con un mensaje explícito si `raw` no tiene
   * una forma reconocible -- nunca devuelve un resultado parcial en
   * silencio ante una entrada irreconocible.
   */
  parseExport(raw: string): WearableImportResult;
}
