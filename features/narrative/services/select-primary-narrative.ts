import type { NarrativeProgression } from "../domain/narrative-progression";
import type { NarrativeThread } from "../domain/narrative-thread";

const NON_TERMINAL_STAGES = new Set<NarrativeProgression>(["beginning", "developing", "waiting", "turning_point"]);

/**
 * "Current Active Story" -- la única historia que debería liderar ahora
 * mismo, o `null` cuando no hay ninguna elegible (cuenta vacía, cero
 * `ContinuityLoop` reales -- nunca se fabrica una para llenar el
 * espacio, mismo principio que `ExperienceState.primary`).
 *
 * Solo capítulo `archived` queda excluido -- historia ya asentada, no
 * narrativamente activa. `resolution`/`reflection` SÍ pueden ganar:
 * reconocer algo que se acaba de cerrar es tan "no empezar de cero" como
 * continuar algo abierto (misión: "The user should never feel they are
 * starting over").
 *
 * Determinístico de punta a punta: mayor `score` gana. Empate se rompe,
 * en orden: (1) a favor de una historia NO terminal (una que sigue viva
 * pesa más que una que ya cerró, en igualdad de score); (2) por capítulo
 * más reciente (`chapter.since` más nuevo); (3) por `id`, para que el
 * resultado nunca dependa del orden de inserción del arreglo de entrada.
 */
export function selectPrimaryNarrative(threads: readonly NarrativeThread[]): NarrativeThread | null {
  const eligible = threads.filter((thread) => thread.chapter.stage !== "archived");
  if (eligible.length === 0) return null;

  const sorted = [...eligible].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;

    const aNonTerminal = NON_TERMINAL_STAGES.has(a.chapter.stage) ? 1 : 0;
    const bNonTerminal = NON_TERMINAL_STAGES.has(b.chapter.stage) ? 1 : 0;
    if (bNonTerminal !== aNonTerminal) return bNonTerminal - aNonTerminal;

    const chapterDiff = b.chapter.since.getTime() - a.chapter.since.getTime();
    if (chapterDiff !== 0) return chapterDiff;

    return a.id.localeCompare(b.id);
  });

  return sorted[0];
}
