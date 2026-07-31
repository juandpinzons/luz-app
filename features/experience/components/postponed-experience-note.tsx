import type { ExperienceCard } from "../domain/experience-state";

interface PostponedExperienceNoteProps {
  cards: ExperienceCard[];
}

/**
 * Fase 1/3: "qué debería posponerse" -- candidatas reales que
 * habrían ganado `primary` de no ser por el cooldown de rotación
 * (`ExperienceState.postponed`). Nunca se pierden, pero tampoco
 * merecen el mismo peso visual que `secondary` -- una nota discreta,
 * no una tercera lista compitiendo por atención.
 */
export function PostponedExperienceNote({ cards }: PostponedExperienceNoteProps) {
  if (cards.length === 0) return null;

  const titles = cards.map((card) => card.title).join(", ");

  return (
    <p className="animate-fade-in mt-3 text-xs text-zinc-600">
      Sigue pendiente, sin perderse: {titles}.
    </p>
  );
}
