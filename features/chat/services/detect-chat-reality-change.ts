export interface ChatRealityChange {
  type: "new_memories";
  count: number;
  summary: string;
}

/**
 * "Qué cambió desde la última interacción" (redesign del pipeline
 * conversacional, Beta) -- deliberadamente acotado a lo que el chat
 * puede saber sin construir `HomeState` (mismo patrón de diff positivo
 * que `features/experience/services/detect-what-changed.ts`, nunca
 * una reutilización literal: ese fingerprint depende de campos que
 * `RealitySnapshot` no trae). Goals/Projects completados NO se repiten
 * aquí -- ya tienen su propia voz, más específica, en
 * `AcknowledgeClosureStrategyRule`; mencionarlos otra vez en esta regla
 * sería la misma lógica duplicada dos veces, con dos redacciones
 * distintas.
 */
export function detectChatRealityChange(newMemoriesCount: number): ChatRealityChange[] {
  if (newMemoriesCount <= 0) {
    return [];
  }

  return [
    {
      type: "new_memories",
      count: newMemoriesCount,
      summary:
        newMemoriesCount === 1
          ? "Pasó algo que vale la pena tener presente desde la última vez que hablaron."
          : `Pasaron ${newMemoriesCount} cosas que valen la pena tener presentes desde la última vez que hablaron.`,
    },
  ];
}
