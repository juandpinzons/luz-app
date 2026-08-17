import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/core/db/client";
import { adminTotpCredentials } from "@/core/db/schema/admin-mfa";
import { isAdmin } from "../../is-admin";
import { MfaSetupForm } from "./mfa-setup-form";

/**
 * Enrolamiento obligatorio de MFA (auditoría de privacidad,
 * 2026-08-17) -- `requireAdminMfa` redirige aquí cuando el admin
 * todavía no tiene una credencial TOTP verificada. Si ya la tiene,
 * no hay nada que hacer aquí -- de vuelta a `/admin`.
 */
export default async function AdminMfaSetupPage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email || !isAdmin(session.user.email)) {
    redirect("/login");
  }

  const [existing] = await db
    .select({ verifiedAt: adminTotpCredentials.verifiedAt })
    .from(adminTotpCredentials)
    .where(eq(adminTotpCredentials.adminUserId, session.user.id))
    .limit(1);

  if (existing?.verifiedAt) {
    redirect("/admin");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-md">
        <h1 className="text-xl font-light">Configura la verificación en dos pasos</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Obligatorio antes de entrar a cualquier página de administración. Usa
          Google Authenticator, Authy, 1Password o cualquier app compatible con TOTP.
        </p>
        <MfaSetupForm />
      </div>
    </main>
  );
}
