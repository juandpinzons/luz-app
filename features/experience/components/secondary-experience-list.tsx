import type { ExperienceCard } from "../domain/experience-state";
import { EXPERIENCE_CATEGORY_LABELS } from "../labels";

interface SecondaryExperienceListProps {
  cards: ExperienceCard[];
}

/** Apoya a `PrimaryExperienceCard`, nunca compite con ella -- mismo tratamiento visual (tamaño, color muted) para cualquier categoría que caiga aquí. */
export function SecondaryExperienceList({ cards }: SecondaryExperienceListProps) {
  if (cards.length === 0) return null;

  return (
    <ul className="animate-fade-in mt-4 space-y-2">
      {cards.map((card, index) => (
        <li
          key={card.key}
          className="animate-fade-in rounded-lg border border-zinc-800 px-4 py-3 text-sm"
          style={{ animationDelay: `${index * 40}ms` }}
        >
          <span className="text-zinc-500">{EXPERIENCE_CATEGORY_LABELS[card.category]}: </span>
          <span className="text-zinc-300">{card.title}</span>
        </li>
      ))}
    </ul>
  );
}
