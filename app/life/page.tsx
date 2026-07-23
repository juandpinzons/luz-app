import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getLifeGraphContext } from "@/auth/user-context";
import { db } from "@/core/db/client";
import type { Goal, Habit, Project } from "@/core/life";
import { LifeCard } from "@/features/life/components/life-card";
import { listAllGoals } from "@/features/life/services/list-all-goals";
import { listAllProjects } from "@/features/life/services/list-all-projects";
import { listAllHabits } from "@/features/life/services/list-all-habits";
import {
  listAllRelationships,
  type RelationshipWithDisplayName,
} from "@/features/life/services/list-all-relationships";
import { getLifeTimeline } from "@/features/life/services/get-life-timeline";
import {
  GOAL_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  RELATIONSHIP_TYPE_LABELS,
} from "@/features/life/labels";
import type { Memory } from "@/core/memory-engine";

function formatRelativeTime(date: Date): string {
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60_000);

  if (diffMinutes < 1) return "hace un momento";
  if (diffMinutes < 60) return `hace ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "ayer";
  if (diffDays < 30) return `hace ${diffDays} días`;

  const diffMonths = Math.floor(diffDays / 30);
  return `hace ${diffMonths} ${diffMonths === 1 ? "mes" : "meses"}`;
}

/**
 * Vista general de Life, solo lectura (Sprint 3, docs/product/
 * ALPHA_EXPERIENCE_V1_DESIGN.md §3.2/4.2) — cuatro franjas (Goals,
 * Projects, Habits, Relationships) + Timeline desde Memoria. Cada
 * franja se oculta si está vacía (silencio intencional) — hoy, para
 * cualquier usuario real, probablemente todas lo estén: nada en el
 * repositorio escribe Goal/Project/Habit/Relationship todavía (ningún
 * caller de `find-or-create-*`), así que esta pantalla es honesta
 * sobre eso, no rota.
 */
export default async function LifePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  let lifeGraphContext = null;
  try {
    lifeGraphContext = await getLifeGraphContext();
  } catch (error) {
    console.error("[life] no se pudo resolver LifeGraphContext:", error);
  }

  let goals: Goal[] = [];
  let projects: Project[] = [];
  let habits: Habit[] = [];
  let relationships: RelationshipWithDisplayName[] = [];
  let timeline: Memory[] = [];

  /**
   * `allSettled`, no `all`: antes, si una sola franja fallaba (p. ej.
   * Goals), las cinco desaparecían juntas — incluido el Timeline, que
   * no depende de las mismas tablas y podía tener datos reales de
   * memoria. Bug real, encontrado en producción — cada franja se
   * degrada por separado ahora, igual que ya se oculta por separado
   * cuando está vacía.
   */
  if (lifeGraphContext) {
    const [goalsResult, projectsResult, habitsResult, relationshipsResult, timelineResult] =
      await Promise.allSettled([
        listAllGoals(db, lifeGraphContext),
        listAllProjects(db, lifeGraphContext),
        listAllHabits(db, lifeGraphContext),
        listAllRelationships(db, lifeGraphContext),
        getLifeTimeline(db, lifeGraphContext),
      ]);

    if (goalsResult.status === "fulfilled") {
      goals = goalsResult.value;
    } else {
      console.error("[life] no se pudieron cargar Goals:", goalsResult.reason);
    }
    if (projectsResult.status === "fulfilled") {
      projects = projectsResult.value;
    } else {
      console.error("[life] no se pudieron cargar Projects:", projectsResult.reason);
    }
    if (habitsResult.status === "fulfilled") {
      habits = habitsResult.value;
    } else {
      console.error("[life] no se pudieron cargar Habits:", habitsResult.reason);
    }
    if (relationshipsResult.status === "fulfilled") {
      relationships = relationshipsResult.value;
    } else {
      console.error(
        "[life] no se pudieron cargar Relationships:",
        relationshipsResult.reason,
      );
    }
    if (timelineResult.status === "fulfilled") {
      timeline = timelineResult.value;
    } else {
      console.error("[life] no se pudo cargar el Timeline:", timelineResult.reason);
    }
  }

  const hasAnything =
    goals.length > 0 ||
    projects.length > 0 ||
    habits.length > 0 ||
    relationships.length > 0;

  return (
    <main className="min-h-full px-6 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-10">
        <h1 className="text-xl font-light tracking-[0.25em] text-white">
          LIFE
        </h1>

        {!hasAnything && timeline.length === 0 && (
          <p className="text-zinc-500">
            Todavía no tengo nada guardado sobre tu vida — a medida que
            hables conmigo, esto se va a ir llenando.
          </p>
        )}

        {goals.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-zinc-400">Goals</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              {goals.map((goal) => (
                <LifeCard
                  key={goal.id}
                  href={`/life/goals/${goal.id}`}
                  title={goal.title}
                  statusLabel={GOAL_STATUS_LABELS[goal.status]}
                  muted={goal.status === "completed" || goal.status === "abandoned"}
                />
              ))}
            </div>
          </section>
        )}

        {projects.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-zinc-400">Projects</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              {projects.map((project) => (
                <LifeCard
                  key={project.id}
                  href={`/life/projects/${project.id}`}
                  title={project.title}
                  statusLabel={PROJECT_STATUS_LABELS[project.status]}
                  muted={project.status === "completed" || project.status === "cancelled"}
                />
              ))}
            </div>
          </section>
        )}

        {habits.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-zinc-400">Habits</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              {habits.map((habit) => (
                <LifeCard
                  key={habit.id}
                  href={`/life/habits/${habit.id}`}
                  title={habit.title}
                  statusLabel={habit.active ? "activo" : "pausado"}
                  muted={!habit.active}
                />
              ))}
            </div>
          </section>
        )}

        {relationships.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-zinc-400">
              Relationships
            </h2>
            <div className="mt-3 flex flex-wrap gap-3">
              {relationships.map((relationship) => (
                <LifeCard
                  key={relationship.id}
                  href={`/life/relationships/${relationship.id}`}
                  title={relationship.otherPersonName}
                  statusLabel={RELATIONSHIP_TYPE_LABELS[relationship.type]}
                />
              ))}
            </div>
          </section>
        )}

        {timeline.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-zinc-400">Timeline</h2>
            <ul className="mt-3 space-y-3 border-l border-zinc-800 pl-4">
              {timeline.map((memory) => (
                <li key={memory.id} className="text-sm">
                  <span className="text-zinc-500">
                    {formatRelativeTime(memory.occurredAt ?? memory.createdAt)}
                  </span>{" "}
                  <span className="text-zinc-300">
                    &ldquo;{memory.content}&rdquo;
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
