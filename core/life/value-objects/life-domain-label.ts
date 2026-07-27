import type { LifeDomainType } from "./life-domain-type";

/**
 * Nombre humano de cada `LifeDomainType` ("wheel of life") -- solo para
 * texto generado (prompts, descripciones de Insight/Belief/patrón),
 * nunca para mostrar en UI (ahí el label lo decide el componente, no
 * el dominio). Un solo lugar compartido -- antes vivía duplicado
 * dentro de `CuriosityStrategyRule`; `core/predictive-engine` es el
 * segundo consumidor real, momento en que duplicarlo dejó de tener
 * sentido.
 */
export const LIFE_DOMAIN_LABEL: Record<LifeDomainType, string> = {
  health: "su salud",
  career: "su trabajo",
  finances: "sus finanzas",
  relationships: "sus relaciones",
  personal_growth: "su crecimiento personal",
  leisure: "su tiempo libre y lo que disfruta",
  home: "su vida en el hogar",
  spirituality: "su vida espiritual o de sentido",
};
