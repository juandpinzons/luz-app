import type { Context, HeuristicScores } from "./types";

const MIN_TOKEN_LENGTH = 4;

/** Misma tokenización exacta que `features/chat/services/select-contextual-memories.ts` -- reimplementada aquí, no importada, mismo criterio ya establecido en ese archivo para no cruzar `evaluation/` (fuera de `features/*`) con lógica de un feature. */
function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((token) => token.length >= MIN_TOKEN_LENGTH),
  );
}

/**
 * Todo el contenido que el snapshot de ESTA variante ya traía --
 * memoria, conceptos, vida activa. Léxico a propósito (cuenta piso, no
 * techo, ver docblock de `HeuristicScores.knownContentTokenMatches`):
 * una respuesta que usa el contexto sin repetir ninguna palabra
 * literal existe y es válida, este número no la ve. Sirve para
 * detectar el caso más burdo (¿la respuesta ni siquiera toca el
 * vocabulario disponible?), no para certificar personalización real
 * -- eso es trabajo del juez de IA (`judge.ts`).
 */
function collectKnownContentTokens(context: Context): Set<string> {
  const tokens = new Set<string>();
  const addAll = (text: string) => {
    for (const token of tokenize(text)) tokens.add(token);
  };

  for (const memory of context.realitySnapshot.memory.items) addAll(memory.content);
  for (const concept of context.realitySnapshot.concepts.items) addAll(concept.label);
  for (const goal of context.realitySnapshot.life.activeGoals) addAll(goal.title);
  for (const project of context.realitySnapshot.life.activeProjects) addAll(project.title);
  for (const habit of context.realitySnapshot.life.activeHabits) addAll(habit.title);

  return tokens;
}

export function scoreHeuristics(response: string, context: Context): HeuristicScores {
  const lines = response.split("\n").filter((line) => line.trim().length > 0);
  const words = response.trim().split(/\s+/).filter(Boolean);

  const knownTokens = collectKnownContentTokens(context);
  const responseTokens = tokenize(response);
  let knownContentTokenMatches = 0;
  for (const token of knownTokens) {
    if (responseTokens.has(token)) knownContentTokenMatches += 1;
  }

  return {
    characterCount: response.length,
    wordCount: words.length,
    lineCount: lines.length,
    withinVoiceLineLimit: lines.length <= context.voice.maxLines,
    knownContentTokenMatches,
  };
}
