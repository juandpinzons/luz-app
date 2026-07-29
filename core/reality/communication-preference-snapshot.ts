/**
 * Proyección mínima de un `Belief` con `category: "communication_style"`
 * (`core/belief-engine`) -- mismo criterio que el resto de
 * `core/reality`: kernel compartido, nunca importa el tipo real del
 * engine. Solo `statement`, lo único que `VoiceEngine`/el Prompt
 * Builder necesitan para adaptar cómo LUZ le habla a esta persona --
 * nunca el ciclo de vida completo (eso vive en `beliefs`, para quien
 * lo explore explícitamente en `/life/identity`).
 */
export interface RealityCommunicationPreference {
  statement: string;
  confidence: number;
}

/**
 * Cómo prefiere esta persona que LUZ le hable -- ausencia real
 * representada como ausencia (`items: []`), mismo criterio que el
 * resto de `core/reality`. Acotado a 2 (ver `assembleRealitySnapshot`):
 * suficiente para cubrir un par de facetas estables (ej. brevedad +
 * nivel técnico) sin convertirse en una lista larga de instrucciones.
 */
export interface CommunicationPreferenceSnapshot {
  items: RealityCommunicationPreference[];
}
