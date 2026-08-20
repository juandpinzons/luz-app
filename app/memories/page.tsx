import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getLifeGraphContext } from "@/auth/user-context";
import { db } from "@/core/db/client";
import { listAllGoals } from "@/features/life/services/list-all-goals";
import { listAllProjects } from "@/features/life/services/list-all-projects";
import {
  groupByTimeLabel,
  searchMemories,
  type MemoryTimeGroup,
  type MemoryWithConnections,
} from "@/features/memories/services/search-memories";
import { selectMemoryHighlights } from "@/features/memories/services/select-memory-highlights";
import {
  getMemoryTimelineIndex,
  type MemoryMonthBucket,
} from "@/features/memories/services/get-memory-timeline-index";
import {
  listValidatedInsights,
  type ValidatedInsights,
} from "@/features/knowledge/services/list-validated-insights";
import { MemoryCard } from "@/features/memories/components/memory-card";
import { MemorySelectionBar } from "@/features/memories/components/memory-selection-bar";
import { MemorySelectionProvider } from "@/features/memories/components/memory-selection-context";
import { MemoryTimelineSidebar } from "@/features/memories/components/memory-timeline-sidebar";
import { MemoryTimelineStrip } from "@/features/memories/components/memory-timeline-strip";
import { InsightCard } from "@/features/memories/components/insight-card";

const VALID_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/**
 * Memories, solo lectura (Sprint 4, docs/product/
 * ALPHA_EXPERIENCE_V1_DESIGN.md §3.3/4.3) — conexiones (ya reales) y
 * menciones a Life visibles. Sin edición, explícitamente V1.
 *
 * Búsqueda vía `?q=` con un `<form method="GET">` nativo — mismo
 * patrón, sin JS de cliente, que `/conversations` ya usa.
 *
 * Landing (UX_ARCHITECTURE_REFINEMENT_V1.md §3, "Highlights"): sin
 * búsqueda activa, la entrada a la pantalla ya no es la lista
 * cronológica completa -- son los "Momentos que más han quedado"
 * (`selectMemoryHighlights`). Lo cronológico no desaparece, pasa a ser
 * el "ver todo" alcanzable con un link (`?view=all`), nunca lo primero
 * que se ve. Con búsqueda activa, sin cambios: se muestra todo lo que
 * coincide, agrupado por tiempo -- filtrar resultados de búsqueda por
 * highlights escondería coincidencias reales que la persona sí pidió.
 */
