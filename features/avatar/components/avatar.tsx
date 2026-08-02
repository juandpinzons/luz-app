"use client";

import { useEffect, useState } from "react";
import type { PresenceAvatarState } from "../domain/presence-avatar-state";
import { LuzCharacter } from "./luz-character";

const SIZE_CLASS = {
  xs: "h-10 w-10",
  sm: "h-16 w-16",
  md: "h-28 w-28",
  lg: "h-40 w-40",
} as const;

const MIN_BLINK_INTERVAL_MS = 3000;
const MAX_BLINK_INTERVAL_MS = 6000;
/** Debe coincidir con `--animate-avatar-blink` (`app/globals.css`). */
const BLINK_DURATION_MS = 260;

function randomBlinkDelay(): number {
  return MIN_BLINK_INTERVAL_MS + Math.random() * (MAX_BLINK_INTERVAL_MS - MIN_BLINK_INTERVAL_MS);
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface AvatarProps {
  readonly state: PresenceAvatarState;
  readonly size?: keyof typeof SIZE_CLASS;
  readonly className?: string;
}

/**
 * Componente público que las páginas montan (Home/Dashboard/Chat, ver
 * `features/avatar/README.md`, "Dónde integrar"). Dueño exclusivo del
 * micro-loop de parpadeo -- un temporizador propio del cliente con
 * intervalo aleatorio (3-6s), nunca algo que `PresenceAvatarState`
 * decida (el backend es puro y nunca corre un temporizador propio, ver
 * `services/resolve-avatar-state.ts`). El temporizador ni siquiera
 * arranca bajo `prefers-reduced-motion` ni durante `sleep` (los ojos ya
 * están cerrados por inactividad real) -- mismo criterio de "ninguna
 * regla de gesto se evalúa siquiera" que ya aplica el backend.
 *
 * Solo depende de si el personaje está dormido, nunca de qué
 * `animation` puntual esté corriendo -- así el parpadeo sigue su propio
 * reloj continuo a través de idle/listen/think/gestos, nunca se
 * reinicia solo porque la persona empezó a escribir.
 */
export function Avatar({ state, size = "md", className = "" }: AvatarProps) {
  const [blinking, setBlinking] = useState(false);
  const isAsleep = state.animation === "sleep";

  useEffect(() => {
    if (isAsleep || prefersReducedMotion()) {
      return;
    }

    let blinkTimeout: ReturnType<typeof setTimeout>;
    let settleTimeout: ReturnType<typeof setTimeout>;

    function scheduleBlink() {
      blinkTimeout = setTimeout(() => {
        setBlinking(true);
        settleTimeout = setTimeout(() => {
          setBlinking(false);
          scheduleBlink();
        }, BLINK_DURATION_MS);
      }, randomBlinkDelay());
    }

    scheduleBlink();

    return () => {
      clearTimeout(blinkTimeout);
      clearTimeout(settleTimeout);
    };
  }, [isAsleep]);

  return (
    <div className={`${SIZE_CLASS[size]} ${className}`} title={state.reason}>
      <LuzCharacter
        emotion={state.emotion}
        animation={state.animation}
        intensity={state.intensity}
        gaze={state.gaze}
        blinking={blinking}
      />
    </div>
  );
}
