import { eq, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getLifeGraphContext, getUserContext } from "@/auth/user-context";
import { db } from "@/core/db/client";
import { conversations } from "@/core/db/schema";
import { listActiveGoals, listActiveProjects, type Goal, type Project } from "@/core/life";
import {
  buildMorningBrief,
  timeOfDayGreeting,
} from "@/features/dashboard/services/build-morning-brief";
import {
  buildDashboardSummary,
  type DashboardSummary,
} from "@/features/dashboard/services/build-dashboard-summary";
import { DashboardActivitySummary } from "@/features/dashboard/components/dashboard-activity-summary";
import {
  getUpcomingDeadlines,
  type UpcomingDeadline,
} from "@/features/life/services/get-upcoming-deadlines";
import { describeError } from "@/core/observability/describe-error";
import { createRequestId, logger } from "@/core/observability/logger";

const ROUTE = "/dashboard";

const UPCOMING_WINDOW_DAYS = 14;

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

/** A partir de cuántos días sin hablar vale la pena reconocer la pausa, en vez de saludar como si fuera un día cualquiera. */
const RETURNING_GAP_DAYS = 3;

function daysSince(date: Date, now: Date): number {
  return Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Sprint "Memorability": antes, volver después de dos semanas sin
 * hablar se sentía exactamente igual que volver al día siguiente —
 * mismo saludo, mismo silencio si no había memoria o insight lo
 * bastante fuerte para que `continuityLine` (IA) dijera algo.
 * Determinista a propósito, no una llamada a IA más: la pausa en sí
 * ya es la señal, no hace falta interpretarla.
 */
function buildReturningLine(daysAway: number): string {
  if (daysAway >= 14) {
    return "Ha pasado bastante tiempo. Me alegra que hayas vuelto.";
  }
  return "Ha pasado un tiempo desde la última vez que hablamos. Qué bueno verte de nuevo.";
}

/**
 * Puerta de entrada de LUZ después del login (Sprint Alpha-1a; Dashboard
 * V2 en Sprint 2, docs/product/ALPHA_EXPERIENCE_V1_DESIGN.md §3.1/4.1).
 * El proxy (`proxy.ts`) ya exige sesión para llegar aquí; el `redirect`
 * es defensivo, mismo criterio que `app/chat/layout.tsx`.
 *
 * Si `LifeGraphContext` no se resuelve, se degrada a un saludo simple
 * en vez de romper la pantalla — mismo criterio de tolerancia a fallos
 * que ya usa `sendMessage` desde Sprint B1.
 */
export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Un solo id por render, para poder correlacionar todas las líneas
  // de log de esta carga del Dashboard entre sí (mismo patrón que
  // app/api/chat/route.ts).
  const requestId = createRequestId();

  /**
   * Señal de "primera visita" (ONBOARDING_PLAN.md, hallazgo #5):
   * `isNewUser` ya se graba en `auth_sign_in` desde hace tiempo, pero
   * solo describe el momento exacto del primer login -- alguien puede
   * crear la cuenta y volver días después sin haber mandado un
   * mensaje todavía, y sigue siendo "nuevo" en el sentido que importa
   * acá. Cero conversaciones es la señal más directa y estable de
   * "todavía no vivió nada con LUZ", así que se usa esa, no el evento
   * de login.
   */
  const [conversationCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(conversations)
    .where(eq(conversations.userId, session.user.id));
  const isFirstVisit = conversationCount.n === 0;

  let lifeGraphContext = null;
  try {
    lifeGraphContext = await getLifeGraphContext();
  } catch (error) {
    logger.log({
      event: "dashboard.life_graph_context_failed",
      severity: "error",
      requestId,
      route: ROUTE,
      userId: session.user.id,
      ...describeError(error),
    });
  }

  /**
   * Antes sin try/catch: si `assembleRealitySnapshot` fallaba (p. ej.
   * una consulta a `core/life` real), tumbaba toda la página en vez de
   * degradarse — el mismo criterio de tolerancia a fallos que ya
   * protege a `lifeGraphContext` y `summary` en este archivo le
   * faltaba justo aquí. Corregido (bug real, encontrado en producción).
   */
  let brief = null;
  if (lifeGraphContext) {
    try {
      brief = await buildMorningBrief(db, lifeGraphContext, session.user.name ?? "");
    } catch (error) {
      logger.log({
        event: "dashboard.morning_brief_failed",
        severity: "error",
        requestId,
        route: ROUTE,
        userId: session.user.id,
        lifeGraphId: lifeGraphContext.lifeGraphId,
        ...describeError(error),
      });
    }
  }

  /**
   * Goals/Projects reales, leídos directo de `core/life` — no vía
   * Reality Snapshot (ese contrato es para ensamblar el prompt de IA,
   * ADR-0013; una pantalla de solo lectura no lo necesita, §6 del
   * diseño). "Próximos a vencer" responde a la vez las preguntas (a) y
   * (d) del §3.1 — ambas usan la misma ventana de 14 días sobre
   * targetDate/dueDate; mostrarlas por separado habría repetido los
   * mismos Goals/Projects dos veces.
   *
   * `allSettled`, no `all`: antes, si una de las tres fallaba, las tres
   * desaparecían juntas (mismo bug de fondo que en app/life/page.tsx) —
   * cada una se degrada por separado ahora.
   */
  let activeGoals: Goal[] = [];
  let activeProjects: Project[] = [];
  let upcomingDeadlines: UpcomingDeadline[] = [];
  if (lifeGraphContext) {
    const [goalsResult, projectsResult, deadlinesResult] = await Promise.allSettled([
      listActiveGoals(db, lifeGraphContext),
      listActiveProjects(db, lifeGraphContext),
      getUpcomingDeadlines(db, lifeGraphContext, {
        withinDays: UPCOMING_WINDOW_DAYS,
      }),
    ]);
    if (goalsResult.status === "fulfilled") {
      activeGoals = goalsResult.value;
    } else {
      logger.log({
        event: "dashboard.active_goals_failed",
        severity: "error",
        requestId,
        route: ROUTE,
        userId: session.user.id,
        lifeGraphId: lifeGraphContext.lifeGraphId,
        ...describeError(goalsResult.reason),
      });
    }
    if (projectsResult.status === "fulfilled") {
      activeProjects = projectsResult.value;
    } else {
      logger.log({
        event: "dashboard.active_projects_failed",
        severity: "error",
        requestId,
        route: ROUTE,
        userId: session.user.id,
        lifeGraphId: lifeGraphContext.lifeGraphId,
        ...describeError(projectsResult.reason),
      });
    }
    if (deadlinesResult.status === "fulfilled") {
      upcomingDeadlines = deadlinesResult.value;
    } else {
      logger.log({
        event: "dashboard.upcoming_deadlines_failed",
        severity: "error",
        requestId,
        route: ROUTE,
        userId: session.user.id,
        lifeGraphId: lifeGraphContext.lifeGraphId,
        ...describeError(deadlinesResult.reason),
      });
    }
  }
  const activeLifeItems = [...activeGoals, ...activeProjects];

  /**
   * Resumen del Dashboard (Sprint Alpha-1a: Dashboard) — datos reales
   * únicamente, nunca placeholders. Igual que `lifeGraphContext` arriba,
   * si esto falla la página se degrada (secciones ocultas) en vez de
   * romperse — mismo criterio de tolerancia a fallos de todo el archivo.
   */
  let summary: DashboardSummary | null = null;
  try {
    const userContext = await getUserContext();
    if (userContext) {
      summary = await buildDashboardSummary(db, userContext, lifeGraphContext);
    }
  } catch (error) {
    logger.log({
      event: "dashboard.summary_failed",
      severity: "error",
      requestId,
      route: ROUTE,
      userId: session.user.id,
      ...describeError(error),
    });
  }

  const daysSinceLastMessage = summary?.lastMessageAt
    ? daysSince(summary.lastMessageAt, new Date())
    : null;
  const returningGapDays =
    !isFirstVisit &&
    !brief?.continuityLine &&
    daysSinceLastMessage !== null &&
    daysSinceLastMessage >= RETURNING_GAP_DAYS
      ? daysSinceLastMessage
      : null;

  return (
    <main className="flex min-h-full flex-col items-center px-6 py-16 text-white">
      <div className="w-full max-w-xl">
        {/*
          El saludo es lo primero que LUZ "dice" en cada visita — antes
          tenía el mismo peso tipográfico que cualquier otra línea de
          la página (`text-lg font-light` para saludo y fecha por
          igual). Ahora es la línea más grande de todo el Dashboard;
          la fecha queda deliberadamente más chica y muted, como una
          acotación, no como parte del saludo.
        */}
        <div className="animate-fade-in space-y-1">
          {brief ? (
            <>
              <p className="text-2xl font-light text-zinc-100">{brief.greetingLine}</p>
              <p className="text-sm text-zinc-500">{brief.dateLine}</p>
            </>
          ) : (
            <p className="text-2xl font-light text-zinc-100">
              {timeOfDayGreeting(new Date())}.
            </p>
          )}
        </div>

        {/*
          Borde con el acento `luz` en vez de `zinc-800` genérico —
          esta caja es la voz de LUZ dirigiéndose a la persona
          (bienvenida o continuidad), no un dato mostrado sobre su
          vida; antes usaba exactamente el mismo lenguaje visual que
          "Próximos a vencer"/"Objetivos activos" más abajo y se
          perdía entre ellos.
        */}
        {isFirstVisit ? (
          <div
            className="animate-fade-in mt-6 rounded-2xl border border-luz/25 bg-zinc-900/60 px-5 py-5 text-zinc-200"
            style={{ animationDelay: "100ms" }}
          >
            <p>
              LUZ es un espacio para pensar en voz alta, sin que nadie
              juzgue ni presione. Cuanto más hables con ella, mejor te
              va a entender — hoy es el primer día.
            </p>
            <p className="mt-3 text-sm text-zinc-400">
              No hay una forma correcta de empezar. Puedes contarle
              qué tienes en mente ahora mismo.
            </p>
          </div>
        ) : brief?.continuityLine ? (
          <div
            className="animate-fade-in mt-6 rounded-2xl border border-luz/25 bg-zinc-900/60 px-5 py-4 text-zinc-200"
            style={{ animationDelay: "100ms" }}
          >
            {brief.continuityLine}
          </div>
        ) : (
          returningGapDays !== null && (
            <div
              className="animate-fade-in mt-6 rounded-2xl border border-luz/25 bg-zinc-900/60 px-5 py-4 text-zinc-200"
              style={{ animationDelay: "100ms" }}
            >
              {buildReturningLine(returningGapDays)}
            </div>
          )
        )}

        {upcomingDeadlines.length > 0 && (
          <section className="animate-fade-in mt-8" style={{ animationDelay: "160ms" }}>
            <h2 className="text-sm font-medium text-zinc-400">
              Lo que se acerca
            </h2>
            <ul className="mt-3 space-y-2">
              {upcomingDeadlines.map((item, index) => (
                <li
                  key={item.id}
                  className="animate-fade-in rounded-lg border border-zinc-800 px-4 py-3 text-sm"
                  style={{ animationDelay: `${200 + index * 40}ms` }}
                >
                  <span className="text-zinc-300">
                    {item.kind === "goal" ? "Objetivo" : "Proyecto"} &ldquo;
                    {item.title}&rdquo;
                  </span>
                  <span className="text-zinc-500">
                    {" "}
                    — en {daysUntil(item.dueAt)}{" "}
                    {daysUntil(item.dueAt) === 1 ? "día" : "días"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {activeLifeItems.length > 0 && (
          <section className="animate-fade-in mt-8" style={{ animationDelay: "200ms" }}>
            <h2 className="text-sm font-medium text-zinc-400">
              Objetivos activos
            </h2>
            <div className="mt-3 flex flex-wrap gap-3">
              {activeLifeItems.map((item, index) => (
                <div
                  key={item.id}
                  className="animate-fade-in rounded-xl border border-zinc-800 px-4 py-3"
                  style={{ animationDelay: `${240 + index * 40}ms` }}
                >
                  <p className="text-sm text-zinc-200">{item.title}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <Link
          href="/chat"
          className="mt-10 inline-block rounded-full bg-white px-8 py-3 font-medium text-black transition hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
        >
          Hablar con LUZ
        </Link>

        <div>
          <Link
            href="/feedback"
            className="mt-6 inline-block rounded text-sm text-zinc-500 underline decoration-zinc-700 underline-offset-4 transition hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
          >
            ¿Cómo vamos? Cuéntame
          </Link>
        </div>

        <DashboardActivitySummary user={session.user} summary={summary} />
      </div>
    </main>
  );
}
