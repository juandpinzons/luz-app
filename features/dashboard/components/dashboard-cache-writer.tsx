"use client";

import { useEffect } from "react";
import { writeCachedDashboardSnapshot } from "@/features/dashboard/dashboard-cache";

/** Sin UI -- deja la "última versión conocida" del saludo en localStorage para que `app/dashboard/error.tsx` tenga algo real que mostrar si una navegación futura falla sin conexión. */
export function DashboardCacheWriter({
  greeting,
  dateLine,
  continuityLine,
}: {
  greeting: string;
  dateLine: string | null;
  continuityLine: string | null;
}) {
  useEffect(() => {
    writeCachedDashboardSnapshot({ greeting, dateLine, continuityLine });
  }, [greeting, dateLine, continuityLine]);

  return null;
}
