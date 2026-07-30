const BOGOTA_TIME_ZONE = "America/Bogota";

const HOUR_FORMAT = new Intl.DateTimeFormat("es-CO", {
  hour: "numeric",
  hourCycle: "h23",
  timeZone: BOGOTA_TIME_ZONE,
});

/**
 * Mismo corte mañana/tarde/noche que `timeOfDayGreeting`
 * (`features/dashboard/services/build-morning-brief.ts`), pero sin
 * nombre de persona: la Capa de Presencia solo recibe Snapshot /
 * Observations / Recommendations, nunca datos de identidad.
 */
export function buildGreeting(now: Date): string {
  const hour = Number(HOUR_FORMAT.format(now));
  if (hour >= 5 && hour < 12) return "Buenos días.";
  if (hour >= 12 && hour < 19) return "Buenas tardes.";
  return "Buenas noches.";
}
