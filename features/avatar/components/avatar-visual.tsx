"use client";

import { useMemo } from "react";
import { NEUTRAL_ORB_VISUAL_STATE } from "../../orb/application/build-orb-state";
import { OrbSphere } from "../../orb/components/orb-sphere";
import type { AvatarAnimation } from "../domain/avatar-animation";
import type { AvatarEmotion } from "../domain/avatar-emotion";
import type { AvatarGazeTarget } from "../domain/avatar-gaze";

/**
 * PLACEHOLDER VISUAL -- deliberadamente temporal (decisión del Founder,
 * 2026-08-02: "no quiero introducir un diseño visual inventado -- el
 * avatar es parte de la identidad de LUZ"). Reutiliza
 * `features/orb/components/orb-sphere.tsx` -- ya real, ya en
 * producción, cero diseño nuevo inventado aquí -- en vez de un
 * personaje propio, hasta que exista un asset definitivo (Rive/SVG/
 * Lottie) de la identidad visual real de LUZ. Cero archivos de
 * `features/orb/` tocados (mismo criterio que ya exige su propio
 * README): solo se importa su componente y su estado neutral.
 *
 * Este archivo es el ÚNICO lugar que decide QUÉ se pinta. Ni
 * `avatar.tsx` (dueño del parpadeo) ni `presence-avatar.tsx`/
 * `use-presence-avatar-state.ts` (mood + interacción) saben CÓMO se ve
 * el personaje, solo QUÉ estado tiene -- mismo criterio que
 * `features/orb/README.md` ya aplica entre `derive-orb-animation.ts` y
 * `orb-sphere.tsx`. El día que exista un asset real, el swap es
 * reemplazar el cuerpo de este componente únicamente.
 *
 * `emotion`/`gaze`/`blinking` no tienen todavía una traducción visual
 * con una esfera abstracta (sin cara, sin mirada, sin párpados) --
 * se siguen recibiendo (el contrato de `AvatarVisualProps` no cambia
 * para I7/el asset real), simplemente sin efecto visible en este
 * placeholder. Nunca se usa `pulsing` de `OrbSphere` para los gestos
 * (`wave`/`jump`/`hug`/`nod`): esa prop es la animación de SALIDA del
 * ritual de apertura (`light-pulse` termina en opacidad 0 -- pensada
 * para un desmontaje, nunca para sostenerse); el gesto se expresa en
 * cambio con el vocabulario de animación propio de Avatar
 * (`animate-avatar-*`, `app/globals.css`) aplicado al contenedor.
 */

const RHYTHM_MS: Record<AvatarAnimation, number> = {
  idle: 3200,
  listen: 2400,
  think: 2000,
  sleep: 6000,
  wave: 3200,
  jump: 3200,
  hug: 3200,
  nod: 3200,
};

const BODY_ANIMATION_CLASS: Record<AvatarAnimation, string> = {
  idle: "",
  listen: "animate-avatar-listen",
  think: "animate-avatar-think",
  sleep: "animate-avatar-sleep",
  wave: "animate-avatar-wave",
  jump: "animate-avatar-jump",
  hug: "animate-avatar-hug",
  nod: "animate-avatar-nod",
};

const SIZE_PX = { xs: 40, sm: 64, md: 112, lg: 160 } as const;
/** Tamaño intrínseco de `OrbSphere` en `maturityStage: "steady"` (h-28 = 7rem = 112px, ignorando el breakpoint `sm:` que no aplica al cálculo de escala) -- referencia para el `transform: scale()` de abajo, la única forma de hacer que un componente con su propio tamaño fijo respete el `size` que pide quien integra `<Avatar>`. */
const ORB_INTRINSIC_PX = 112;

export interface AvatarVisualProps {
  readonly emotion: AvatarEmotion;
  readonly animation: AvatarAnimation;
  /** 0-1. */
  readonly intensity: number;
  readonly gaze: AvatarGazeTarget;
  readonly blinking: boolean;
  readonly size: keyof typeof SIZE_PX;
}

export function AvatarVisual({ animation, intensity, emotion, size }: AvatarVisualProps) {
  const isAsleep = animation === "sleep";

  const orbState = useMemo(
    () => ({
      ...NEUTRAL_ORB_VISUAL_STATE,
      rhythmMs: RHYTHM_MS[animation],
      coreGlowAlpha: isAsleep
        ? 0.35
        : Math.min(1, NEUTRAL_ORB_VISUAL_STATE.coreGlowAlpha + intensity * 0.25),
      outerGlowAlpha:
        emotion === "celebrating"
          ? Math.max(NEUTRAL_ORB_VISUAL_STATE.outerGlowAlpha, 0.35)
          : NEUTRAL_ORB_VISUAL_STATE.outerGlowAlpha,
    }),
    [animation, intensity, emotion, isAsleep],
  );

  const scale = SIZE_PX[size] / ORB_INTRINSIC_PX;

  return (
    <div
      className={`flex items-center justify-center ${BODY_ANIMATION_CLASS[animation]}`}
      style={{ width: SIZE_PX[size], height: SIZE_PX[size] }}
    >
      <div style={{ transform: `scale(${scale})` }}>
        <OrbSphere state={orbState} pulsing={false} />
      </div>
    </div>
  );
}
