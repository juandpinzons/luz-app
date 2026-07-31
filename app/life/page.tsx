import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getLifeGraphContext } from "@/auth/user-context";
import type { Belief } from "@/core/belief-engine";
import { DrizzleBeliefRepository } from "@/core/belief-engine";
import type { Concept } from "@/core/concept-graph";
import { DrizzleConceptRepository } from "@/core/concept-graph";
import { db } from "@/core/db/client";
import type { Goal, Habit, Project } from "@/core/life";
import { LifeCard } from "@/features/life/components/life-card";
import { LifeGraphView } from "@/features/life/components/life-graph-view";
import { listAllGoals } from "@/features/life/services/list-all-goals";
import { listAllProjects } from "@/features/life/services/list-all-projects";
import { listAllHabits } from "@/features/life/services/list-all-habits";
import {
  listAllRelationships,
  type RelationshipWithDisplayName,
} from "@/features/life/services/list-all-relationships";
import { getLifeTimeline, type LifeTimeline } from "@/features/life/services/get-life-timeline";
import { assembleLifeGraph } from "@/features/life/services/build-life-graph";
import {
  listValidatedInsights,
  type ValidatedInsights,
} from "@/features/knowledge/services/list-validated-insights";
import {
  GOAL_STATUS_LABELS,
  PROJECT_STATUS_LABELS,
  RELATIONSHIP_TYPE_LABELS,
} from "@/features/life/labels";
import { describeError } from "@/core/observability/describe-error";
import { createRequestId, logger } from "@/core/observability/logger";

const ROUTE = "/life";

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
 * ALPHA_EXPERIENCE_V1_DESIGN.md §3.2/4.2) — cinco franjas (Goals,
 * Projects, Habits, Relationships, Insights) + Timeline desde Memoria.
 * Cada franja se oculta si está vacía (silencio intencional).
 *
 * Desde el mapa mental (LifeGraph): la misma información se reagrupa
 * (`assembleLifeGraph`, síncrono, sin consultas nuevas) en ramas
 * visuales -- la lista de abajo sigue siendo exactamente la misma
 * lectura de siempre, ahora también disponible como "Vista lista"
 * dentro de `LifeGraphView`.
 */
