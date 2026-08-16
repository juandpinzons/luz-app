/** Reubicado a core/calendar-connections/domain/ (auditoría de arquitectura, 2026-08-15) --
 *  core/calendar-connections/repository.ts es quien persiste esta forma, y core/ no puede
 *  importar de features/. Re-export para que ningún consumidor de features/reality/domain
 *  tenga que cambiar. */
export type { CalendarConnection, CalendarConnectionStatus } from "../../../core/calendar-connections/domain";
export { CALENDAR_CONNECTION_STATUSES } from "../../../core/calendar-connections/domain";
