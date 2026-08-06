import { env } from "@/core/config/env";

/**
 * Compartido por todas las rutas `/admin/*` -- protegido por email, no
 * por rol (ver docblock de `app/admin/page.tsx`). `ADMIN_EMAILS` vacío
 * cierra el acceso para todos por defecto.
 */
export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = env.ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
