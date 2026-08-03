"use client";

import { useEffect, useRef, useState } from "react";
import { PresenceAvatar, type PresenceAvatarProps } from "./presence-avatar";

/**
 * Debe coincidir con el tamaño real de `size="lg"` (`SIZE_CLASS.lg` en
 * `avatar.tsx`, `h-40 w-40` = 160px a la raíz por defecto) -- el
 * cálculo de límites de abajo necesita conocer el tamaño renderizado,
 * no puede leerlo del DOM sin una consulta de layout extra en cada
 * movimiento.
 */
const AVATAR_SIZE_PX = 160;
const EDGE_MARGIN_PX = 16;
/** Deja espacio para el header de `/chat` (no tapar el link "Historial" al aparecer la primera vez). */
const DEFAULT_TOP_OFFSET_PX = 88;

export type FloatingAvatarProps = Omit<PresenceAvatarProps, "size" | "className">;

function clampPosition(x: number, y: number): { x: number; y: number } {
  const maxX = Math.max(window.innerWidth - AVATAR_SIZE_PX - EDGE_MARGIN_PX, EDGE_MARGIN_PX);
  const maxY = Math.max(window.innerHeight - AVATAR_SIZE_PX - EDGE_MARGIN_PX, EDGE_MARGIN_PX);
  return {
    x: Math.min(Math.max(x, EDGE_MARGIN_PX), maxX),
    y: Math.min(Math.max(y, EDGE_MARGIN_PX), maxY),
  };
}

/**
 * Beta-critical polish (feedback directo de Juan, 2026-08-03): "el
 * avatar en conversación debe ser de mínimo 3cm... que tenga vida y se
 * desplace por la pantalla". Antes, `size="xs"` (40px, la más chica del
 * componente) fijo dentro de la fila del header -- exactamente el
 * mismo pedido que ya se resolvió una vez en Dashboard (`sm` -> `lg`),
 * nunca aplicado aquí. Reemplaza esa versión inline por esta, flotante
 * sobre toda la pantalla de chat: `lg` (160px, ~4.2cm, ya el mismo
 * token aprobado en Dashboard -- ningún tamaño nuevo inventado),
 * arrastrable con Pointer Events (mouse y touch con el mismo código),
 * siempre dentro del viewport (`clampPosition`), y con un drift lento
 * propio (`animate-avatar-float`) que la hace sentir viva incluso
 * quieta, sin competir con la respiración/parpadeo que ya trae
 * `Avatar` internamente (transforms en elementos distintos, se
 * componen sin conflicto).
 *
 * Posición por defecto: arriba a la derecha, sin memoria entre
 * sesiones -- guardar la posición es una mejora real pero deliberada-
 * mente fuera de este cambio (ver auditoría), no algo que deba
 * bloquear la primera versión.
 */
export function FloatingAvatar(props: FloatingAvatarProps) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    // `window` no existe durante SSR -- el estado tiene que arrancar en
    // `null` (mismo output en servidor y en el primer render del
    // cliente, sin mismatch de hidratación) y recién aquí, después de
    // montar, calcularse contra el tamaño real de la ventana.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPosition(
      clampPosition(window.innerWidth - AVATAR_SIZE_PX - EDGE_MARGIN_PX, DEFAULT_TOP_OFFSET_PX),
    );

    function handleResize() {
      setPosition((current) => (current ? clampPosition(current.x, current.y) : current));
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!position) return;
    dragOffset.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX - position.x,
      offsetY: event.clientY - position.y,
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragOffset.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPosition(clampPosition(event.clientX - drag.offsetX, event.clientY - drag.offsetY));
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (dragOffset.current?.pointerId !== event.pointerId) return;
    dragOffset.current = null;
    setIsDragging(false);
  }

  if (!position) {
    return null;
  }

  return (
    <div
      className={`animate-avatar-float fixed z-30 touch-none select-none ${
        isDragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      style={{
        left: position.x,
        top: position.y,
        // El drift ambiental (`animate-avatar-float`) y el arrastre en
        // vivo mueven el mismo elemento por dos caminos distintos --
        // apagar la transición mientras se arrastra evita que el
        // dedo/cursor se sienta "retrasado" contra la posición real.
        transition: isDragging ? "none" : undefined,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <PresenceAvatar {...props} size="lg" />
    </div>
  );
}
