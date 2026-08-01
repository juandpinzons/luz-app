import type { ContinuityLoop } from "../../../core/continuity-engine";

/**
 * Misión: "Expose clean contracts for... Morning Brief"
 * (`features/dashboard/services/build-morning-brief.ts`, la única
 * línea generada por IA de todo Home/Dashboard -- ver su propio README,
 * "deliberadamente excluida de la arbitración de Experience"). Este
 * contrato NUNCA genera texto -- entrega los loops más relevantes de
 * HOY como datos crudos; `buildMorningBrief` decide si y cómo
 * mencionarlos en su propia llamada a IA, este módulo no le dicta la
 * prosa.
 */
export interface MorningBriefContinuityItem {
  readonly loopId: string;
  readonly title: string;
  readonly summary: string;
}

/**
 * Loops elegibles para mención en el brief de hoy: `follow_up` (ya
 * toca) o `open`/`waiting` con `nextFollowUpAt` dentro de las próximas
 * 24h (lo de hoy, aunque el seguimiento formal todavía no se disparó)
 * -- ordenados por prioridad, recortados a `limit` (default 3, mismo
 * tope que `ExperienceState.secondary`/`postponed`, ninguna razón para
 * inventar un número distinto).
 */
export function buildMorningBriefItems(
  loops: readonly ContinuityLoop[],
  now: Date = new Date(),
  limit = 3,
): MorningBriefContinuityItem[] {
  const DAY_MS = 24 * 60 * 60 * 1000;
  const priorityRank: Record<ContinuityLoop["priority"], number> = { critical: 0, high: 1, medium: 2, low: 3 };

  const eligible = loops.filter((loop) => {
    if (loop.state === "follow_up") return true;
    if (loop.nextFollowUpAt) {
      return loop.nextFollowUpAt.getTime() - now.getTime() <= DAY_MS;
    }
    return false;
  });

  return eligible
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])
    .slice(0, limit)
    .map((loop) => ({ loopId: loop.id, title: loop.title, summary: loop.trigger.summary }));
}
