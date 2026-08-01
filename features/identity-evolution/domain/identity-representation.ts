/**
 * Cómo mostrar un `IdentityDimension`/`IdentityTheme` a un consumidor
 * (persona o sistema) sin que ese consumidor tenga que interpretar
 * números crudos. Texto siempre determinista -- plantilla + datos
 * reales, nunca generado por IA (Principio 8 del motor: la IA propone
 * en Knowledge/Reasoning, nunca decide la representación de identidad;
 * mismo criterio que `NarrativeReason`/`EvolutionEvent.description` en
 * el resto del repo). Esto es lo que hace de `IdentityEvolution` una
 * capa de REPRESENTACIÓN, no una segunda fuente de interpretación.
 */
export interface IdentityRepresentation {
  /** Nombre corto para mostrar -- para dimensiones, `LIFE_DOMAIN_LABEL`; para temas, `Concept.label` tal cual. */
  readonly label: string;
  /** Una oración, siempre trazable a `momentum`/`weight`/`peakWeight`/evidencia real -- nunca una afirmación sobre cómo se siente la persona. */
  readonly summary: string;
}
