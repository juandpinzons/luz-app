import { useSyncExternalStore } from "react";
import {
  readCachedDashboardSnapshot,
  type CachedDashboardSnapshot,
} from "@/features/dashboard/dashboard-cache";

/**
 * `app/dashboard/error.tsx` necesita leer localStorage EN EL RENDER
 * (no dentro de un efecto) para evitar el "cascading render" que
 * dispararía un `setState` síncrono ahí (regla `react-hooks/set-state-in-effect`
 * de este proyecto -- mismo motivo que `use-is-native.ts`). El valor
 * solo se lee una vez por sesión de este componente: la copia cacheada
 * no cambia mientras el boundary de error sigue montado.
 */
let cached: CachedDashboardSnapshot | null | undefined;

function subscribe(): () => void {
  return () => {};
}

function getSnapshot(): CachedDashboardSnapshot | null {
  if (cached === undefined) {
    cached = readCachedDashboardSnapshot();
  }
  return cached;
}

function getServerSnapshot(): CachedDashboardSnapshot | null {
  return null;
}

export function useCachedDashboardSnapshot(): CachedDashboardSnapshot | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
