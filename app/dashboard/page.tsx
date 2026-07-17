import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getLifeGraphContext } from "@/auth/user-context";
import { db } from "@/core/db/client";
import { buildMorningBrief } from "@/features/dashboard/services/build-morning-brief";

/**
 * Puerta de entrada de LUZ después del login (Sprint Alpha-1a). El
 * proxy (`proxy.ts`) ya exige sesión para llegar aquí; el `redirect`
 * es defensivo, mismo criterio que `app/chat/layout.tsx`.
 *
 * Si `LifeGraphContext` no se resuelve, se degrada a un saludo simple
 * en vez de romper la pantalla — mismo criterio de tolerancia a fallos
 * que ya usa `sendMessage` desde Sprint B1.
 */
export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  let lifeGraphContext = null;
  try {
    lifeGraphContext = await getLifeGraphContext();
  } catch (error) {
    console.error("[dashboard] no se pudo resolver LifeGraphContext:", error);
  }

  const brief = lifeGraphContext
    ? await buildMorningBrief(db, lifeGraphContext, session.user.name ?? "")
    : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black px-6 text-white">
      <div className="w-full max-w-xl">
        <div className="space-y-3 text-lg font-light text-zinc-200">
          {brief ? (
            <>
              <p>{brief.greetingLine}</p>
              <p>{brief.dateLine}</p>
              <p>{brief.lifeLine}</p>
              {brief.continuityLine && <p>{brief.continuityLine}</p>}
            </>
          ) : (
            <p>Buenos días.</p>
          )}
        </div>

        <Link
          href="/chat"
          className="mt-10 inline-block rounded-full bg-white px-8 py-3 font-medium text-black transition hover:bg-zinc-200"
        >
          Continuar conversación
        </Link>
      </div>
    </main>
  );
}
