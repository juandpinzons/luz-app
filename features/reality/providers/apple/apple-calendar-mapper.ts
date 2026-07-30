import {
  type CalendarAttendee,
  type CalendarAttendeeResponseStatus,
  type CalendarDescriptor,
  type CalendarEvent,
  type CalendarEventStatus,
  type CalendarEventTiming,
  type ExternalCalendarId,
  type ExternalEventId,
  createExternalCalendarId,
  createExternalEventId,
} from "../../domain";
import type { CalDavCalendarCollection, CalDavSyncEntry } from "./apple-calendar-client";

/**
 * Toda traducción entre las formas crudas de CalDAV/iCalendar y el
 * dominio (`../../domain`) vive exclusivamente aquí -- funciones
 * puras, sin I/O. `apple-calendar-provider.ts` es el único llamador.
 *
 * Decisión de identidad clave: `ExternalEventId` se construye a partir
 * del `href` del recurso CalDAV, NUNCA del `UID` de iCalendar. Razón
 * real, no estilística: una entrada "borrada" de `sync-collection`
 * (RFC 6578) solo trae `href` -- nunca `calendar-data`, así que el
 * `UID` no existe para reconstruirlo en ese caso. El `href` sí está
 * presente siempre, en encontrados y en borrados por igual, y es
 * estable por diseño del protocolo (RFC 4791: cada recurso de
 * calendario tiene su propia URL, que no cambia entre sincronizaciones).
 * El `UID` real queda preservado en `CalendarEvent.raw.uid` para quien
 * lo necesite.
 */

/** RFC 5545 §3.1: una línea continuación empieza con UN espacio o tab. */
function unfoldIcalLines(raw: string): string[] {
  const rawLines = raw.split(/\r\n|\n|\r/);
  const unfolded: string[] = [];
  for (const line of rawLines) {
    if ((line.startsWith(" ") || line.startsWith("\t")) && unfolded.length > 0) {
      const previousIndex = unfolded.length - 1;
      unfolded[previousIndex] = `${unfolded[previousIndex]}${line.slice(1)}`;
    } else if (line.length > 0) {
      unfolded.push(line);
    }
  }
  return unfolded;
}

interface IcalProperty {
  readonly name: string;
  readonly params: ReadonlyMap<string, string>;
  readonly value: string;
}

/** Busca el primer `:` que NO está dentro de un valor de parámetro entre comillas -- p. ej. `ATTENDEE;CN="Doe, John":mailto:john@x.com` debe cortar en el segundo `:`, no en uno que no existe dentro de las comillas de este ejemplo, pero sí importa cuando `CN` contiene texto con `:` literal. */
function findValueSeparatorIndex(line: string): number {
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ":" && !inQuotes) {
      return index;
    }
  }
  return -1;
}

function parseIcalLine(line: string): IcalProperty | null {
  const separatorIndex = findValueSeparatorIndex(line);
  if (separatorIndex === -1) {
    return null;
  }

  const head = line.slice(0, separatorIndex);
  const value = line.slice(separatorIndex + 1);
  const [rawName, ...paramParts] = head.split(";");

  const params = new Map<string, string>();
  for (const part of paramParts) {
    const eqIndex = part.indexOf("=");
    if (eqIndex === -1) continue;
    const key = part.slice(0, eqIndex).toUpperCase();
    const paramValue = part.slice(eqIndex + 1).replace(/^"|"$/g, "");
    params.set(key, paramValue);
  }

  return { name: (rawName ?? "").toUpperCase(), params, value };
}

/** Un bloque `VEVENT` como el arreglo de sus propiedades ya parseadas -- una propiedad puede repetirse (`ATTENDEE`), de ahí el arreglo por nombre. */
function indexVEventProperties(lines: readonly string[]): ReadonlyMap<string, IcalProperty[]> {
  const index = new Map<string, IcalProperty[]>();
  for (const line of lines) {
    const property = parseIcalLine(line);
    if (!property) continue;
    const existing = index.get(property.name) ?? [];
    existing.push(property);
    index.set(property.name, existing);
  }
  return index;
}

function firstProperty(
  index: ReadonlyMap<string, IcalProperty[]>,
  name: string,
): IcalProperty | undefined {
  return index.get(name)?.[0];
}

