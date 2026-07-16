/**
 * Áreas de vida ("wheel of life") en las que se clasifican goals,
 * projects, habits, routines y life events.
 */
export const LIFE_DOMAIN_TYPES = [
  "health",
  "career",
  "finances",
  "relationships",
  "personal_growth",
  "leisure",
  "home",
  "spirituality",
] as const;

export type LifeDomainType = (typeof LIFE_DOMAIN_TYPES)[number];
