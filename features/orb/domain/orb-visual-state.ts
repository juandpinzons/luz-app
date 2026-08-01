import type { OrbMaturityStage } from "./orb-state";

/**
 * Todo lo que el renderer necesita para pintar el orbe -- ya final,
 * ya recortado a los rangos correctos, listo para interpolar
 * directamente en CSS. El renderer (`components/orb-sphere.tsx`)
 * nunca vuelve a calcular nada de esto, solo lo aplica (Objetivo E:
 * "el renderer debe recibir un OrbVisualState completo"). Producido
 * exclusivamente por `derive-orb-animation.ts` -- ningún otro lugar
 * debe construir uno de estos a mano.
 */
export interface OrbVisualState {
  /** Tamaño real -- una relación más asentada literalmente ocupa más espacio (el renderer solo traduce esto a clases de Tailwind, nunca decide el valor). */
  maturityStage: OrbMaturityStage;
  /** "227, 177, 104" -- listo para interpolar dentro de `rgb(...)`/`rgba(..., alpha)`. */
  rgb: string;
  /** Duración de un ciclo de respiración, en ms. */
  rhythmMs: number;
  /** Alfa del núcleo del gradiente (0-1), ya recortado. */
  coreGlowAlpha: number;
  /** Alfa de la segunda capa de luz (`maturityStage === "radiant"` únicamente) -- `0` en cualquier otro caso, nunca `undefined` (el renderer no debe decidir si aplica). */
  outerGlowAlpha: number;
  /** Punto (%) donde el color de marca reemplaza al blanco central del gradiente -- "foco" del orbe: más alto = el color ocupa menos espacio, se siente más puntual/presente. */
  coreStopPercent: number;
  /** Radio de difusión del resplandor (blur, px) -- "suavidad" de la luz. */
  glowBlurPx: number;
  /** Extensión del resplandor (spread, px) -- "alcance" de la luz. */
  glowSpreadPx: number;
  /** Alfa de un borde cálido adicional en el aro exterior -- `0` salvo cuando hubo un reencuentro real reciente (`reconnectedRecently`). */
  edgeWarmthAlpha: number;
}