/** Todos los bloques `BEGIN:VEVENT...END:VEVENT` de un `VCALENDAR` -- puede haber más de uno cuando el recurso incluye el evento maestro de una serie recurrente MÁS una o más excepciones editadas (mismo `UID`, cada una con su propio `RECURRENCE-ID`), forma habitual en la que iCloud almacena esas excepciones dentro del mismo recurso. */
function extractVEventBlocks(unfoldedLines: readonly string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] | null = null;

  for (const line of unfoldedLines) {
    if (line === "BEGIN:VEVENT") {
      current = [];
    } else if (line === "END:VEVENT") {
      if (current) blocks.push(current);
      current = null;
    } else if (current) {
      current.push(line);
    }
  }

  return blocks;
}

function parseUtcIcalDateTime(rawValue: string): Date {
  const clean = rawValue.trim().replace(/Z$/, "");
  const iso = `${clean.slice(0, 4)}-${clean.slice(4, 6)}-${clean.slice(6, 8)}T${clean.slice(9, 11)}:${clean.slice(11, 13)}:${clean.slice(13, 15)}Z`;
  return new Date(iso);
}

/**
 * Offset (en minutos) de `timeZone` respecto a UTC en el instante
 * `utcGuess`, usando `Intl.DateTimeFormat` -- técnica estándar y
 * correcta sin depender de una librería de zonas horarias: se formatea
 * el instante EN esa zona y se compara contra el instante mismo. Caso
 * límite conocido y aceptado: un instante que cae exactamente en el
 * segundo de una transición de horario de verano puede resolver al
 * offset incorrecto (ambigüedad inherente, no específica de esta
 * técnica).
 *
 * `Intl.DateTimeFormat` lanza `RangeError` si `timeZone` no es un
 * identificador IANA reconocido -- posible en la práctica (aunque no
 * observado contra iCloud en esta sesión) para un `VEVENT` importado
 * desde otro sistema con su propio `VTIMEZONE` de nombre no estándar
 * (p. ej. nombres de zona de Windows/Exchange). Bug de auditoría
 * corregido aquí: sin el `try/catch`, UN evento con un `TZID` exótico
 * abortaba con excepción no capturada toda la sincronización de la
 * página completa, no solo ese evento -- ahora se aproxima a UTC
 * (offset 0, misma aproximación ya usada para "hora flotante",
 * documentada como simplificación aceptada, no como resuelto con
 * precisión real).
 */
function resolveUtcOffsetMinutes(utcGuess: Date, timeZone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const parts = formatter.formatToParts(utcGuess);
    const get = (type: string): number => {
      const part = parts.find((entry) => entry.type === type);
      return part ? Number.parseInt(part.value, 10) : 0;
    };

    const asIfUtc = Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour"),
      get("minute"),
      get("second"),
    );

    return (asIfUtc - utcGuess.getTime()) / 60_000;
  } catch {
    return 0;
  }
}

function zonedWallTimeToUtc(rawValue: string, timeZone: string): Date {
  const year = Number.parseInt(rawValue.slice(0, 4), 10);
  const month = Number.parseInt(rawValue.slice(4, 6), 10);
  const day = Number.parseInt(rawValue.slice(6, 8), 10);
  const hour = Number.parseInt(rawValue.slice(9, 11), 10);
  const minute = Number.parseInt(rawValue.slice(11, 13), 10);
  const second = Number.parseInt(rawValue.slice(13, 15), 10);

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const offsetMinutes = resolveUtcOffsetMinutes(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offsetMinutes * 60_000);
}

function formatIcalDateAsIso(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
}

