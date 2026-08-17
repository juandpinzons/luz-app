import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isAdmin } from "../../is-admin";
import { MfaVerifyForm } from "./mfa-verify-form";

/** Desafío de sesión normal -- `requireAdminMfa` redirige aquí cuando ya hay MFA enrolado pero no hay sesión de MFA vigente. */
export default async function AdminMfaVerifyPage() {
  const session = await auth();
  if (!session?.user?.id || !session.user.email || !isAdmin(session.user.email)) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-light">Verificación en dos pasos</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Ingresa el código de tu app de autenticación.
        </p>
        <MfaVerifyForm />
      </div>
    </main>
  );
}
