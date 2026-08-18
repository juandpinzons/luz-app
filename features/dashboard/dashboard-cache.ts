const KEY = "luz:dashboard-cache:v1";

/**
 * Deliberadamente mínimo -- solo lo que ya se renderiza en la parte
 * superior de `/dashboard` (ver `pageContent` en `app/dashboard/page.tsx`),
 * nunca el `DashboardSummary`/`LifeDashboardSnapshot` completos: esto es
 * la "última versión conocida" para un banner de reconexión, no una
 * copia offline del Dashboard entero.
 */
export interface CachedDashboardSnapshot {
  greeting: string;
  dateLine: string | null;
  continuityLine: string | null;
  cachedAt: string;
}

export function readCachedDashboardSnapshot(): CachedDashboardSnapshot | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CachedDashboardSnapshot) : null;
  } catch {
    return null;
  }
}

export function writeCachedDashboardSnapshot(
  snapshot: Omit<CachedDashboardSnapshot, "cachedAt">,
): void {
  if (typeof window === "undefined") return;

  try {
    const value: CachedDashboardSnapshot = {
      ...snapshot,
      cachedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // Cuota agotada, Safari privado, etc. -- el caché offline es una mejora, nunca un requisito.
  }
}