export default async function MemoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; view?: string; month?: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { q, view, month } = await searchParams;
  const searchTerm = q?.trim() || undefined;
  const showHidden = view === "hidden";
  // Nunca se confía en un query param crudo (mismo criterio que
  // `searchTerm` arriba) -- si no matchea "YYYY-MM" se descarta en vez
  // de pasarlo a la consulta.
  const validMonth = month && VALID_MONTH_PATTERN.test(month) ? month : undefined;
  const showMonth = Boolean(validMonth) && !showHidden;
  const showAllChronological = (view === "all" || Boolean(searchTerm)) && !showHidden && !showMonth;

  let lifeGraphContext = null;
  try {
    lifeGraphContext = await getLifeGraphContext();
  } catch (error) {
    console.error("[memories] no se pudo resolver LifeGraphContext:", error);
  }

  /**
   * Segunda capa de memoria (auditoría de arquitectura, 2026-08-16):
   * consulta aparte, nunca combinada con `text`/highlights -- ver
   * docblock de `listRecentActiveMemories`. Vacío si `!showHidden`,
   * nunca se pide sin necesidad.
   */
  let hiddenGroups: MemoryTimeGroup[] = [];
  let groups: MemoryTimeGroup[] = [];
  let highlights: Awaited<ReturnType<typeof selectMemoryHighlights>> = [];
  /** Lista plana de un solo mes (`?month=`) -- no pasa por `groupByTimeLabel`: un solo mes agrupado en Hoy/Esta semana/Este mes/Más atrás degenera casi siempre a un único bucket. */
  let monthMemories: MemoryWithConnections[] = [];
  /** Índice de meses con recuerdos, para la franja de `MemoryTimelineSidebar` -- vacío mientras `showHidden` (la franja no se muestra ahí). */
  let months: MemoryMonthBucket[] = [];
  /** Títulos de Goal/Project ya persistidos — misma búsqueda literal de §3.2.1, en la dirección inversa (¿qué Life aparece dentro de esta memoria?). */
  let lifeTitles: string[] = [];
  /**
   * Comprensión ya validada por Knowledge Engine (ver
   * `list-validated-insights.ts`) — solo tiene sentido como resumen de
   * "lo que ya entiendo", nunca mezclada con una búsqueda puntual, así
   * que no se pide durante `searchTerm` (misma disciplina de no
   * mostrar algo fuera de lugar que ya usa el resto de la página).
   */
  let insights: ValidatedInsights = { items: [], total: 0, byType: {} };

  if (lifeGraphContext && showHidden) {
    try {
      hiddenGroups = await searchMemories(db, lifeGraphContext, {
        groupByTime: true,
        visibility: "hidden",
      });
    } catch (error) {
      console.error("[memories] no se pudieron cargar los recuerdos ocultos:", error);
    }
  } else if (lifeGraphContext && showMonth && validMonth) {
    try {
      const [flatMemories, timelineIndex, goals, projects] = await Promise.all([
        searchMemories(db, lifeGraphContext, { month: validMonth }),
        getMemoryTimelineIndex(db, lifeGraphContext),
        listAllGoals(db, lifeGraphContext),
        listAllProjects(db, lifeGraphContext),
      ]);
      monthMemories = flatMemories;
      months = timelineIndex;
      lifeTitles = [...goals, ...projects].map((item) => item.title);
    } catch (error) {
      console.error("[memories] no se pudieron cargar los recuerdos del mes:", error);
    }
  } else if (lifeGraphContext) {
    try {
      const [flatMemories, timelineIndex, goals, projects, validatedInsights] = await Promise.all([
        // Sin `groupByTime` -- una sola consulta, reutilizada abajo tanto
        // para "ver todo" (agrupado por tiempo) como para Highlights
        // (filtrado por rank.score), nunca dos consultas por la misma
        // visita.
        searchMemories(db, lifeGraphContext, { text: searchTerm }),
        getMemoryTimelineIndex(db, lifeGraphContext),
        listAllGoals(db, lifeGraphContext),
        listAllProjects(db, lifeGraphContext),
        searchTerm
          ? Promise.resolve<ValidatedInsights>({ items: [], total: 0, byType: {} })
          : listValidatedInsights(db, lifeGraphContext),
      ]);
      groups = groupByTimeLabel(flatMemories);
      highlights = selectMemoryHighlights(flatMemories);
      months = timelineIndex;
      lifeTitles = [...goals, ...projects].map((item) => item.title);
      insights = validatedInsights;
    } catch (error) {
      console.error("[memories] no se pudieron cargar las memorias:", error);
    }
  }

  const hasResults = showHidden
    ? hiddenGroups.some((group) => group.memories.length > 0)
    : showMonth
      ? monthMemories.length > 0
      : groups.some((group) => group.memories.length > 0);

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
    <MemorySelectionProvider>
      <main className="min-h-full px-6 py-10 text-white">
        <div className="mx-auto flex w-full max-w-2xl gap-10 md:max-w-4xl">
          <div className="w-full max-w-2xl">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl font-light tracking-[0.25em]">RECUERDOS</h1>
            {!showHidden && (
              <Link
                href="/memories?view=hidden"
                className="whitespace-nowrap text-xs text-zinc-500 underline decoration-zinc-700 underline-offset-4 hover:text-zinc-300"
              >
                Ocultos
              </Link>
            )}
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

          {!showHidden && <MemoryTimelineStrip months={months} activeMonth={validMonth} />}

          {insights.items.length > 0 && (
            <section className="animate-fade-in mt-8">
              <h2 className="text-sm font-medium text-zinc-400">
                Lo que he entendido{" "}
                <span className="text-xs text-zinc-600">{insights.total}</span>
              </h2>
              <ul className="mt-3 space-y-2">
                {insights.items.map((insight, index) => (
                  <InsightCard key={insight.id} explanation={insight} index={index} />
                ))}
              </ul>
              {insights.total > insights.items.length && (
                <p className="mt-2 text-xs text-zinc-600">
                  Mostrando {insights.items.length} de {insights.total}.
                </p>
              )}
            </section>
          )}

          {!hasResults && (
            <p className="animate-fade-in mt-10 text-sm text-zinc-500">
              {showHidden
                ? "Todavía no has ocultado ningún recuerdo."
                : showMonth
                  ? "No tengo recuerdos guardados en ese mes."
                  : searchTerm
                    ? "No encontré recuerdos con eso."
                    : "Esto se va a ir llenando con lo que me vayas contando."}
            </p>
          )}

          {showHidden && (
            <Link
              href="/memories"
              className="animate-fade-in mt-8 inline-block text-xs text-zinc-500 underline decoration-zinc-700 underline-offset-4 hover:text-zinc-300"
            >
              ← Volver
            </Link>
          )}

          {hasResults && showHidden && (
            <div className="mt-4 space-y-8">
              {hiddenGroups.map((group) => (
                <section key={group.label}>
                  <h2 className="text-sm font-medium text-zinc-400">{group.label}</h2>
                  <ul className="mt-3 space-y-2">
                    {group.memories.map((memory, index) => (
                      <MemoryCard
                        key={memory.id}
                        memory={memory}
                        index={Math.min(index, 12)}
                        connectedContents={memory.connectedContents}
                        mentionedLifeTitles={[]}
                        showActions
                        isHidden
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {!showHidden && !showMonth && hasResults && !showAllChronological && (
            <section className="animate-fade-in mt-8">
              <h2 className="text-sm font-medium text-zinc-400">
                Momentos que más han quedado
              </h2>
              {highlights.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {highlights.map((memory, index) => (
                    <MemoryCard
                      key={memory.id}
                      memory={memory}
                      index={Math.min(index, 12)}
                      connectedContents={memory.connectedContents}
                      mentionedLifeTitles={lifeTitles.filter((title) =>
                        memory.content.toLowerCase().includes(title.toLowerCase()),
                      )}
                      showActions
                    />
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-zinc-500">
                  Todavía no tengo un puñado de momentos que se destaquen
                  especialmente sobre el resto — cuanto más me cuentes, más
                  se va a ir llenando esto.
                </p>
              )}
              <Link
                href="/memories?view=all"
                className="mt-4 inline-block text-xs text-zinc-500 underline decoration-zinc-700 underline-offset-4 hover:text-zinc-300"
              >
                Ver todo, en orden →
              </Link>
            </section>
          )}

          {showMonth && (
            <Link
              href="/memories"
              className="animate-fade-in mt-8 inline-block text-xs text-zinc-500 underline decoration-zinc-700 underline-offset-4 hover:text-zinc-300"
            >
              ← Momentos destacados
            </Link>
          )}

          {hasResults && showMonth && (
            <section className="mt-4">
              <h2 className="text-sm font-medium text-zinc-400">
                {months.find((bucket) => bucket.month === validMonth)?.label ?? validMonth}
              </h2>
              <ul className="mt-3 space-y-2">
                {monthMemories.map((memory, index) => (
                  <MemoryCard
                    key={memory.id}
                    memory={memory}
                    index={Math.min(index, 12)}
                    connectedContents={memory.connectedContents}
                    mentionedLifeTitles={lifeTitles.filter((title) =>
                      memory.content.toLowerCase().includes(title.toLowerCase()),
                    )}
                    showActions
                  />
                ))}
              </ul>
            </section>
          )}

          {hasResults && showAllChronological && (
            <>
              {!searchTerm && (
                <Link
                  href="/memories"
                  className="animate-fade-in mt-8 inline-block text-xs text-zinc-500 underline decoration-zinc-700 underline-offset-4 hover:text-zinc-300"
                >
                  ← Momentos destacados
                </Link>
              )}
              <div className={searchTerm ? "mt-8 space-y-8" : "mt-4 space-y-8"}>
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
                          showActions
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            </>
          )}
          </div>

          {!showHidden && <MemoryTimelineSidebar months={months} activeMonth={validMonth} />}
        </div>
      </main>

      <MemorySelectionBar />
    </MemorySelectionProvider>
  );
}
