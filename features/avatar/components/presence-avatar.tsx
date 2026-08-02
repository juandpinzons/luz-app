"use client";

import { useState } from "react";
import type { AvatarMoodSignal } from "../domain/avatar-mood-signal";
import { usePresenceAvatarState } from "../hooks/use-presence-avatar-state";
import { Avatar, type AvatarProps } from "./avatar";

export interface PresenceAvatarProps extends Pick<AvatarProps, "size" | "className"> {
  /** Ya calculado en el servidor (Presence+Experience+Narrative+Identity) -- caro, una vez por carga de página. Nunca recalculado aquí (ver README, "separar 'recalcular mood' de 'resolver interacción'"). */
  readonly mood: AvatarMoodSignal;
  readonly isAiResponding?: boolean;
  readonly isUserTyping?: boolean;
  /** Actividad real más reciente en esta pantalla -- si se omite, se asume el momento en que el componente se montó (páginas sin interacción propia en vivo, ej. Dashboard). */
  readonly lastActivityAt?: Date;
}

/**
 * Punto de integración real para Home/Dashboard/Chat (ver
 * `features/avatar/README.md`, "Dónde integrar"). Puente entre el
 * `mood` ya calculado en el servidor y la interacción en vivo de esta
 * sesión (`usePresenceAvatarState`) -- páginas sin interacción propia
 * (Dashboard) pueden omitir los tres últimos props y el personaje sigue
 * completamente vivo (respiración, parpadeo, gesto de entrada, sueño
 * real de madrugada); páginas con interacción real (Chat) los pasan.
 */
export function PresenceAvatar({
  mood,
  isAiResponding = false,
  isUserTyping = false,
  lastActivityAt,
  size,
  className,
}: PresenceAvatarProps) {
  const [mountedAt] = useState(() => new Date());
  const state = usePresenceAvatarState({
    mood,
    isAiResponding,
    isUserTyping,
    lastActivityAt: lastActivityAt ?? mountedAt,
  });

  return <Avatar state={state} size={size} className={className} />;
}
