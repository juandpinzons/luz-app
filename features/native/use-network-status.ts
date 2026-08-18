import { Network } from "@capacitor/network";
import { useSyncExternalStore } from "react";

/**
 * A diferencia de `useIsNative()` (un valor que nunca cambia durante la
 * vida de la app), la conectividad SÍ cambia mientras el componente
 * sigue montado -- por eso el estado real vive en un módulo compartido
 * (no en el hook), actualizado por un único listener de
 * `Network.addListener`, y cada suscriptor de `useSyncExternalStore`
 * solo lee ese valor ya resuelto. El plugin de Capacitor funciona
 * igual en web (usa `navigator.onLine` por debajo), así que este hook
 * no necesita ningún gate de `isNative`.
 */
let isOnline = true;
let initialized = false;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

function ensureInitialized(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;

  Network.getStatus()
    .then((status) => {
      isOnline = status.connected;
      notify();
    })
    .catch(() => {
      // Sin plugin disponible -- se asume conectado, nunca bloquear la UI por esto.
    });

  Network.addListener("networkStatusChange", (status) => {
    isOnline = status.connected;
    notify();
  });
}

function subscribe(onStoreChange: () => void): () => void {
  ensureInitialized();
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function getSnapshot(): boolean {
  return isOnline;
}

function getServerSnapshot(): boolean {
  return true;
}

export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
