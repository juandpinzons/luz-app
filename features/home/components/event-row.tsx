import type { CalendarEvent } from "@/features/reality/domain";

/** Compartido entre `/calendar` y la sección de calendario de `/dashboard` -- una sola forma de mostrar un evento, nunca dos plantillas que puedan divergir. */

const TIME_FORMAT = new Intl.DateTimeFormat("es-CO", {
  hour: "numeric",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "America/Bogota",
});

const DATE_FORMAT = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Bogota",
});

export function eventStart(event: CalendarEvent): Date {
  return event.timing.isAllDay ? new Date(`${event.timing.date}T00:00:00Z`) : event.timing.dateTime;
}

export function formatEventWhen(event: CalendarEvent): string {
  if (event.timing.isAllDay) return "Todo el día";
  return `${TIME_FORMAT.format(event.timing.dateTime)} – ${TIME_FORMAT.format(event.timing.endDateTime)}`;
}

export function EventRow({ event }: { event: CalendarEvent }) {
  return (
    <li className="rounded-lg border border-zinc-800 px-4 py-3 text-sm">
      <p className="text-zinc-100">{event.title}</p>
      <p className="mt-1 text-zinc-500">
        {DATE_FORMAT.format(eventStart(event))} · {formatEventWhen(event)}
      </p>
    </li>
  );
}
