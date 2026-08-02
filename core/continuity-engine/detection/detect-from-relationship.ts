import type { Relationship } from "../../life";
import type { DetectedLoopCandidate } from "./detected-loop-candidate";

/**
 * Regla de apertura determinista para `Relationship` -- misión ejemplo
 * "relationship milestone". Dispara únicamente cuando HOY coincide con
 * el mes+día de `Relationship.since` -- un aniversario real y
 * verificable, nunca un umbral inventado de "cercanía baja hace
 * tiempo" (`closeness` no tiene componente temporal, no serviría para
 * esto sin inventar una regla no pedida).
 *
 * Exige al menos un año completo desde `since` (`yearsSince >= 1`) --
 * el día exacto en que un vínculo se registra no es todavía su propio
 * aniversario.
 *
 * `personName` es opcional y se recibe ya resuelto (mismo criterio que
 * `listAllRelationships`, `features/life/services/`: esta regla nunca
 * consulta `Person` por su cuenta, mantiene su firma pura).
 */
export function detectRelationshipMilestone(
  relationship: Relationship,
  personName: string | undefined,
  now: Date = new Date(),
): DetectedLoopCandidate | null {
  if (!relationship.since) return null;

  const since = relationship.since;
  const isSameCalendarDay = since.getUTCMonth() === now.getUTCMonth() && since.getUTCDate() === now.getUTCDate();
  if (!isSameCalendarDay) return null;

  const yearsSince = now.getUTCFullYear() - since.getUTCFullYear();
  if (yearsSince < 1) return null;

  const title = personName ? `Aniversario con ${personName}` : "Aniversario de una relación";

  return {
    trigger: {
      origin: "relationship",
      reason: "relationship_milestone",
      sourceId: relationship.id,
      detectedAt: now,
      summary: `${yearsSince} año(s) desde ${since.toISOString().slice(0, 10)}`,
    },
    title,
    priority: "medium",
    relatedEntities: [{ kind: "relationship", id: relationship.id, title }],
  };
}
