"use client";

import { useEffect, useRef, useState } from "react";
import type { AvatarEmotion } from "../domain/avatar-emotion";
import type { AvatarMoodSignal } from "../domain/avatar-mood-signal";
import type { PresenceAvatarState } from "../domain/presence-avatar-state";
import { resolveAvatarState } from "../services/resolve-avatar-state";

/** Cada cuánto se vuelve a resolver solo por el paso del reloj -- nunca para reaccionar a typing/streaming (eso es instantáneo, ver el efecto de abajo), solo para que `sleep` (inactividad real) y el asentamiento de un gesto ya disparado avancen sin depender de que la persona haga algo más. */
const CLOCK_TICK_MS = 5000;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface UsePresenceAvatarStateInput {
  /**
   * Agregado de días/meses (Presence+Experience+Narrative+Identity),
   * cacheado por quien llama -- recalcularlo es responsabilidad de
   * quien monta el hook, nunca de este hook (ver README, "un hook
   * cliente... separar 'recalcular mood' (caro, una vez por carga de
   * página) de 'resolver interacción' (barato, en cada cambio)").
   * Debe ser una referencia estable entre renders (calculada una sola
   * vez, o memoizada) -- una identidad nueva en cada render dispara un
   * recálculo innecesario.
   */
  readonly mood: AvatarMoodSignal;
  readonly isAiResponding: boolean;
  readonly isUserTyping: boolean;
  /** Marca de tiempo de la última actividad real (mensaje enviado, tecla presionada, navegación) -- quien llama decide qué cuenta como actividad en su propia pantalla. */
  readonly lastActivityAt: Date;
}

/**
 * Combina el `mood` ya calculado con la interacción en vivo de esta
 * sesión (`resolveAvatarState`, mismo criterio de conveniencia que
 * `buildPresenceAvatarState`, pero sin repetir el paso caro de
 * `deriveMood`). Responsabilidad obligatoria de I7 (ver README):
 * guardar `emotion` entre renders y devolverlo como `previousEmotion`
 * en la siguiente resolución -- sin esto, un gesto (`jump`/`nod`) se
 * repetiría en cada recálculo. Este hook la cumple con un `ref` interno
 * (nunca un segundo estado que pueda desincronizarse), pero nunca lo
 * lee ni lo escribe durante el render (React prohíbe leer/escribir un
 * `ref` fuera de efectos/handlers) -- el `ref` se siembra una sola vez,
 * en un efecto de montaje, a partir del mismo estado inicial que ya
 * resolvió el inicializador perezoso de `useState`.
 *
 * Nunca deriva `emotion`/`animation` por su cuenta -- solo llama
 * `resolveAvatarState`, ya provisto por `features/avatar`.
 */
export function usePresenceAvatarState({
  mood,
  isAiResponding,
  isUserTyping,
  lastActivityAt,
}: UsePresenceAvatarStateInput): PresenceAvatarState {
  const previousEmotionRef = useRef<AvatarEmotion | undefined>(undefined);
  const isFirstEffectRunRef = useRef(true);
  const [reducedMotion] = useState(prefersReducedMotion);

  const [state, setState] = useState<PresenceAvatarState>(() =>
    resolveAvatarState(mood, {
      isAiResponding,
      isUserTyping,
      msSinceLastActivity: Date.now() - lastActivityAt.getTime(),
      localHour: new Date().getHours(),
      previousEmotion: undefined,
      reducedMotion,
    }),
  );

  // Siembra `previousEmotionRef` con el estado inicial -- solo al
  // montar (deps `[]`), y siempre ANTES de que el efecto de abajo
  // pueda disparar la primera resolución real (ver el guard
  // `isFirstEffectRunRef` ahí): si este efecto corriera después, un
  // `resolve()` real leería el `ref` todavía en `undefined` y podría
  // repetir el gesto de entrada en el siguiente tick del reloj.
  useEffect(() => {
    previousEmotionRef.current = state.emotion;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe correr una vez, al montar; `state` aquí es siempre el inicial.
  }, []);

  useEffect(() => {
    function resolve() {
      const next = resolveAvatarState(mood, {
        isAiResponding,
        isUserTyping,
        msSinceLastActivity: Date.now() - lastActivityAt.getTime(),
        localHour: new Date().getHours(),
        previousEmotion: previousEmotionRef.current,
        reducedMotion,
      });
      previousEmotionRef.current = next.emotion;
      setState(next);
    }

    // El estado inicial ya lo resolvió el inicializador perezoso de
    // `useState` de arriba -- resolver otra vez aquí, en el mismo
    // montaje, pisaría `previousEmotionRef` antes de que ese primer
    // gesto llegara a pintarse ni un solo frame.
    if (isFirstEffectRunRef.current) {
      isFirstEffectRunRef.current = false;
    } else {
      resolve();
    }

    const interval = setInterval(resolve, CLOCK_TICK_MS);
    return () => clearInterval(interval);
  }, [mood, isAiResponding, isUserTyping, lastActivityAt, reducedMotion]);

  return state;
}
