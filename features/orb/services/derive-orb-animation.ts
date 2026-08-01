import { ORB_PALETTE_RGB } from "../domain/orb-palette";
import type { OrbState } from "../domain/orb-state";
import type { OrbVisualState } from "../domain/orb-visual-state";

/**
 * El "modelo de animación" (Objetivo E: separado a propósito de
 * `derive-orb-moment.ts` -- ese archivo decide QUÉ es real, este
 * decide CÓMO se ve). Toda constante numérica vive aquí, con nombre y
 * razón -- ninguna aparece dos veces, ninguna sin explicar (Objetivo
 * E: "no duplicated constants, no magic numbers").
 *
 * Cada ajuste por `moment` es pequeño y aditivo, nunca multiplicativo
 * ni reemplaza la base -- "todo sutil, nada llamativo" (Objetivo A).
 * Los topes (`MAX_CORE_GLOW_ALPHA`, etc.) existen precisamente para
 * que ninguna combinación de señales reales, por muchas que coincidan
 * el mismo día, pueda volverse llamativa.
 */

// -- Alfa del núcleo (intensidad del brillo central) --
const BASE_CORE_GLOW_ALPHA = 0.18;
const WARMTH_GLOW_ALPHA_SCALE = 0.22;
/** "Halo un poco más fuerte después de una conversación con contenido real" -- Objetivo A, ejemplo textual. */
const MEANINGFUL_CONVERSATION_GLOW_BOOST = 0.05;
/** "Pulso diminuto al completar algo importante" -- mismo canal que la conversación significativa (ambas son "algo bueno acaba de pasar"), nunca una animación nueva independiente. */
const COMPLETED_SOMETHING_GLOW_BOOST = 0.05;
/** "Luz más suave después de varios días de silencio" -- resta, nunca vuelve el orbe invisible. */
const QUIET_DAYS_GLOW_REDUCTION = 0.04;
/** "Brillo suave de la mañana" -- Objetivo A, ejemplo textual. Un empujón mínimo, apenas perceptible, nunca tan grande como una señal real de la relación. */
const MORNING_GLOW_BOOST = 0.03;
/** Contraparte de la mañana: de noche, un poco menos de brillo -- coherente con "presencia calma", nunca apagado. */
const NIGHT_GLOW_REDUCTION = 0.03;
const MIN_CORE_GLOW_ALPHA = 0.1;
const MAX_CORE_GLOW_ALPHA = 0.55;

// -- Difusión (blur) y alcance (spread) del resplandor --
const BASE_GLOW_BLUR_PX = 60;
const WARMTH_GLOW_BLUR_SCALE = 20;
/** Silencio real -> luz más suave/difusa, nunca más intensa. */
const QUIET_DAYS_BLUR_BOOST_PX = 15;

const GLOW_SPREAD_BASE_PX = 18;
const ANTICIPATION_GLOW_SPREAD_PX = 24;
/** Una reunión por empezar es presencia real, no urgencia -- un empujón pequeño, nunca tan grande como `anticipation`. */
const MEETING_SOON_SPREAD_BOOST_PX = 3;

// -- "Foco" del orbe (dónde termina el blanco central y empieza el color de marca) --
const CORE_STOP_BASE_PERCENT = 55;
const ANTICIPATION_CORE_STOP_PERCENT = 60;
/** Silencio real -> un foco un poco menos definido, coherente con "más suave". */
const QUIET_DAYS_CORE_STOP_REDUCTION_PERCENT = 3;

// -- Ritmo de respiración --
const RHYTHM_BASE_MS = 4200;
const ANTICIPATION_RHYTHM_MS = 3200;
/** Una reunión pronto se siente un poco más presente/alerta -- nunca tan rápido como `anticipation` genérica. */
const MEETING_SOON_RHYTHM_ADJUST_MS = -300;
/** Silencio real -> un respiro un poco más lento y calmo. */
const QUIET_DAYS_RHYTHM_ADJUST_MS = 400;
const MIN_RHYTHM_MS = 2600;

/** "Borde más cálido después de reencontrarse con alguien importante" -- Objetivo A, ejemplo textual. Canal propio, no se mezcla con el brillo central. */
const EDGE_WARMTH_ALPHA_WHEN_RECONNECTED = 0.12;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * `OrbState` (qué es real) -> `OrbVisualState` (qué se pinta).
 * Determinística de punta a punta: mismo `OrbState`, siempre el mismo
 * `OrbVisualState` -- ver Objetivo C ("no randomizar, todo
 * determinístico") y `features/orb/tests/orb-state.examples.ts`
 * ("misma realidad => mismo resultado visual").
 */
export function deriveOrbAnimation(state: OrbState): OrbVisualState {
  const { warmth, anticipation, moment } = state;

  let coreGlowAlpha = BASE_CORE_GLOW_ALPHA + warmth * WARMTH_GLOW_ALPHA_SCALE;
  if (moment.hadMeaningfulConversationRecently) coreGlowAlpha += MEANINGFUL_CONVERSATION_GLOW_BOOST;
  if (moment.completedSomethingRecently) coreGlowAlpha += COMPLETED_SOMETHING_GLOW_BOOST;
  if (moment.hasBeenQuiet) coreGlowAlpha -= QUIET_DAYS_GLOW_REDUCTION;
  if (moment.timeOfDay === "dawn" || moment.timeOfDay === "morning") coreGlowAlpha += MORNING_GLOW_BOOST;
  if (moment.timeOfDay === "night") coreGlowAlpha -= NIGHT_GLOW_REDUCTION;
  coreGlowAlpha = clamp(coreGlowAlpha, MIN_CORE_GLOW_ALPHA, MAX_CORE_GLOW_ALPHA);

  const glowBlurPx =
    BASE_GLOW_BLUR_PX + warmth * WARMTH_GLOW_BLUR_SCALE + (moment.hasBeenQuiet ? QUIET_DAYS_BLUR_BOOST_PX : 0);

  let glowSpreadPx = anticipation ? ANTICIPATION_GLOW_SPREAD_PX : GLOW_SPREAD_BASE_PX;
  if (moment.hasImportantMeetingSoon) glowSpreadPx += MEETING_SOON_SPREAD_BOOST_PX;

  let coreStopPercent = anticipation ? ANTICIPATION_CORE_STOP_PERCENT : CORE_STOP_BASE_PERCENT;
  if (moment.hasBeenQuiet) coreStopPercent -= QUIET_DAYS_CORE_STOP_REDUCTION_PERCENT;

  let rhythmMs = anticipation ? ANTICIPATION_RHYTHM_MS : RHYTHM_BASE_MS;
  if (moment.hasImportantMeetingSoon) rhythmMs += MEETING_SOON_RHYTHM_ADJUST_MS;
  if (moment.hasBeenQuiet) rhythmMs += QUIET_DAYS_RHYTHM_ADJUST_MS;
  rhythmMs = Math.max(MIN_RHYTHM_MS, rhythmMs);

  return {
    maturityStage: state.maturityStage,
    rgb: ORB_PALETTE_RGB[state.paletteName],
    rhythmMs,
    coreGlowAlpha,
    outerGlowAlpha: state.maturityStage === "radiant" ? coreGlowAlpha * 0.5 : 0,
    coreStopPercent,
    glowBlurPx,
    glowSpreadPx,
    edgeWarmthAlpha: moment.reconnectedRecently ? EDGE_WARMTH_ALPHA_WHEN_RECONNECTED : 0,
  };
}
