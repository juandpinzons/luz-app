import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getLifeGraphContext } from "@/auth/user-context";
import { db } from "@/core/db/client";
import { listAllGoals } from "@/features/life/services/list-all-goals";
import { listAllProjects } from "@/features/life/services/list-all-projects";
import {
  searchMemories,
  type MemoryTimeGroup,
} from "@/features/memories/services/search-memories";
import { MemoryCard } from "@/features/memories/components/memory-card";

/**
 * Memories, solo lectura (Sprint 4, docs/product/
 * ALPHA_EXPERIENCE_V1_DESIGN.md §3.3/4.3) — agrupadas por tiempo,
 * búsqueda de texto libre, conexiones (ya reales) y menciones a
 * Life visibles. Sin edición, explícitamente V1.
 *
 * Búsqueda vía `?q=` con un `<form method="GET">` nativo — mismo
 * patrón, sin JS de cliente, que `/conversations` ya usa.
 */
export default async function MemoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { q } = await searchParams;
  const searchTerm = q?.trim() || undefined;

  let lifeGraphContext = null;
  try {
    lifeGraphContext = await getLifeGraphContext();
  } catch (error) {
    console.error("[memories] no se pudo resolver LifeGraphContext:", error);
  }

  let groups: MemoryTimeGroup[] = [];
  /** Títulos de Goal/Project ya persistidos — misma búsqueda literal de §3.2.1, en la dirección inversa (¿qué Life aparece dentro de esta memoria?). */
  let lifeTitles: string[] = [];

  if (lifeGraphContext) {
    try {
      const [memoryGroups, goals, projects] = await Promise.all([
        searchMemories(db, lifeGraphContext, {
          text: searchTerm,
          groupByTime: true,
        }),
        listAllGoals(db, lifeGraphContext),
        listAllProjects(db, lifeGraphContext),
      ]);
      groups = memoryGroups;
      lifeTitles = [...goals, ...projects].map((item) => item.title);
    } catch (error) {
      console.error("[memories] no se pudieron cargar las memorias:", error);
    }
  }

  const hasResults = groups.some((group) => group.memories.length > 0);

  /**
   * Posición global de cada memoria (no solo dentro de su grupo de
   * tiempo) — solo para escalonar la entrada (`MemoryCard.index`).
   * Calculada antes del JSX, no mutando una variable dentro del
   * `.map()` que lo renderiza (regla `react-hooks/immutability`).
   */
  const memoryIndexById = new Map<string, number>();
  for (const group of groups) {
    for (const memory of group.memories) {
      memoryIndexById.set(memory.id, memoryIndexById.size);
    }
  }

  return (
    <main className="min-h-full px-6 py-10 text-white">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-xl font-light tracking-[0.25em]">RECUERDOS</h1>
        </div>

        <form method="GET" action="/memories" className="mt-6 flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={searchTerm ?? ""}
            placeholder="Buscar en tus recuerdos..."
            aria-label="Buscar en tus recuerdos"
            className="flex-1 rounded-lg bg-zinc-900 px-4 py-3 text-sm text-white outline-none ring-1 ring-zinc-800 placeholder:text-zinc-600 focus:ring-white focus-visible:ring-luz"
          />
          <button
            type="submit"
            className="rounded-lg bg-white px-5 text-sm font-medium text-black transition hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
          >
            Buscar
          </button>
        </form>

        {!hasResults && (
          <p className="animate-fade-in mt-10 text-sm text-zinc-500">
            {searchTerm
              ? "No encontré recuerdos con eso."
              : "Esto se va a ir llenando con lo que me vayas contando."}
          </p>
        )}

        <div className="mt-8 space-y-8">
          {groups.map((group) => (
            <section key={group.label}>
              <h2 className="text-sm font-medium text-zinc-400">
                {group.label}
              </h2>
              <ul className="mt-3 space-y-2">
                {group.memories.map((memory) => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    index={Math.min(memoryIndexById.get(memory.id) ?? 0, 12)}
                    connectedContents={memory.connectedContents}
                    mentionedLifeTitles={lifeTitles.filter((title) =>
                      memory.content.toLowerCase().includes(title.toLowerCase()),
                    )}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
