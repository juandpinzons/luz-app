/**
 * Qué tan bien respaldada está una lectura de identidad -- eje DISTINTO
 * del `weight` de un `IdentityDimension`/`IdentityTheme`. `weight`
 * responde "cuánto domina esto la identidad actual"; `confidence`
 * responde "qué tan seguro puede estar LUZ de esa lectura" (Principio 3
 * del motor: toda afirmación debe poder explicar de qué evidencia sale).
 *
 * Combina dos señales, ambas deterministas:
 * - `evidenceCount` -- cuántas piezas de evidencia real hay.
 * - `timeSpreadWeeks` -- en cuántas semanas DISTINTAS aparecieron, no
 *   solo cuántas hay. Esto es lo que separa una "obsesión temporal" (10
 *   señales la misma semana, `timeSpreadWeeks` bajo) de un "interés
 *   persistente" (las mismas 10 señales repartidas en 10 semanas
 *   distintas) -- mismo conteo de evidencia, lectura opuesta. Ninguna
 *   de las dos etiquetas ("obsesión"/"persistente") se asigna como
 *   categoría cerrada todavía -- el dato crudo (`timeSpreadWeeks`) se
 *   expone para que el consumidor saque esa lectura, nunca se inventa
 *   una clasificación que la evidencia todavía no puede respaldar.
 */
export interface IdentityConfidence {
  /** 0-100, combinación capada de `evidenceCount` y `timeSpreadWeeks`. */
  readonly score: number;
  readonly evidenceCount: number;
  /** Semanas distintas (buckets de 7 días relativos a `now`) con al menos una evidencia real, dentro de la ventana de evaluación. */
  readonly timeSpreadWeeks: number;
  /** Explicación determinista y legible del score -- nunca un número sin justificación (Principio 3). */
  readonly reason: string;
}
