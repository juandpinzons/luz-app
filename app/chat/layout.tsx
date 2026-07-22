import { auth, signOut } from "@/auth";

/**
 * Envuelve /chat (nunca reescribe page.tsx) con la única pieza que le
 * faltaba a la autenticación: identidad visible + cierre de sesión.
 *
 * Llama `auth()` directamente, no `getUserContext()` — mismo criterio
 * que `proxy.ts` ya usa: esto es capa de presentación (mostrar
 * `session.user.email`), no dominio, y `getUserContext()` deliberadamente
 * no expone email/name (ver auth/user-context.ts). `proxy.ts` ya
 * garantiza que esta ruta es inalcanzable sin sesión — el chequeo de
 * `null` aquí es defensivo, no la barrera real.
 */
export default async function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="flex h-dvh flex-col">
      {session?.user && (
        <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-800 bg-black px-6 py-3 text-sm text-zinc-400">
          <span>{session.user.email ?? session.user.name ?? "Sesión activa"}</span>

          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button
              type="submit"
              className="rounded-full border border-zinc-700 px-4 py-1.5 text-zinc-300 transition hover:border-white hover:text-white"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      )}

      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
