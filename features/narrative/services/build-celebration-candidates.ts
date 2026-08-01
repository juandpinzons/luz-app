import type { NarrativeMoment } from "../domain/narrative-moment";
import type { NarrativeThread } from "../domain/narrative-thread";

function threadToCelebrationMoment(thread: NarrativeThread): NarrativeMoment {
  return {
    key: `celebration:thread:${thread.id}`,
    title: thread.title,
    detail: thread.summary,
    priority: thread.priority,
    reason: "celebration_moment",
    score: thread.score,
    relatedEntities: thread.relatedEntities,
    relatedThreadId: thread.id,
  };
}

/**
 * "Celebration Candidates" -- historias con `reason === "celebration_moment"`
 * (desenlace REAL positivo, `LoopOutcome.kind === "positive"`, ver
 * `build-threads-from-loops.ts`), proyectadas como `NarrativeMoment`
 * -- nunca duplicadas como un segundo `NarrativeThread`: `relatedThreadId`
 * señala de vuelta al thread real, quien lo consuma sabe que es la MISMA
 * historia vista desde otro ángulo, no un hecho independiente. Se suman
 * los `NarrativeMoment` sueltos que ya llegaron marcados como celebración
 * (`build-moments.ts` -- recomendaciones `CELEBRATE_PROGRESS` reales sin
 * loop propio, la única fuente que Continuity deliberadamente nunca
 * convierte en loop). Nunca inventado: ambas fuentes ya decidieron el
 * hecho real, esto solo las junta.
 */
export function buildCelebrationCandidates(
  threads: readonly NarrativeThread[],
  moments: readonly NarrativeMoment[],
): NarrativeMoment[] {
  const fromThreads = threads.filter((thread) => thread.reason === "celebration_moment").map(threadToCelebrationMoment);
  const fromMoments = moments.filter((moment) => moment.reason === "celebration_moment");

  return [...fromThreads, ...fromMoments];
}
