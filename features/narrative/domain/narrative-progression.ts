/**
 * En qué etapa de su historia está un `NarrativeThread` ahora mismo --
 * misión "Living Narrative Foundation": "Model story evolution...
 * Beginning, Developing, Waiting, Turning Point, Resolution, Reflection,
 * Archived." Unión cerrada a propósito, mismo criterio que
 * `LoopState`/`LoopReason` (`core/continuity-engine`): cada valor
 * corresponde a una regla determinista real en
 * `services/build-threads-from-loops.ts` (`deriveChapter`), nunca una
 * etapa inventada sin una condición exacta detrás.
 *
 * Deriva EXCLUSIVAMENTE de `ContinuityLoop.state` + sus timestamps
 * (`createdAt`/`updatedAt`/`resolution.resolvedAt`) -- nunca de
 * contenido, nunca de una interpretación nueva. Continuity ya decidió el
 * ciclo de vida real (`open`/`waiting`/`follow_up`/terminal); Narrative
 * solo lo traduce a vocabulario de historia y le suma la dimensión que
 * Continuity no necesitaba: cuánto hace que este asunto entró a su etapa
 * actual (`NarrativeChapter.since`).
 */
export const NARRATIVE_PROGRESSIONS = [
  /** `loop.state === "open"`, detectado hace menos de `BEGINNING_WINDOW_DAYS`. */
  "beginning",
  /** `loop.state === "open"`, detectado hace `BEGINNING_WINDOW_DAYS` o más -- sigue activo, sin resolverse, sin haber llegado todavía a esperar/resurfacear. */
  "developing",
  /** `loop.state === "waiting"` -- LUZ ya decidió cuándo volver a mirar esto, todavía no es ese momento. */
  "waiting",
  /** `loop.state === "follow_up"` -- el momento programado para resurfacear ya se cumplió (o nunca hizo falta esperar): un punto real de inflexión, no una interpretación. */
  "turning_point",
  /** `loop.state === "resolved"`, cerrado hace menos de `RESOLUTION_FRESH_DAYS` -- el desenlace es noticia fresca. */
  "resolution",
  /** Cualquier estado terminal, cerrado hace menos de `REFLECTION_WINDOW_DAYS` (y ya no lo bastante fresco para `resolution`) -- todavía vale la pena mirar atrás. */
  "reflection",
  /** Cualquier estado terminal, cerrado hace `REFLECTION_WINDOW_DAYS` o más -- historia asentada, ya no narrativamente activa. */
  "archived",
] as const;

export type NarrativeProgression = (typeof NARRATIVE_PROGRESSIONS)[number];

/**
 * Etiqueta lista para mostrarse -- lookup fijo, nunca texto generado.
 * Mismo criterio que `TITLE_BY_TYPE`
 * (`features/dashboard/services/build-follow-up-recommendations.ts`) o
 * `LIFE_DOMAIN_LABEL` (`core/life`).
 */
export const NARRATIVE_PROGRESSION_LABELS: Readonly<Record<NarrativeProgression, string>> = {
  beginning: "Comenzando",
  developing: "En desarrollo",
  waiting: "En espera",
  turning_point: "Punto de inflexión",
  resolution: "Resolución",
  reflection: "Reflexión",
  archived: "Archivada",
};

/**
 * Etapa actual de un `NarrativeThread` más desde cuándo está en ella.
 *
 * `since` -- para las tres etapas terminales (`resolution`/`reflection`/
 * `archived`) es `LoopResolution.resolvedAt` real, un hecho exacto.
 * Para las cuatro no terminales es `ContinuityLoop.updatedAt` como
 * aproximación honesta ("último cambio real del loop") -- Narrative no
 * mantiene su propio historial de transiciones de capítulo (violaría
 * "a narrative never stores data"), así que nunca finge saber el
 * instante exacto en que la etapa cambió, solo el instante conocido más
 * cercano. Mismo tipo de aproximación honesta y documentada que ya usa
 * `core/continuity-engine` para "desenlace de reunión capturado" (ver su
 * README, "Consideraciones y límites reales").
 */
export interface NarrativeChapter {
  readonly stage: NarrativeProgression;
  readonly since: Date;
}
