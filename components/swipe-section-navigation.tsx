"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { triggerLightHaptic } from "@/features/native/haptics";
import { SECTIONS } from "@/components/sections";

/** Distancia horizontal mínima (px) para contar como un swipe real, no un tap o roce accidental. */
const MIN_SWIPE_DISTANCE_PX = 60;
/** El desplazamiento horizontal debe ser al menos esta proporción del vertical -- un scroll normal (mayormente vertical) nunca lo cumple. */
const MIN_HORIZONTAL_RATIO = 1.5;
/** Ignora gestos que empiezan pegados al borde de la pantalla -- deja espacio libre para cualquier gesto de sistema futuro (edge-swipe-back), y evita activarse con un roce accidental contra el borde. */
const EDGE_EXCLUSION_PX = 24;

/**
 * Deslizar entre Hoy/Vida/Recuerdos/Conversación "como cambiando de
 * página" (pedido del Founder, 2026-08-21) -- el gesto DISPARA una
 * navegación real a la sección siguiente/anterior en el mismo orden
 * que ya define `SECTIONS` (`app-shell.tsx`), nunca un arrastre
 * continuo con las cuatro montadas a la vez. Esa segunda opción se
 * descartó a propósito: Dashboard/Chat ya son páginas pesadas (IA en
 * vivo, fetch real de datos) -- mantener las cuatro vivas al mismo
 * tiempo sería puro costo de memoria/rendimiento sin necesidad real, y
 * rompería la arquitectura actual de 4 rutas independientes
 * (URL propia, deep-linking, cada una con su propia carga de datos).
 *
 * Sin `preventDefault` durante el gesto, a propósito -- React trata los
 * listeners de touch como pasivos por default en la mayoría de
 * navegadores, así que intentar suprimir el scroll nativo mientras el
 * dedo se mueve no es confiable de un navegador a otro. En vez de eso,
 * se mide el desplazamiento TOTAL recién al soltar (`touchend`) y solo
 * navega si fue claramente horizontal y suficientemente largo -- un
 * scroll vertical normal nunca cumple ese criterio, así que nunca
 * compite con el scroll real de la página.
 */
export function SwipeSectionNavigation({
  activeHref,
  children,
}: {
  activeHref: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    if (!touch || touch.clientX < EDGE_EXCLUSION_PX || touch.clientX > window.innerWidth - EDGE_EXCLUSION_PX) {
      touchStart.current = null;
      return;
    }
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;

    const touch = event.changedTouches[0];
    if (!touch) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    if (Math.abs(dx) < MIN_SWIPE_DISTANCE_PX || Math.abs(dx) < Math.abs(dy) * MIN_HORIZONTAL_RATIO) {
      return;
    }

    const currentIndex = SECTIONS.findIndex((section) => section.href === activeHref);
    if (currentIndex === -1) return;

    // dx < 0 -- el dedo se movió hacia la izquierda -- avanza a la
    // siguiente sección (mismo sentido que hojear hacia adelante).
    const nextIndex = dx < 0 ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0 || nextIndex >= SECTIONS.length) return;

    triggerLightHaptic();
    router.push(SECTIONS[nextIndex].href);
  }

  return (
    <div className="h-full" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {children}
    </div>
  );
}
