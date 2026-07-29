import type { ConversationCategory } from "../../core/db/schema/conversations";

/** Etiquetas en español para `ConversationCategory` -- solo presentación, nunca una segunda fuente de verdad. Mismas palabras que ya usa `/life` para los mismos dominios (`features/life/labels.ts` no las define -- `/life` usa las suyas propias por sección, no una lista de nombres), para que la identidad de una conversación y la de un Goal/Project del mismo dominio se lean igual. */
export const CONVERSATION_CATEGORY_LABELS: Record<ConversationCategory, string> = {
  health: "Salud",
  career: "Trabajo",
  finances: "Finanzas",
  relationships: "Relaciones",
  personal_growth: "Reflexiones",
  leisure: "Tiempo libre",
  home: "Hogar",
  spirituality: "Sentido y espiritualidad",
  general: "General",
};

/**
 * Orden fijo de despliegue -- nunca alfabético ni por conteo (eso
 * reordenaría la página en cada visita a medida que cambian los
 * conteos, rompiendo la sensación de "un lugar organizado"). Sigue el
 * mismo orden que `LIFE_DOMAIN_TYPES`, con `"general"` al final por
 * ser el cajón de lo que no encaja en ningún área de vida.
 */
export const CONVERSATION_CATEGORY_ORDER: ConversationCategory[] = [
  "career",
  "finances",
  "health",
  "relationships",
  "personal_growth",
  "leisure",
  "home",
  "spirituality",
  "general",
];
