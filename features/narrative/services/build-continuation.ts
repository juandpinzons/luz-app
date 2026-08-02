import type { NarrativeArc } from "../domain/narrative-arc";
import type { NarrativeContinuation, NarrativeContinuationKind } from "../domain/narrative-continuation";
import type { NarrativeReason } from "../domain/narrative-reason";

/**
 * Lookup FIJO, 1:1, `NarrativeReason` -> `NarrativeContinuationKind` --
 * nunca una decisión nueva, la decisión real ya la tomó
 * `derive-reason.ts`. Solo se consulta cuando ni `arc.isReturningAfterSetback`
 * ni `arc.echo` aplican (ver `buildContinuation`) -- ambos son señales de
 * ARCO, más específicas que cualquier razón de un capítulo aislado.
 *
 * `recently_resolved` (que cubre CUALQUIER desenlace terminal reciente,
 * positivo, negativo o `unknown` -- ver `build-threads-from-loops.ts`)
 * mapea a `"reflect"`, nunca a `"celebrate"`: solo `celebration_moment`
 * (que exige `LoopOutcome.kind === "positive"` real) puede celebrar;
 * confundir los dos habría felicitado un desenlace negativo o
 * desconocido.
 */
const CONTINUATION_KIND_BY_REASON: Readonly<Record<NarrativeReason, NarrativeContinuationKind>> = {
  milestone_today: "celebrate",
  celebration_moment: "celebrate",
  follow_up_due: "check_in",
  important_meeting_upcoming: "prepare",
  approaching_deadline: "prepare",
  unread_important_email: "check_in",
  awaiting_reply: "check_in",
  fading_without_evidence: "release",
  recently_resolved: "reflect",
  worth_reflecting_on: "reflect",
  long_running_unresolved: "resume",
  waiting_quietly: "resume",
  continuing_open_story: "resume",
};

/**
 * "What deserves continuation" -- la respuesta concreta a esa pregunta
 * del objetivo de la misión, ahora a nivel de ARCO. Dos señales de arco
 * se evalúan ANTES que la razón del capítulo actual, en este orden:
 *
 * 1. `arc.isReturningAfterSetback` -> `"welcome_back"` (Principio 7): un
 *    segundo intento real después de un revés real pesa más que
 *    cualquier razón del capítulo aislado -- nombrar el regreso ES la
 *    continuación correcta, sin importar si el capítulo actual además
 *    tiene una fecha próxima.
 * 2. `arc.echo` -> `"echo"` (Principio 8): un capítulo pasado cae en la
 *    fecha de hoy -- una coincidencia real de calendario, evaluada antes
 *    que la rutina del capítulo actual.
 * 3. Si ninguna aplica, cae al lookup 1:1 de siempre sobre
 *    `arc.current.reason`.
 *
 * `null` únicamente cuando no hay `currentActiveStory`. `title`/`summary`
 * son passthrough exacto del capítulo actual del arco -- ver docblock de
 * `NarrativeContinuation`.
 */
export function buildContinuation(currentActiveStory: NarrativeArc | null): NarrativeContinuation | null {
  if (!currentActiveStory) return null;
  const { current } = currentActiveStory;

  if (currentActiveStory.isReturningAfterSetback) {
    return {
      arcKey: currentActiveStory.key,
      threadId: current.id,
      kind: "welcome_back",
      reason: current.reason,
      title: current.title,
      summary: current.summary,
    };
  }

  if (currentActiveStory.echo) {
    return {
      arcKey: currentActiveStory.key,
      threadId: current.id,
      kind: "echo",
      reason: current.reason,
      title: current.title,
      summary: current.summary,
      echo: currentActiveStory.echo,
    };
  }

  return {
    arcKey: currentActiveStory.key,
    threadId: current.id,
    kind: CONTINUATION_KIND_BY_REASON[current.reason],
    reason: current.reason,
    title: current.title,
    summary: current.summary,
  };
}
