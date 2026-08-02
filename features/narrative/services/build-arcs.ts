import type { NarrativeArc, NarrativeArcState } from "../domain/narrative-arc";
import type { NarrativeProgression } from "../domain/narrative-progression";
import type { NarrativeThread } from "../domain/narrative-thread";
import { computeEcho } from "./compute-echo";
import { applyArcResonance, derivePriorityFromScore } from "./narrative-score";

const NON_TERMINAL_STAGES = new Set<NarrativeProgression>(["beginning", "developing", "waiting", "turning_point"]);

function groupByArcKey(threads: readonly NarrativeThread[]): Map<string, NarrativeThread[]> {
  const groups = new Map<string, NarrativeThread[]>();
  for (const thread of threads) {
    const group = groups.get(thread.arcKey) ?? [];
    group.push(thread);
    groups.set(thread.arcKey, group);
  }
  return groups;
}

/**
 * Estado del arco -- ver `NarrativeArcState` (`domain/narrative-arc.ts`)
 * para la tabla completa de reglas. Capítulo actual no terminal +
 * cualquier capítulo ANTERIOR del mismo arco con `endedAsSetback` ->
 * `recovering` (Principio 7); no terminal sin eso -> `active`; terminal
 * `archived` -> `dormant`; terminal `resolution`/`reflection` ->
 * `concluded`.
 */
function deriveArcState(orderedChapters: readonly NarrativeThread[], current: NarrativeThread): NarrativeArcState {
  if (NON_TERMINAL_STAGES.has(current.chapter.stage)) {
    const priorSetback = orderedChapters.slice(0, -1).some((chapter) => chapter.endedAsSetback);
    return priorSetback ? "recovering" : "active";
  }

  return current.chapter.stage === "archived" ? "dormant" : "concluded";
}

/**
 * Agrupa `NarrativeThread[]` (capítulos, TODOS los estados -- pasados y
 * presentes, de la ventana de loops que el llamador haya pasado) por
 * `arcKey` -- ver el docblock de `NarrativeArc`
 * (`domain/narrative-arc.ts`) para el criterio de agrupación. Cada grupo
 * se ordena cronológicamente (`chapter.since` ascendente); el más
 * reciente es `current`. Determinístico de punta a punta: mismos
 * threads siempre producen los mismos arcos, mismo orden de capítulos.
 */
export function buildArcs(threads: readonly NarrativeThread[], now: Date): NarrativeArc[] {
  const groups = groupByArcKey(threads);
  const arcs: NarrativeArc[] = [];

  for (const [key, chapters] of groups) {
    const ordered = [...chapters].sort((a, b) => a.chapter.since.getTime() - b.chapter.since.getTime());
    const current = ordered[ordered.length - 1];
    const pastChapters = ordered.slice(0, -1);

    const state = deriveArcState(ordered, current);
    const isReturningAfterSetback = state === "recovering";
    const echo = computeEcho(pastChapters, now);
    const score = applyArcResonance(current.score, isReturningAfterSetback, echo !== null);

    arcs.push({
      key,
      anchorEntity: current.relatedEntities[0] ?? null,
      state,
      chapters: ordered,
      current,
      isReturningAfterSetback,
      echo,
      score,
      priority: derivePriorityFromScore(score),
    });
  }

  return arcs;
}
