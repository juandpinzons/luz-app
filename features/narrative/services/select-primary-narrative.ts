import type { NarrativeArc } from "../domain/narrative-arc";
import type { NarrativeProgression } from "../domain/narrative-progression";
import type { NarrativeReason } from "../domain/narrative-reason";
import type { NarrativeSilenceDecision } from "../domain/narrative-silence";

const NON_TERMINAL_STAGES = new Set<NarrativeProgression>(["beginning", "developing", "waiting", "turning_point"]);

/**
 * Cuántas entradas recientes de `recentlyNarratedThreadIds` cuentan como
 * "ya lo dijimos hace poco" -- no exige que hayan sido consecutivas
 * (a diferencia de `consecutiveStreak` en `features/experience/`, que sí
 * exige racha): para Narrative lo que importa es "¿ya se dijo esto
 * recientemente?", no "¿cuántos días seguidos?" -- una historia
 * mencionada hace 3 visitas y otra vez ahora igual se sentiría repetida.
 */
const SILENCE_COOLDOWN_LOOKBACK = 3;

/**
 * Razones "de rutina" -- sin urgencia ni novedad real, elegibles para
 * silencio por repetición (Principio 9: "importance earns repetition;
 * routine does not"). Cualquier otra razón (un aniversario hoy, una
 * fecha real que se acerca, una celebración, un seguimiento que ya se
 * cumplió) SIEMPRE se dice, sin importar cuántas veces ya se dijo.
 */
const SILENCEABLE_REASONS = new Set<NarrativeReason>([
  "continuing_open_story",
  "waiting_quietly",
  "long_running_unresolved",
  "worth_reflecting_on",
  "recently_resolved",
  "fading_without_evidence",
]);

/**
 * `true` cuando este arco CALIFICA para silencio si además ya se narró
 * recientemente -- Principio 3 ("silence is an intentional narrative
 * action") + Principio 9. `recovering`/`echo` SIEMPRE se exceptúan: un
 * "sigues intentándolo" o un aniversario real merecen decirse aunque el
 * asunto de fondo ya se haya mencionado antes -- son, en sí mismos,
 * novedad real, no repetición.
 */
function isSilenceable(arc: NarrativeArc): boolean {
  return (
    (arc.priority === "low" || arc.priority === "medium") &&
    SILENCEABLE_REASONS.has(arc.current.reason) &&
    !arc.isReturningAfterSetback &&
    arc.echo === null
  );
}

function wasRecentlyNarrated(threadId: string, recentlyNarratedThreadIds: readonly string[]): boolean {
  return recentlyNarratedThreadIds.slice(0, SILENCE_COOLDOWN_LOOKBACK).includes(threadId);
}

export interface PrimaryNarrativeSelection {
  readonly primary: NarrativeArc | null;
  readonly silenced: NarrativeSilenceDecision | null;
}

/**
 * "Current Active Story" -- ahora sobre `NarrativeArc[]`, no sobre
 * capítulos aislados (ver `README.md`, "Por qué esto ya no es
 * `NarrativeThread[]`"). Mismo criterio de elegibilidad y desempate que
 * V1 (capítulo actual ≠ `archived`; mayor score gana; empate a favor de
 * no-terminal, luego capítulo más reciente, luego `key` para
 * determinismo total), MÁS el filtro de silencio (Principio 3): recorre
 * la lista ordenada y silencia cada candidata elegible-para-silencio que
 * ya se haya narrado recientemente, sin urgencia real -- solo la
 * PRIMERA que se silencia queda registrada en `silenced` (la más
 * relevante que de verdad casi se dijo), la búsqueda del primario
 * continúa con la siguiente candidata real. `high`/`critical` nunca se
 * silencian.
 */
export function selectPrimaryNarrative(
  arcs: readonly NarrativeArc[],
  recentlyNarratedThreadIds: readonly string[] = [],
): PrimaryNarrativeSelection {
  const eligible = arcs.filter((arc) => arc.current.chapter.stage !== "archived");
  if (eligible.length === 0) return { primary: null, silenced: null };

  const sorted = [...eligible].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;

    const aNonTerminal = NON_TERMINAL_STAGES.has(a.current.chapter.stage) ? 1 : 0;
    const bNonTerminal = NON_TERMINAL_STAGES.has(b.current.chapter.stage) ? 1 : 0;
    if (bNonTerminal !== aNonTerminal) return bNonTerminal - aNonTerminal;

    const chapterDiff = b.current.chapter.since.getTime() - a.current.chapter.since.getTime();
    if (chapterDiff !== 0) return chapterDiff;

    return a.key.localeCompare(b.key);
  });

  let silenced: NarrativeSilenceDecision | null = null;

  for (const arc of sorted) {
    const shouldSilence = isSilenceable(arc) && wasRecentlyNarrated(arc.current.id, recentlyNarratedThreadIds);

    if (!shouldSilence) {
      return { primary: arc, silenced };
    }

    if (!silenced) {
      silenced = { arc, reason: "already_narrated_recently" };
    }
  }

  return { primary: null, silenced };
}
