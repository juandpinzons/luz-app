import type { CalendarEvent } from "./calendar-event";

/**
 * Un hueco sin eventos dentro de la ventana considerada. No asume
 * horario laboral ni ninguna preferencia de la persona -- calcula
 * huecos sobre TODA la ventana que el llamador pidió (ver
 * `getCalendarSnapshot`), nunca inventa un rango "9 a 5" que nadie
 * pidió. Decidir qué parte de un `FreeTimeBlock` es "horario útil"
 * real es una decisión de producto futura, no de este cimiento.
 */
export interface FreeTimeBlock {
  readonly start: Date;
  readonly end: Date;
  readonly durationMinutes: number;
}

/**
 * Uno o más `CalendarEvent` que se solapan (o son adyacentes),
 * fusionados en un solo período -- dos reuniones de 30 minutos que se
 * tocan son un `BusyPeriod` de una hora, no dos entradas separadas.
 * `title` es del PRIMER evento del grupo (por inicio); `eventCount`
 * dice cuántos se fusionaron ahí. Eventos con `status: "cancelled"`
 * nunca cuentan como ocupados -- no representan tiempo real
 * comprometido.
 */
export interface BusyPeriod {
  readonly start: Date;
  readonly end: Date;
  readonly durationMinutes: number;
  readonly title: string;
  readonly eventCount: number;
}

/**
 * Una serie recurrente conocida (`CalendarEvent.recurrence` presente),
 * agrupada por título + regla -- "sabemos que esto se repite", no "esto
 * ocurre en estas fechas". Deliberadamente SIN próxima ocurrencia
 * calculada ni lista de fechas: este cimiento nunca interpreta ni
 * expande `RRULE` (decisión explícita desde la Fase 1, "Reality
 * Provider Foundation" -- ver README, "Qué NO hace este módulo"), así
 * que "cuándo es la próxima" no es una pregunta que pueda responder
 * hoy sin esa capacidad, que no existe en este cimiento.
 */
export interface RecurringCommitment {
  readonly title: string;
  /** La regla RFC 5545 completa (`RRULE:...`), igual que `CalendarRecurrence.rule` -- opaca, ver `calendar-event.ts`. */
  readonly rule: string;
  /** Cuántas instancias de esta serie aparecieron en los eventos considerados -- NO es "cuántas veces se repite en total" (eso exige expandir la regla). */
  readonly occurrencesInWindow: number;
}

/**
 * Estado de sincronización en términos de producto -- deriva de
 * `CalendarConnection.status` (Fase 1), nunca de detalles CalDAV.
 * `"never_synced"`: conexión activa que nunca completó una
 * sincronización. `"syncing"`: en curso -- ningún cálculo puramente
 * derivado de un `CalendarConnection` estático puede producir este
 * valor por sí solo (es un estado transitorio que solo conoce quien
 * está corriendo la sincronización ahora mismo); existe en el
 * vocabulario para que `synchronizeCalendar`/`refreshCalendar`
 * (`../application`) lo usen mientras la operación está en vuelo.
 */
export const CALENDAR_SYNC_STATES = [
  "never_synced",
  "syncing",
  "up_to_date",
  "error",
  "disconnected",
] as const;
export type CalendarSyncState = (typeof CALENDAR_SYNC_STATES)[number];

export interface CalendarSyncStatusInfo {
  readonly state: CalendarSyncState;
  readonly lastSyncedAt?: Date;
  readonly errorMessage?: string;
}

/**
 * La vista canónica del calendario que el resto de LUZ consume --
 * único punto de contacto entre "Calendar Foundation" y cualquier
 * feature de producto (Fase 4: "el resto de LUZ nunca debe saber si
 * los datos vienen de Apple/Google/Outlook/CalDAV"). Vocabulario
 * exclusivamente de producto: nada de XML, nada de CalDAV, nada
 * específico de un proveedor -- reutiliza `CalendarEvent` para
 * `today`/`upcoming` porque ya es neutral por diseño (Fase 1); su
 * único campo de escape (`raw`) sigue siendo responsabilidad exclusiva
 * de quien lo llenó, ningún consumidor de `CalendarSnapshot` debe
 * leerlo.
 *
 * **Limitación real, documentada a propósito (ver README, "Qué NO
 * hace este módulo"):** `today`/`upcoming` reflejan las fechas
 * CONCRETAS que el proveedor ya devolvió -- nunca se expande una
 * `RRULE` para calcular en qué fechas futuras cae cada ocurrencia de
 * una serie recurrente. Una serie recurrente sin una instancia
 * concreta ya sincronizada para hoy/pronto simplemente no aparece en
 * esas dos listas, aunque sí aparece en `recurringCommitments` (que no
 * necesita fechas, solo sabe que la serie existe).
 */
export interface CalendarSnapshot {
  readonly generatedAt: Date;
  readonly today: readonly CalendarEvent[];
  readonly upcoming: readonly CalendarEvent[];
  readonly freeBlocks: readonly FreeTimeBlock[];
  readonly busyPeriods: readonly BusyPeriod[];
  readonly recurringCommitments: readonly RecurringCommitment[];
  readonly syncStatus: CalendarSyncStatusInfo;
}
