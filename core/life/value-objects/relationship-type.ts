/**
 * Naturaleza del vínculo entre el usuario y una `Person` del Life Graph.
 */
export const RELATIONSHIP_TYPES = [
  "family",
  "partner",
  "friend",
  "colleague",
  "mentor",
  "mentee",
  "acquaintance",
  "other",
] as const;

export type RelationshipType = (typeof RELATIONSHIP_TYPES)[number];
