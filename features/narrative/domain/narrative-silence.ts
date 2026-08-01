import type { NarrativeArc } from "./narrative-arc";

/**
 * POR QUÉ un arco que técnicamente calificaba para `currentActiveStory`
 * fue silenciado en su lugar -- Principio 3 ("Silence is an intentional
 * narrative action, not an absence of one"). Unión cerrada, cada valor
 * 1:1 a una condición real evaluada en `services/select-primary-narrative.ts`.
 */
export const NARRATIVE_SILENCE_REASONS = [
  /**
   * Prioridad `low`/`medium`, ya narrado recientemente (su capítulo
   * actual está entre las últimas visitas en `recentlyNarratedThreadIds`)
   * y sin movimiento fresco desde entonces -- mencionarlo de nuevo se
   * sentiría como insistencia, no como continuidad. `high`/`critical`
   * NUNCA se silencian por este motivo -- la urgencia real gana
   * repetición (Principio 9).
   */
  "already_narrated_recently",
] as const;

export type NarrativeSilenceReason = (typeof NARRATIVE_SILENCE_REASONS)[number];

/**
 * Registro explícito de una decisión de silencio -- nunca un `null`
 * mudo. Permite a un futuro consumidor (o a un panel de depuración)
 * saber que SÍ había algo real, y por qué LUZ decidió no liderar con
 * eso hoy, en vez de asumir que no había nada. `NarrativeState.currentActiveStory`
 * sigue avanzando al siguiente arco real de la lista cuando este existe
 * -- silenciar UN arco nunca implica silenciar la visita completa.
 */
export interface NarrativeSilenceDecision {
  readonly arc: NarrativeArc;
  readonly reason: NarrativeSilenceReason;
}
