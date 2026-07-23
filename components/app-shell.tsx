import Link from "next/link";
import { auth, signOut } from "@/auth";

type ActiveSection = "dashboard" | "life" | "chat";

/**
 * Las cuatro secciones (Alpha Experience V1, docs/product/
 * ALPHA_EXPERIENCE_V1_DESIGN.md §4.1/5.1). `href: null` en Memories es
 * deliberado: esa ruta no existe todavía (Sprint 4) y no se construye
 * aquí — se muestra como texto no interactivo en vez de un enlace que
 * hoy llevaría a un 404; se activa cambiando solo esta tabla cuando su
 * ruta exista. Life se activó en el Sprint 3.
 */
const SECTIONS: Array<{
  id: ActiveSection | "memories";
  label: string;
  href: string | null;
}> = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "life", label: "Life", href: "/life" },
  { id: "memories", label: "Memories", href: null },
  { id: "chat", label: "Conversación", href: "/chat" },
];

/**
 * Shell persistente compartido por Dashboard, Life, Conversación e
 * Historial de conversaciones (Sprint 1/3). Envuelve páginas ya existentes sin
 * cambiar su contenido — `contentOverflow="hidden"` reproduce
 * exactamente el contenedor que /chat ya tenía en su propio layout
 * (scroll interno gestionado por la propia página, ver "doble h-screen
 * anidado" en el historial de commits); `"auto"` es el default seguro
 * para páginas de flujo normal (Dashboard, Historial).
 */
export async function AppShell({
  activeSection,
  contentOverflow = "auto",
  children,
}: {
  activeSection: ActiveSection;
  contentOverflow?: "auto" | "hidden";
  children: React.ReactNode;
}) {
  const session = await auth();
  const accountLabel = session?.user?.email ?? session?.user?.name ?? null;

  return (
    <div className="flex h-dvh flex-col bg-black text-white">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-black"
      >
        Saltar al contenido
      </a>

      <header className="flex flex-shrink-0 flex-col gap-2 border-b border-zinc-800 bg-black px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-6">
        <div className="flex flex-shrink-0 items-center gap-4 overflow-x-auto sm:gap-6">
          <Link
            href="/dashboard"
            className="flex-shrink-0 text-sm font-light tracking-[0.25em] text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500"
          >
            LUZ
          </Link>

          <nav aria-label="Secciones de LUZ">
            <ul className="flex flex-shrink-0 items-center gap-1">
              {SECTIONS.map((section) => {
                if (!section.href) {
                  return (
                    <li key={section.id}>
                      <span
                        aria-disabled="true"
                        title="Disponible próximamente"
                        className="block cursor-default whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs text-zinc-600 sm:px-3 sm:text-sm"
                      >
                        {section.label}
                      </span>
                    </li>
                  );
                }

                const isActive = section.id === activeSection;

                return (
                  <li key={section.id}>
                    <Link
                      href={section.href}
                      aria-current={isActive ? "page" : undefined}
                      className={
                        isActive
                          ? "block whitespace-nowrap rounded-full bg-zinc-900 px-2.5 py-1.5 text-xs text-white ring-1 ring-luz/40 ring-inset sm:px-3 sm:text-sm"
                          : "block whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs text-zinc-400 transition hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-700 sm:px-3 sm:text-sm"
                      }
                    >
                      {section.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        {accountLabel && (
          <div className="flex flex-shrink-0 items-center gap-3 text-xs text-zinc-400 sm:gap-4 sm:text-sm">
            <span className="max-w-[10rem] truncate sm:max-w-[16rem]">
              {accountLabel}
            </span>

            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button
                type="submit"
                className="whitespace-nowrap rounded-full border border-zinc-700 px-3 py-1.5 text-zinc-300 transition hover:border-white hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500 sm:px-4"
              >
                Cerrar sesión
              </button>
            </form>
          </div>
        )}
      </header>

      <div
        id="main-content"
        tabIndex={-1}
        className={
          contentOverflow === "hidden"
            ? "flex-1 overflow-hidden focus:outline-none"
            : "flex-1 overflow-y-auto focus:outline-none"
        }
      >
        {children}
      </div>
    </div>
  );
}
