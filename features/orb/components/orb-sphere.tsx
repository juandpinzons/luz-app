"use client";

import { useMemo, type CSSProperties } from "react";
import type { OrbVisualState } from "../domain/orb-visual-state";

/**
 * Tamaño real, no solo un multiplicador cosmético -- una relación más
 * asentada literalmente ocupa más espacio. Única decisión de
 * presentación que este renderer toma por su cuenta (traducir un
 * token discreto a clases de Tailwind, nunca un valor calculado) --
 * todo lo demás ya viene resuelto en `OrbVisualState`.
 */
const SIZE_CLASS: Record<OrbVisualState["maturityStage"], string> = {
  spark: "h-20 w-20 sm:h-24 sm:w-24",
  steady: "h-28 w-28 sm:h-32 sm:w-32",
  radiant: "h-32 w-32 sm:h-36 sm:w-36",
};

export interface OrbSphereProps {
  state: OrbVisualState;
  /** `true` durante el pulso de cierre del ritual (`ConversationOpeningRitual`) -- este componente no decide CUÁNDO, solo qué animación de las dos usar mientras tanto. */
  pulsing: boolean;
}

/**
 * Renderer puro (Misión "Orb Experience V1", Objetivo E: "extraer el
 * cómputo visual puro del render"). Recibe un `OrbVisualState` ya
 * completo y solo lo traduce a JSX/CSS -- ninguna decisión de qué tan
 * intensa, cálida o rítmica es esta esfera se toma aquí, todas ya se
 * resolvieron en `derive-orb-animation.ts`. Sin esto, este componente
 * no sabría explicar POR QUÉ un valor es el que es -- y por eso mismo
 * nunca debe intentarlo.
 *
 * Memoizado (Objetivo D): los tres estilos inline solo se recalculan
 * cuando `state`/`pulsing` cambian de verdad, nunca en cada render del
 * padre (`ConversationOpeningRitual` cambia de estado varias veces
 * durante el mismo ritual por sus propios timers). Todas las
 * animaciones siguen siendo CSS (`@keyframes`, `app/globals.css`) --
 * transform/opacity, nunca un loop de JS ni una propiedad costosa
 * recalculada cuadro a cuadro.
 */
export function OrbSphere({ state, pulsing }: OrbSphereProps) {
  const sizeClass = SIZE_CLASS[state.maturityStage];

  const coreStyle = useMemo<CSSProperties>(
    () => ({
      background: `radial-gradient(circle at 35% 30%, #ffffff 0%, rgb(${state.rgb}) ${state.coreStopPercent}%, rgba(${state.rgb}, 0.15) 100%)`,
      boxShadow: `0 0 ${state.glowBlurPx}px ${state.glowSpreadPx}px rgba(${state.rgb}, ${state.coreGlowAlpha})`,
      animationDuration: pulsing ? undefined : `${state.rhythmMs}ms`,
    }),
    [state, pulsing],
  );

  const outerGlowStyle = useMemo<CSSProperties>(
    () => ({
      background: `radial-gradient(circle at 50% 50%, rgba(${state.rgb}, ${state.outerGlowAlpha}) 0%, transparent 70%)`,
      animationDuration: pulsing ? undefined : `${state.rhythmMs}ms`,
    }),
    [state, pulsing],
  );

  /** Aro cálido adicional -- "borde más cálido después de reencontrarse con alguien importante" (Objetivo A). Estático (no animado): una diferencia de color/intensidad no es "movimiento", así que no necesita respetar `prefers-reduced-motion` por separado. */
  const edgeWarmthStyle = useMemo<CSSProperties>(
    () => ({ boxShadow: `0 0 20px 3px rgba(${state.rgb}, ${state.edgeWarmthAlpha})` }),
    [state.rgb, state.edgeWarmthAlpha],
  );

  return (
    <div className="relative flex items-center justify-center">
      {state.outerGlowAlpha > 0 && (
        <div
          className={`absolute rounded-full ${sizeClass} scale-125 ${pulsing ? "" : "animate-sphere-breathe"}`}
          style={outerGlowStyle}
        />
      )}
      {state.edgeWarmthAlpha > 0 && (
        <div className={`absolute rounded-full ${sizeClass} scale-110`} style={edgeWarmthStyle} />
      )}
      <div
        className={`flex-shrink-0 rounded-full ${sizeClass} ${pulsing ? "animate-light-pulse" : "animate-sphere-breathe"}`}
        style={coreStyle}
      />
    </div>
  );
}