function addDaysToIsoDate(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map((part) => Number.parseInt(part, 10));
  const date = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
  date.setUTCDate(date.getUTCDate() + days);
  const yyyy = date.getUTCFullYear().toString().padStart(4, "0");
  const mm = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = date.getUTCDate().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Un valor `DTSTART`/`DTEND` con hora -- `Z` es UTC explícito; con `TZID` es hora local de esa zona; sin ninguno de los dos es "hora flotante" (rara, válida por spec), aproximada a UTC (simplificación documentada, no resuelta con precisión real). */
function resolveTimedInstant(raw: string, tzid: string | undefined): { dateTime: Date; timeZone: string } {
  if (raw.endsWith("Z")) {
    return { dateTime: parseUtcIcalDateTime(raw), timeZone: "UTC" };
  }
  if (tzid) {
    return { dateTime: zonedWallTimeToUtc(raw, tzid), timeZone: tzid };
  }
  return { dateTime: parseUtcIcalDateTime(`${raw}Z`), timeZone: "UTC" };
}

/**
 * `DURATION` (RFC 5545 §3.3.6) -- gramática restringida respecto a
 * ISO 8601 completo (sin componente de años/meses): `P(nW)? (nD)?
 * (T (nH)? (nM)? (nS)?)?`. Ejemplos reales: `PT1H30M` (1.5 horas),
 * `P1D` (un día), `P1DT2H` (1 día + 2 horas). `null` si el valor no
 * matchea la gramática -- el llamador decide el fallback, esta función
 * nunca inventa una duración.
 */
function parseIcalDurationMs(value: string): number | null {
  const match =
    /^([+-]?)P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(value.trim());
  if (!match) {
    return null;
  }

  const [, sign, weeks, days, hours, minutes, seconds] = match;
  const totalMs =
    Number(weeks ?? 0) * 7 * 24 * 60 * 60 * 1000 +
    Number(days ?? 0) * 24 * 60 * 60 * 1000 +
    Number(hours ?? 0) * 60 * 60 * 1000 +
    Number(minutes ?? 0) * 60 * 1000 +
    Number(seconds ?? 0) * 1000;

  return sign === "-" ? -totalMs : totalMs;
}

/**
 * `DTSTART` + (`DTEND` o `DURATION`, en ese orden de preferencia --
 * RFC 5545 prohíbe que un VEVENT tenga ambos a la vez) -> intervalo
 * completo. Reglas de fin faltante, ninguna inventada, todas del RFC:
 * - Todo-el-día sin `DTEND`: RFC 5545 §3.6.1, se asume un día de
 *   duración (`endDate` = `date` + 1 día).
 * - Con hora, sin `DTEND` ni `DURATION` parseable: §3.6.1, el evento
 *   no tiene duración definida -- se representa como instante puntual
 *   (`endDateTime === dateTime`), nunca se inventa una duración típica
 *   (p. ej. "1 hora por defecto" no es un valor del RFC).
 */
function parseIcalTiming(
  startProperty: IcalProperty,
  endProperty: IcalProperty | undefined,
  durationProperty: IcalProperty | undefined,
): CalendarEventTiming {
  if (startProperty.params.get("VALUE") === "DATE") {
    const date = formatIcalDateAsIso(startProperty.value.trim());
    const endDate = endProperty
      ? formatIcalDateAsIso(endProperty.value.trim())
      : addDaysToIsoDate(date, 1);
    return { isAllDay: true, date, endDate };
  }

  const { dateTime, timeZone } = resolveTimedInstant(
    startProperty.value.trim(),
    startProperty.params.get("TZID"),
  );

  if (endProperty) {
    const end = resolveTimedInstant(endProperty.value.trim(), endProperty.params.get("TZID"));
    return { isAllDay: false, dateTime, timeZone, endDateTime: end.dateTime, endTimeZone: end.timeZone };
  }

  if (durationProperty) {
    const durationMs = parseIcalDurationMs(durationProperty.value);
    if (durationMs !== null) {
      return {
        isAllDay: false,
        dateTime,
        timeZone,
        endDateTime: new Date(dateTime.getTime() + durationMs),
        endTimeZone: timeZone,
      };
    }
  }

  return { isAllDay: false, dateTime, timeZone, endDateTime: dateTime, endTimeZone: timeZone };
}

function mapStatus(property: IcalProperty | undefined): CalendarEventStatus {
  switch (property?.value.trim().toUpperCase()) {
    case "TENTATIVE":
      return "tentative";
    case "CANCELLED":
      return "cancelled";
    default:
      return "confirmed";
  }
}

function extractMailto(value: string): string {
  return value.replace(/^mailto:/i, "").trim();
}

/** `NEEDS-ACTION`/`DELEGATED`/cualquier valor no reconocido caen en `"needs_action"` -- mismo criterio conservador que el resto del dominio (Fase I): nunca se afirma una respuesta que el evento no confirmó explícitamente. */
function mapParticipationStatus(raw: string | undefined): CalendarAttendeeResponseStatus {
  switch (raw?.toUpperCase()) {
    case "ACCEPTED":
      return "accepted";
    case "DECLINED":
      return "declined";
    case "TENTATIVE":
      return "tentative";
    default:
      return "needs_action";
  }
}

function mapAttendees(
  attendeeProperties: readonly IcalProperty[],
  organizerEmail: string | null,
): CalendarAttendee[] {
  return attendeeProperties.map((property) => {
    const email = extractMailto(property.value);
    return {
      email,
      displayName: property.params.get("CN"),
      responseStatus: mapParticipationStatus(property.params.get("PARTSTAT")),
      isOrganizer:
        organizerEmail !== null && email.toLowerCase() === organizerEmail.toLowerCase(),
    };
  });
}

/**
 * Sentinel para una excepción de recurrencia (`RECURRENCE-ID` sin
 * `RRULE` propio) cuando el evento maestro NO está en el mismo
 * recurso -- posible según el servidor (algunos guardan cada
 * excepción como un recurso CalDAV aparte en vez de inline, ver
 * docblock del archivo). En ese caso no hay ningún `RRULE` real que
 * citar; se documenta explícitamente en vez de dejar una cadena vacía
 * sin explicación.
 */
const RECURRENCE_MASTER_UNAVAILABLE_RULE = "RRULE:UNKNOWN;X-LUZ-MASTER-NOT-IN-RESOURCE=true";

/**
 * Un bloque `VEVENT` -> `CalendarEvent`. `resourceHref` identifica el
 * RECURSO (una URL CalDAV puede contener el evento maestro + sus
 * excepciones, ver docblock del archivo); `RECURRENCE-ID` distingue
 * cuál VEVENT dentro de ese recurso es cuál. `masterRuleText` es el
 * `RRULE` (ya sin el prefijo `RRULE:`) del evento maestro DEL MISMO
 * recurso, si `mapCalendarDataToEvents` lo encontró -- se reutiliza en
 * las excepciones (que no traen su propio `RRULE`) para que
 * `CalendarRecurrence.rule` describa la serie real en vez de quedar
 * vacío (bug de auditoría corregido: antes toda excepción recibía
 * `rule: ""`, un valor sin ningún significado documentado).
 */
function mapVEventBlock(
  properties: ReadonlyMap<string, IcalProperty[]>,
  resourceHref: string,
  calendarId: ExternalCalendarId,
  masterRuleText: string | undefined,
): CalendarEvent | null {
  const summary = firstProperty(properties, "SUMMARY");
  const dtstart = firstProperty(properties, "DTSTART");
  const dtend = firstProperty(properties, "DTEND");
  const duration = firstProperty(properties, "DURATION");
  const lastModified = firstProperty(properties, "LAST-MODIFIED") ?? firstProperty(properties, "DTSTAMP");
  const uid = firstProperty(properties, "UID");
  const recurrenceId = firstProperty(properties, "RECURRENCE-ID");
  const rrule = firstProperty(properties, "RRULE");
  const organizer = firstProperty(properties, "ORGANIZER");
  const description = firstProperty(properties, "DESCRIPTION");
  const location = firstProperty(properties, "LOCATION");
  const attendees = properties.get("ATTENDEE") ?? [];

  if (!dtstart || !lastModified) {
    // Un VEVENT sin DTSTART o sin marca de última modificación no es
    // representable en el dominio (ambos son obligatorios en
    // `CalendarEvent`) -- se descarta en vez de inventar un valor.
    return null;
  }

  const id = recurrenceId
    ? createExternalEventId(`${resourceHref}#${recurrenceId.value.trim()}`)
    : createExternalEventId(resourceHref);

  const organizerEmail = organizer ? extractMailto(organizer.value) : null;

  return {
    id,
    calendarId,
    title: summary?.value.trim() ?? "",
    description: description?.value.trim() || undefined,
    location: location?.value.trim() || undefined,
    status: mapStatus(firstProperty(properties, "STATUS")),
    timing: parseIcalTiming(dtstart, dtend, duration),
    recurrence: rrule
      ? { rule: `RRULE:${rrule.value.trim()}` }
      : recurrenceId
        ? {
            rule: masterRuleText ? `RRULE:${masterRuleText}` : RECURRENCE_MASTER_UNAVAILABLE_RULE,
            recurringEventId: createExternalEventId(resourceHref),
          }
        : undefined,
    attendees: mapAttendees(attendees, organizerEmail),
    lastModifiedAt: parseUtcIcalDateTime(lastModified.value),
    raw: uid ? { uid: uid.value.trim() } : undefined,
  };
}

/**
 * El `calendar-data` completo de un recurso (uno o más `VEVENT`, ver
 * docblock del archivo) -> uno o más `CalendarEvent`. Un bloque
 * `VEVENT` individual mal formado (p. ej. sin `DTSTART`) ya se
 * descarta limpiamente en `mapVEventBlock`; esta función además aísla
 * cualquier excepción INESPERADA por bloque (bug de auditoría
 * corregido: sin este aislamiento, un solo `VEVENT` corrupto abortaba
 * el mapeo de TODO el recurso, incluidos otros `VEVENT` válidos en el
 * mismo `calendar-data`) -- se registra con `console.error` y se
 * continúa con los demás bloques, nunca se propaga silenciosamente ni
 * aborta el resto.
 */
export function mapCalendarDataToEvents(
  calendarData: string,
  resourceHref: string,
  calendarId: ExternalCalendarId,
): CalendarEvent[] {
  const unfolded = unfoldIcalLines(calendarData);
  const blocks = extractVEventBlocks(unfolded).map(indexVEventProperties);

  const masterBlock = blocks.find((block) => !firstProperty(block, "RECURRENCE-ID"));
  const masterRuleText = masterBlock ? firstProperty(masterBlock, "RRULE")?.value.trim() : undefined;

  const events: CalendarEvent[] = [];
  for (const properties of blocks) {
    try {
      const mapped = mapVEventBlock(properties, resourceHref, calendarId, masterRuleText);
      if (mapped) events.push(mapped);
    } catch (error) {
      console.error(
        `apple-calendar-mapper: se descartó un VEVENT de "${resourceHref}" por un error inesperado al mapearlo.`,
        error,
      );
    }
  }
  return events;
}

/**
 * `CalDavCalendarCollection` -> `CalendarDescriptor`. `isPrimary`
 * siempre `false`: CalDAV (RFC 4791) no define un concepto estándar de
 * "calendario primario" equivalente al `id: "primary"` de Google
 * Calendar API -- iCloud sí tiene un calendario por defecto interno,
 * descubrible vía `schedule-default-calendar-URL` (RFC 6638), pero esa
 * llamada adicional queda fuera del alcance de este proveedor por
 * ahora (limitación documentada, no un error).
 */
export function mapCollectionToDescriptor(collection: CalDavCalendarCollection): CalendarDescriptor {
  return {
    id: createExternalCalendarId(collection.href),
    displayName: collection.displayName,
    isPrimary: false,
    isWritable: !collection.isReadOnly,
  };
}

export interface MappedSyncEntries {
  readonly upserted: readonly CalendarEvent[];
  readonly deleted: readonly ExternalEventId[];
}

/**
 * Entradas crudas de `AppleCalendarClient.syncCollection()`/
 * `queryByTimeRange()` -> delta de dominio. Una entrada "deleted" solo
 * trae `href` (ver docblock del archivo) -- se usa directamente como
 * `ExternalEventId`, consistente con que ese es el mismo `id` que un
 * evento maestro habría tenido si `apple-calendar-mapper` lo hubiera
 * visto "found" en una sincronización anterior.
 *
 * Un recurso individual que falle inesperadamente al mapearse
 * (`mapCalendarDataToEvents` ya aísla por `VEVENT`, esto aísla por
 * RECURSO -- p. ej. un `calendar-data` completo que no sea texto
 * iCalendar válido) se descarta con `console.error`, nunca aborta el
 * resto de la página.
 */
export function mapSyncEntriesToEvents(
  entries: readonly CalDavSyncEntry[],
  calendarId: ExternalCalendarId,
): MappedSyncEntries {
  const upserted: CalendarEvent[] = [];
  const deleted: ExternalEventId[] = [];

  for (const entry of entries) {
    if (entry.status === "deleted") {
      deleted.push(createExternalEventId(entry.href));
      continue;
    }

    if (!entry.calendarData) {
      continue;
    }

    try {
      upserted.push(...mapCalendarDataToEvents(entry.calendarData, entry.href, calendarId));
    } catch (error) {
      console.error(
        `apple-calendar-mapper: se descartó el recurso "${entry.href}" por un error inesperado al mapearlo.`,
        error,
      );
    }
  }

  return { upserted, deleted };
}
