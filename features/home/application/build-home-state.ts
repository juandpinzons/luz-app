import type { LifeDashboardSnapshot } from "../../dashboard/services/build-life-dashboard-snapshot";
import type { FollowUpRecommendation } from "../../dashboard/services/build-follow-up-recommendations";
import type { LifeObservation } from "../../dashboard/services/build-life-observations";
import type { PresenceState } from "../../presence/domain/presence-state";
import type { CalendarSnapshot } from "../../reality/domain";
import type { HomeState } from "../domain/home-state";
import { buildCalendarContext } from "../services/build-calendar-context";
import { buildLifeContext } from "../services/build-life-context";
import { buildQuickActions } from "../services/build-quick-actions";

/**
 * Punto de entrada público de Home. Presence ya decidió saludo, foco,
 * urgencia y las recomendaciones accionables/celebratorias; Calendar
 * Foundation ya decidió qué está ocupado/libre/próximo/recurrente --
 * esta función nunca vuelve a rankear ni a recalcular nada de eso,
 * solo lo compone y agrega lo que ninguno de los dos cubre (contexto
 * general de vida y compromisos del Life Graph con fecha, derivados
 * directamente del snapshot). Home no es un segundo motor de decisión
 * (ver `features/home/README.md`). Ningún repositorio, ninguna
 * consulta, ningún motor nuevo, ninguna IA. Determinístico: mismas
 * cinco entradas siempre producen el mismo `HomeState`.
 *
 * `calendar` es `null` cuando la persona no tiene un calendario
 * conectado -- Calendar Foundation no persiste nada (ver
 * `features/reality/README.md`), así que esa ausencia la conoce
 * únicamente quien llama a esta función, nunca Home por sí solo.
 *
 * **Límite heredado, sin resolver a propósito:** `calendar.today`/
 * `calendar.upcomingEvents` reflejan las fronteras de "hoy" en UTC que
 * `getCalendarSnapshot` ya calculó (`features/reality/`) -- no en hora
 * real de Bogotá. Se investigó una corrección desde este lado
 * (desplazar `now` antes de llamar a `getCalendarSnapshot`) y se
 * descartó: `startOfUtcDay` solo puede devolver instantes a las
 * `00:00:00Z`, y la medianoche real de Bogotá cae a las `05:00:00Z` --
 * ningún desplazamiento de `now` hace que coincidan exactamente, así
 * que un "arreglo" así solo cambiaría CUÁNDO se manifiesta el error,
 * nunca lo eliminaría. Ver `features/home/README.md`
 * ("Límite heredado de Calendar Foundation") para el detalle completo.
 */
export function buildHomeState(
  snapshot: LifeDashboardSnapshot,
  observations: LifeObservation[],
  recommendations: FollowUpRecommendation[],
  presence: PresenceState,
  calendar: CalendarSnapshot | null,
): HomeState {
  return {
    asOf: presence.asOf,
    greeting: presence.greeting,
    lifeContext: buildLifeContext(snapshot, observations, recommendations),
    currentFocus: { primary: presence.primaryFocus, secondary: presence.secondaryFocus },
    attentionNeeded: presence.attentionNeeded,
    recentProgress: { encouragement: presence.encouragement, items: presence.recentProgress },
    urgency: presence.urgency,
    quickActions: buildQuickActions(presence.attentionNeeded),
    upcoming: snapshot.upcoming,
    calendar: buildCalendarContext(calendar),
  };
}