export default async function LifePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const requestId = createRequestId();

  let lifeGraphContext = null;
  try {
    lifeGraphContext = await getLifeGraphContext();
  } catch (error) {
    logger.log({
      event: "life.life_graph_context_failed",
      severity: "error",
      requestId,
      route: ROUTE,
      userId: session.user.id,
      ...describeError(error),
    });
  }

  let goals: Goal[] = [];
  let projects: Project[] = [];
  let habits: Habit[] = [];
  let relationships: RelationshipWithDisplayName[] = [];
  let timeline: LifeTimeline = { items: [], total: 0, byType: {} };
  let insights: ValidatedInsights = { items: [], total: 0, byType: {} };
  let beliefs: Belief[] = [];
  let concepts: Concept[] = [];

  /**
   * `allSettled`, no `all`: si una sola franja falla, las demás no
   * desaparecen con ella (bug real, ya corregido en producción antes
   * de este cambio) -- cada franja se degrada por separado.
   */
  if (lifeGraphContext) {
    const [
      goalsResult,
      projectsResult,
      habitsResult,
      relationshipsResult,
      timelineResult,
      insightsResult,
      beliefsResult,
      conceptsResult,
    ] = await Promise.allSettled([
      listAllGoals(db, lifeGraphContext),
      listAllProjects(db, lifeGraphContext),
      listAllHabits(db, lifeGraphContext),
      listAllRelationships(db, lifeGraphContext),
      getLifeTimeline(db, lifeGraphContext),
      listValidatedInsights(db, lifeGraphContext),
      new DrizzleBeliefRepository(db).list(lifeGraphContext),
      new DrizzleConceptRepository(db).list(lifeGraphContext),
    ]);

    if (goalsResult.status === "fulfilled") {
      goals = goalsResult.value;
    } else {
      logger.log({
        event: "life.goals_failed",
        severity: "error",
        requestId,
        route: ROUTE,
        userId: session.user.id,
        lifeGraphId: lifeGraphContext.lifeGraphId,
        ...describeError(goalsResult.reason),
      });
    }
    if (projectsResult.status === "fulfilled") {
      projects = projectsResult.value;
    } else {
      logger.log({
        event: "life.projects_failed",
        severity: "error",
        requestId,
        route: ROUTE,
        userId: session.user.id,
        lifeGraphId: lifeGraphContext.lifeGraphId,
        ...describeError(projectsResult.reason),
      });
    }
    if (habitsResult.status === "fulfilled") {
      habits = habitsResult.value;
    } else {
      logger.log({
        event: "life.habits_failed",
        severity: "error",
        requestId,
        route: ROUTE,
        userId: session.user.id,
        lifeGraphId: lifeGraphContext.lifeGraphId,
        ...describeError(habitsResult.reason),
      });
    }
    if (relationshipsResult.status === "fulfilled") {
      relationships = relationshipsResult.value;
    } else {
      logger.log({
        event: "life.relationships_failed",
        severity: "error",
        requestId,
        route: ROUTE,
        userId: session.user.id,
        lifeGraphId: lifeGraphContext.lifeGraphId,
        ...describeError(relationshipsResult.reason),
      });
    }
    if (timelineResult.status === "fulfilled") {
      timeline = timelineResult.value;
    } else {
      logger.log({
        event: "life.timeline_failed",
        severity: "error",
        requestId,
        route: ROUTE,
        userId: session.user.id,
        lifeGraphId: lifeGraphContext.lifeGraphId,
        ...describeError(timelineResult.reason),
      });
    }
    if (insightsResult.status === "fulfilled") {
      insights = insightsResult.value;
    } else {
      logger.log({
        event: "life.insights_failed",
        severity: "error",
        requestId,
        route: ROUTE,
        userId: session.user.id,
        lifeGraphId: lifeGraphContext.lifeGraphId,
        ...describeError(insightsResult.reason),
      });
    }
    if (beliefsResult.status === "fulfilled") {
      beliefs = beliefsResult.value;
    } else {
      logger.log({
        event: "life.beliefs_failed",
        severity: "error",
        requestId,
        route: ROUTE,
        userId: session.user.id,
        lifeGraphId: lifeGraphContext.lifeGraphId,
        ...describeError(beliefsResult.reason),
      });
    }
    if (conceptsResult.status === "fulfilled") {
      concepts = conceptsResult.value;
    } else {
      logger.log({
        event: "life.concepts_failed",
        severity: "error",
        requestId,
        route: ROUTE,
        userId: session.user.id,
        lifeGraphId: lifeGraphContext.lifeGraphId,
        ...describeError(conceptsResult.reason),
      });
    }
  }

  const hasAnything =
    goals.length > 0 ||
    projects.length > 0 ||
    habits.length > 0 ||
    relationships.length > 0;

  const summary = assembleLifeGraph({
    goals,
    projects,
    habits,
    relationships,
    timeline,
    insights,
    beliefs,
    concepts,
  });
  const firstName = (session.user.name ?? "").trim().split(/\s+/)[0] || "ti";

  const listView = (
    <div className="mx-auto w-full max-w-3xl space-y-10">
      {!hasAnything && timeline.items.length === 0 && (
        <p className="animate-fade-in text-zinc-500">
          Todavía no tengo nada guardado sobre tu vida — a medida que
          hables conmigo, esto se va a ir llenando.
        </p>
      )}

      {goals.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-zinc-400">Objetivos</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {goals.map((goal, index) => (
              <LifeCard
                key={goal.id}
                index={Math.min(index, 10)}
                href={`/life/goals/${goal.id}`}
                title={goal.title}
                statusLabel={GOAL_STATUS_LABELS[goal.status]}
                muted={goal.status === "abandoned"}
                celebrated={goal.status === "completed"}
              />
            ))}
          </div>
        </section>
      )}

      {projects.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-zinc-400">Proyectos</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {projects.map((project, index) => (
              <LifeCard
                key={project.id}
                index={Math.min(index, 10)}
                href={`/life/projects/${project.id}`}
                title={project.title}
                statusLabel={PROJECT_STATUS_LABELS[project.status]}
                muted={project.status === "cancelled"}
                celebrated={project.status === "completed"}
              />
            ))}
          </div>
        </section>
      )}

      {habits.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-zinc-400">Hábitos</h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {habits.map((habit, index) => (
              <LifeCard
                key={habit.id}
                index={Math.min(index, 10)}
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
            Relaciones
          </h2>
          <div className="mt-3 flex flex-wrap gap-3">
            {relationships.map((relationship, index) => (
              <LifeCard
                key={relationship.id}
                index={Math.min(index, 10)}
                href={`/life/relationships/${relationship.id}`}
                title={relationship.otherPersonName}
                statusLabel={RELATIONSHIP_TYPE_LABELS[relationship.type]}
              />
            ))}
          </div>
        </section>
      )}

      {timeline.items.length > 0 && (
        <section>
          <h2 className="text-sm font-medium text-zinc-400">Cronología</h2>
          <ul className="mt-3 space-y-3 border-l border-luz/25 pl-4">
            {timeline.items.map((memory, index) => (
              <li
                key={memory.id}
                className="animate-fade-in text-sm"
                style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
              >
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
  );

  return (
    <main className="min-h-full px-6 py-10">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="text-xl font-light tracking-[0.25em] text-white">
            VIDA
          </h1>
          <Link
            href="/life/identity"
            className="rounded text-sm text-zinc-500 underline decoration-zinc-700 underline-offset-4 transition hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
          >
            Quién eres para LUZ →
          </Link>
        </div>

        <div className="mt-6">
          <LifeGraphView personName={firstName} summary={summary} listView={listView} />
        </div>
      </div>
    </main>
  );
}
