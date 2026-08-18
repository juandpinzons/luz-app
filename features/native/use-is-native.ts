import { Capacitor } from "@capacitor/core";
import { useSyncExternalStore } from "react";

/**
 * Único lugar que necesita saber, EN TIEMPO DE RENDER (no solo dentro
 * de un efecto), si esto corre dentro de la app nativa -- p. ej.
 * `GoogleSignInButton`, que renderiza un botón distinto según el caso.
 * `useSyncExternalStore` (no `useState` + `useEffect`) es el patrón
 * correcto de React para un valor externo que el servidor no puede
 * conocer (`getServerSnapshot` siempre `false`) sin el "cascading
 * render" que dispararía un `setState` síncrono dentro de un efecto
 * (regla `react-hooks/set-state-in-effect` de este proyecto).
 * `Capacitor.isNativePlatform()` nunca cambia durante la vida de la
 * app, así que `subscribe` no tiene nada real a lo que suscribirse.
 */
function subscribe(): () => void {
  return () => {};
}

function getSnapshot(): boolean {
  return Capacitor.isNativePlatform();
}

function getServerSnapshot(): boolean {
  return false;
}

export function useIsNative(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
