import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { adminTotpCredentials } from "@/core/db/schema/admin-mfa";
import { ADMIN_MFA_COOKIE_NAME, verifyAdminMfaSessionToken } from "@/core/security/admin-mfa-session";

/**
 * Segundo factor real para `/admin/*` (auditoría de privacidad,
 * 2026-08-17) -- llamar al INICIO de cada página admin, después de
 * `isAdmin()`, antes de leer cualquier contenido descifrado. No es
 * middleware a propósito: el runtime Edge de Next.js no garantiza
 * soporte completo de `node:crypto`/drivers de Postgres, y este
 * proyecto ya tuvo un incidente real por asumir de más sobre qué
 * corre dónde (ver ADR-0024) -- este gate corre en el mismo runtime
 * Node que ya prueba `isAdmin()`, sin sorpresas nuevas.
 *
 * Dos redirecciones posibles:
 * - Sin credencial TOTP verificada todavía -> `/admin/mfa/setup`
 *   (enrolar es obligatorio, no opcional, para entrar a cualquier
 *   página admin).
 * - Credencial verificada pero sin sesión de MFA vigente en esta
 *   cookie -> `/admin/mfa/verify`.
 */
export async function requireAdminMfa(adminUserId: string): Promise<void> {
  const [credential] = await db
    .select({ verifiedAt: adminTotpCredentials.verifiedAt })
    .from(adminTotpCredentials)
    .where(eq(adminTotpCredentials.adminUserId, adminUserId))
    .limit(1);

  if (!credential?.verifiedAt) {
    redirect("/admin/mfa/setup");
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_MFA_COOKIE_NAME)?.value;

  if (!verifyAdminMfaSessionToken(token, adminUserId)) {
    redirect("/admin/mfa/verify");
  }
}
