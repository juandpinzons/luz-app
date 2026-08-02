"use client";

import { useMemo, type CSSProperties } from "react";
import type { AvatarAnimation } from "../domain/avatar-animation";
import { AVATAR_EMOTIONS, type AvatarEmotion } from "../domain/avatar-emotion";
import type { AvatarGazeTarget } from "../domain/avatar-gaze";

/**
 * Renderer puro (mismo criterio que `features/orb/components/orb-sphere.tsx`,
 * Objetivo E: "extraer el cómputo visual puro del render"). Recibe los
 * campos ya resueltos de `PresenceAvatarState` + un `blinking` que es
 * responsabilidad exclusiva del cliente (`avatar.tsx`, temporizador
 * propio) -- ninguna decisión de qué tan intensa o hacia dónde mira la
 * cara se toma aquí, todas ya vienen resueltas.
 *
 * Dos capas independientes, tal como recomienda `features/avatar/README.md`
 * ("Guía de integración para I7", punto 4): `animation` mueve el grupo
 * interior completo (cuerpo); `emotion` decide únicamente el contenido
 * de la cara (ojos/boca) dentro de ese mismo grupo -- nunca se mezclan
 * en un solo eje. La respiración (`breathe`) vive en el `<svg>` exterior,
 * siempre activa salvo dormido (que ya trae su propio ritmo más lento),
 * independiente de las otras dos -- nunca un tercer estado que este
 * componente deba decidir explícitamente.
 */

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

type EyeState = "open" | "awake-closed" | "sleep-closed";

/** `sleep` siempre gana (ojos cerrados por inactividad real); `celebrating` es la única emoción con ojos cerrados de alegría propia. Todo lo demás, abiertos. */
function resolveEyeState(emotion: AvatarEmotion, animation: AvatarAnimation): EyeState {
  if (animation === "sleep") return "sleep-closed";
  if (emotion === "celebrating") return "awake-closed";
  return "open";
}

/**
 * Trazo de boca (nunca relleno, mismo lenguaje minimalista en todo el
 * personaje), en el espacio local del grupo de cara. `attentive`
 * deliberadamente casi idéntica a `calm` -- apenas más recta, nunca
 * hacia abajo (ver README: "attentive" no debe leerse como
 * preocupación/alarma, Principio 1 del motor backend).
 */
const MOUTH_PATH: Record<AvatarEmotion, string> = {
  calm: "M -9 1 Q 0 5 9 1",
  happy: "M -10 0 Q 0 11 10 0",
  curious: "M -7 3 Q -1 0 3 3 Q 6 5 8 2",
  attentive: "M -7 2 Q 0 4.5 7 2",
  celebrating: "M -9 -1 Q 0 10 9 -1",
};

/** Desplazamiento semántico, nunca coordenadas de pantalla (`AvatarGazeTarget` ya es semántico -- ver `domain/avatar-gaze.ts`). `away` también atenúa levemente la cara (mirada baja), nunca el cuerpo entero. */
const GAZE_OFFSET: Record<AvatarGazeTarget, { x: number; y: number }> = {
  user: { x: 0, y: 0 },
  highlight: { x: 3, y: -1 },
  away: { x: -2, y: 3 },
};

export interface LuzCharacterProps {
  readonly emotion: AvatarEmotion;
  readonly animation: AvatarAnimation;
  /** 0-1 -- escala la intensidad del brillo, nunca genera una animación nueva (ver README, "Performance"). */
  readonly intensity: number;
  readonly gaze: AvatarGazeTarget;
  /** Micro-loop de parpadeo -- decidido por `avatar.tsx` (temporizador propio del cliente), nunca por este componente ni por el backend. */
  readonly blinking: boolean;
}

export function LuzCharacter({ emotion, animation, intensity, gaze, blinking }: LuzCharacterProps) {
  const eyeState = resolveEyeState(emotion, animation);
  const gazeOffset = GAZE_OFFSET[gaze];
  const isAsleep = animation === "sleep";

  const glowStyle = useMemo<CSSProperties>(
    () => ({
      background: `radial-gradient(circle at 50% 45%, rgba(227, 177, 104, ${(0.22 + intensity * 0.28).toFixed(3)}) 0%, transparent 70%)`,
    }),
    [intensity],
  );

  return (
    <div className="relative flex items-center justify-center">
      <div aria-hidden="true" className="absolute inset-0 scale-150 rounded-full" style={glowStyle} />
      <svg
        viewBox="0 0 160 200"
        className={`relative h-full w-full ${isAsleep ? "" : "animate-avatar-breathe"}`}
        role="img"
        aria-label="LUZ"
      >
        <defs>
          <radialGradient id="luz-body-gradient" cx="35%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fff4e2" />
            <stop offset="55%" stopColor="var(--color-luz)" />
            <stop offset="100%" stopColor="#c98f45" />
          </radialGradient>
        </defs>

        <g
          className={BODY_ANIMATION_CLASS[animation]}
          style={{ transformOrigin: "80px 108px", transformBox: "fill-box" }}
        >
          {/* Cuerpo -- silueta de llama suave y redondeada a propósito, nunca puntiaguda ("nunca cartoonish", mission). */}
          <path
            d="M80 12
               C 118 46, 140 82, 140 122
               C 140 164, 113 190, 80 190
               C 47 190, 20 164, 20 122
               C 20 82, 42 46, 80 12 Z"
            fill="url(#luz-body-gradient)"
          />

          {/*
            Cara -- una sola unidad con el cuerpo; la mirada desplaza
            solo este grupo, nunca el cuerpo entero. Los tres estados de
            ojos y las cinco bocas se pintan siempre los tres/las cinco
            a la vez, cruzando por opacidad (`transition`) en vez de
            montar/desmontar nodos SVG -- un cambio de emoción nunca
            debe leerse como un salto instantáneo ("no sudden jumps",
            mission).
          */}
          <g transform={`translate(${gazeOffset.x}, ${gazeOffset.y + 108})`}>
            <g style={{ transformOrigin: "80px 0px", transformBox: "fill-box" }}>
              <g
                className={blinking && eyeState === "open" ? "animate-avatar-blink" : ""}
                style={{ opacity: eyeState === "open" ? 1 : 0, transition: "opacity 200ms ease-out" }}
              >
                <ellipse cx="64" cy="0" rx="6" ry="8" fill="#5b3a1e" />
                <ellipse cx="96" cy="0" rx="6" ry="8" fill="#5b3a1e" />
              </g>
              <g style={{ opacity: eyeState === "awake-closed" ? 1 : 0, transition: "opacity 200ms ease-out" }}>
                <path d="M 58 2 Q 64 -7 70 2" stroke="#5b3a1e" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <path d="M 90 2 Q 96 -7 102 2" stroke="#5b3a1e" strokeWidth="2.5" strokeLinecap="round" fill="none" />
              </g>
              <g style={{ opacity: eyeState === "sleep-closed" ? 1 : 0, transition: "opacity 200ms ease-out" }}>
                <path d="M 58 0 L 70 0" stroke="#5b3a1e" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M 90 0 L 102 0" stroke="#5b3a1e" strokeWidth="2.5" strokeLinecap="round" />
              </g>
            </g>

            <g transform="translate(80, 20)">
              {AVATAR_EMOTIONS.map((candidate) => (
                <path
                  key={candidate}
                  d={MOUTH_PATH[candidate]}
                  stroke="#5b3a1e"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                  style={{ opacity: emotion === candidate ? 1 : 0, transition: "opacity 250ms ease-out" }}
                />
              ))}
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
