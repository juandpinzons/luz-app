import { PRESENCE_URGENCY_LEVELS, type PresenceUrgencyLevel } from "../../presence/domain/presence-state";
import type { ExperienceCard, ExperienceCardCategory } from "../domain/experience-state";

/**
 * Fase 5: "Presence decide el tono, Experience Intelligence decide la
 * atención". Antes, `presence.urgency` (calculado solo a partir de
 * recomendaciones accionables) era lo único que un cliente podía leer
 * para decidir énfasis visual -- pero `primary` ahora puede ser una
 * reunión en curso o un objetivo estancado, cosas que Presence nunca
 * vio. Recalcular una urgencia independiente ahí sería la "decisión
 * duplicada" que esta fase pide evitar; en cambio, el tono se deriva
 * de la MISMA tarjeta que ya ganó la arbitración.
 */
function importanceToTone(importance: number): PresenceUrgencyLevel {
  if (importance >= 4) return "critical";
  if (importance >= 3) return "high";
  if (importance >= 2) return "medium";
  return "low";
}

/**
 * Techo por categoría -- una reunión en curso merece atención real
 * pero nunca el mismo peso visual que una recomendación "critical"
 * (dos o más señales reales compuestas sobre la misma entidad, ver
 * `computeUrgency` en Presence); las celebraciones nunca deberían
 * leerse como urgentes, sin importar su `importance` interna (que
 * solo existe para que puedan ganar `primary` en un día tranquilo,
 * nunca para pintarlas como alarma).
 */
const TONE_CEILING: Record<ExperienceCardCategory, PresenceUrgencyLevel> = {
  focus: "critical",
  attention: "critical",
  upcoming_deadline: "critical",
  calendar_moment: "high",
  celebration: "low",
};

function cap(tone: PresenceUrgencyLevel, ceiling: PresenceUrgencyLevel): PresenceUrgencyLevel {
  return PRESENCE_URGENCY_LEVELS.indexOf(tone) > PRESENCE_URGENCY_LEVELS.indexOf(ceiling) ? ceiling : tone;
}

/** `null` (nada real que mostrar) es, por diseño, un día tranquilo -- nunca se lee como urgencia. */
export function deriveTone(primary: ExperienceCard | null): PresenceUrgencyLevel {
  if (!primary) return "low";
  return cap(importanceToTone(primary.importance), TONE_CEILING[primary.category]);
}
