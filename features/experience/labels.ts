import type { ExperienceCardCategory } from "./domain/experience-state";

/** Etiquetas en español para cada categoría de `ExperienceCard` -- solo presentación, nunca una segunda fuente de verdad sobre qué es cada tarjeta (mismo criterio que `features/life/labels.ts`). */
export const EXPERIENCE_CATEGORY_LABELS: Record<ExperienceCardCategory, string> = {
  focus: "Foco de hoy",
  attention: "Necesita atención",
  celebration: "Para celebrar",
  calendar_moment: "Calendario",
  upcoming_deadline: "Se acerca",
};
