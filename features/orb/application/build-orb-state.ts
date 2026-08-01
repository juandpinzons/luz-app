import { deriveOrbPalette } from "../domain/orb-palette";
import { NEUTRAL_ORB_STATE, type OrbState } from "../domain/orb-state";
import type { OrbVisualState } from "../domain/orb-visual-state";
import { deriveMaturity, type MaturityInputs } from "../services/derive-maturity";
import { deriveOrbAnimation } from "../services/derive-orb-animation";
import { deriveOrbMoment, type OrbMomentInputs } from "../services/derive-orb-moment";

export interface BuildOrbStateInput {
  personId: string;
  now: Date;
  maturity: Omit<MaturityInputs, "now">;
  moment: Omit<OrbMomentInputs, "now">;
}

/**
 * Punto de entrada público del módulo Orb -- compone identidad
 * (`deriveOrbPalette`), profundidad de la relación (`deriveMaturity`)
 * y el momento real (`deriveOrbMoment`) en un único `OrbState`. Cada
 * pieza sigue siendo responsable de una sola pregunta (Objetivo E) --
 * esta función solo las junta, nunca decide nada por su cuenta.
 */
export function buildOrbState(input: BuildOrbStateInput): OrbState {
  return {
    paletteName: deriveOrbPalette(input.personId),
    ...deriveMaturity({ ...input.maturity, now: input.now }),
    moment: deriveOrbMoment({ ...input.moment, now: input.now }),
  };
}

/**
 * Conveniencia para quien solo necesita el resultado final listo para
 * pintar (`generate-welcome.ts`) -- `buildOrbState` + `deriveOrbAnimation`
 * en un solo paso, sin saltarse ninguna de las dos capas.
 */
export function buildOrbVisualState(input: BuildOrbStateInput): OrbVisualState {
  return deriveOrbAnimation(buildOrbState(input));
}

/**
 * Calculado una sola vez, al cargar el módulo -- puro y determinístico,
 * nunca cambia. Única fuente del "look de siempre" para cuando no hay
 * datos reales todavía (`NEUTRAL_ORB_STATE`) -- nunca un segundo juego
 * de números copiados a mano que pueda desincronizarse de
 * `derive-orb-animation.ts` si ese modelo cambia.
 */
export const NEUTRAL_ORB_VISUAL_STATE: OrbVisualState = deriveOrbAnimation(NEUTRAL_ORB_STATE);
