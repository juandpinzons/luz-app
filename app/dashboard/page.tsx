import { eq, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getLifeGraphContext, getUserContext } from "@/auth/user-context";
import { getLiveCalendarContext } from "@/core/calendar-connections/get-live-calendar-context";
import { db } from "@/core/db/client";
import { conversations } from "@/core/db/schema";
import { getRecentMemoryHighlight } from "@/features/dashboard/services/get-recent-memory-highlight";
import { EventRow } from "@/features/home/components/event-row";
import { truncateText } from "@/features/memories/components/truncate-text";
import {
  buildMorningBrief,
  timeOfDayGreeting,
} from "@/features/dashboard/services/build-morning-brief";
import {
  buildDashboardSummary,
  type DashboardSummary,
} from "@/features/dashboard/services/build-dashboard-summary";
import { buildLifeDashboardSnapshot } from "@/features/dashboard/services/build-life-dashboard-snapshot";
import { buildFollowUpRecommendations } from "@/features/dashboard/services/build-follow-up-recommendations";
import { buildPresenceState } from "@/features/presence/application/build-presence-state";
import { buildHomeState } from "@/features/home/application/build-home-state";
import type { HomeState } from "@/features/home/domain/home-state";
import { buildExperienceState } from "@/features/experience/application/build-experience-state";
import type { ExperienceState } from "@/features/experience/domain/experience-state";
import {
  getPreviousFingerprint,
  getRecentPrimaryKeys,
  recordExperienceCardShown,
} from "@/features/experience/services/experience-signal-log";
import { PrimaryExperienceCard } from "@/features/experience/components/primary-experience-card";
import { SecondaryExperienceList } from "@/features/experience/components/secondary-experience-list";
import { DashboardActivitySummary } from "@/features/dashboard/components/dashboard-activity-summary";
import { describeError } from "@/core/observability/describe-error";
import { createRequestId, logger } from "@/core/observability/logger";
import { ConversationOpeningRitual } from "@/features/chat/components/conversation-opening-ritual";

/**
 * Mismo ritual de apertura que `/chat` (la esfera respira, el trazo se
 * escribe, un pulso del que el contenido emerge) -- el propio componente
 * se documenta como reutilizable para exactamente este caso ("cualquier
 * otra pantalla que quiera el mismo ritual de apertura, sin duplicar
 * esta lógica"). Solo en la primera visita: repetirlo en cada entrada al
 * Dashboard sería justo el tipo de fricción que `PRESENCE_PRINCIPLES.md`
 * pide nunca introducir. Sin `orb`: no hay todavía ninguna señal real
 * (`totalMessageCount` es 0 por definición de `isFirstVisit`) -- usa la
 * misma presencia neutral de siempre en vez de fabricar una.
 */
const FIRST_VISIT_CUE = "Hola";

const ROUTE = "/dashboard";

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
 *
 * Auditoría de Experiencia V1 (hallazgo H5): antes, exactamente dos
 * strings fijos para todo el rango de 3 a 13 días y todo lo que fuera
 * de 14 en adelante -- alguien que vuelve cada pocos días de forma
 * irregular podía ver la frase idéntica dos veces. `daysAway` ya es un
 * número real y específico; usarlo directo (mismos cortes que
 * `describeGap` en `generate-welcome.ts`: días exactos bajo una
 * semana, semanas bajo un mes, "bastante tiempo" después) es más
 * preciso, no una frase nueva por capricho -- y esa precisión es
 * justo lo que hace que cada regreso se sienta distinto en vez de
 * reciclado.
 */
function buildReturningLine(daysAway: number): string {
  if (daysAway < 7) {
    return `Han pasado ${daysAway} días. Qué bueno verte de nuevo.`;
  }
  if (daysAway < 30) {
    const weeks = Math.round(daysAway / 7);
    return `Ha pasado ${weeks === 1 ? "una semana" : `${weeks} semanas`}. Me alegra que hayas vuelto.`;
  }
  return "Ha pasado bastante tiempo. Me alegra que hayas vuelto.";
}

/**
 * Misión "Experience Intelligence V1": el saludo determinístico de
 * Presence (`HomeState.greeting`, vía `buildGreeting`) nunca incluye
 * el nombre de la persona -- Presence no recibe datos de identidad, a
 * propósito (ver `features/presence/README.md`). Home expone las
 * piezas, no redacta prosa combinándolas; combinarlas es
 * responsabilidad de quien arma la pantalla, exactamente lo que hace
 * esta función. Reemplaza el `greetingLine` que antes armaba
 * `buildMorningBrief` con su propio `timeOfDayGreeting` -- misma hora
 * de Bogotá, misma decisión, ahora tomada una sola vez.
 */
function personalizeGreeting(greeting: string, personName: string | null | undefined): string {
  const firstName = personName?.trim().split(/\s+/)[0];
  const base = greeting.replace(/\.$/, "");
  return firstName ? `${base}, ${firstName}.` : `${base}.`;
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
 *
 * Misión "Experience Intelligence V1": esta página ya no arma su
 * propia lectura de Goals/Projects/calendario por separado -- consume
 * el mismo `HomeState` (Presence + Calendar Foundation + Life Graph)
 * que `features/home/` ya sabía componer, y lo arbitra con
 * `buildExperienceState` para decidir UNA sola experiencia primaria en
 * vez de una pila de secciones independientes. Ver
 * `features/experience/README.md`.
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
   * Resumen del Dashboard (Sprint Alpha-1a: Dashboard) — datos reales
   * únicamente, nunca placeholders. Igual que `lifeGraphContext` arriba,
   * si esto falla la página se degrada (secciones ocultas) en vez de
   * romperse — mismo criterio de tolerancia a fallos de todo el archivo.
   * Movido antes de `homeState`/`experience` (adición "¿qué cambió?"):
   * `summary.memoriesStored` alimenta `RealityFingerprint`
   * (`buildExperienceState`), así que tiene que existir para ese
   * momento -- mismo dato, ninguna consulta nueva, solo antes en el
   * orden de este archivo.
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

  /**
   * El mismo `HomeState` que `features/home/` ya sabía componer
   * (Presence + Calendar Foundation + Life Graph) -- antes nunca se
   * conectaba a ninguna pantalla real (ver `features/home/README.md`,
   * `features/dashboard/services/build-life-dashboard-snapshot.ts`:
   * "deliberadamente NO se conecta todavía a ninguna página"). Esta es
   * esa conexión. `calendar` se completa más abajo, una vez que se
   * resuelve la conexión real (`getLiveCalendarContext`) -- se
   * construye primero con `null` para no bloquear el resto del Life
   * Graph a que el calendario responda.
   */
  let homeState: HomeState | null = null;
  if (lifeGraphContext) {
    try {
      const snapshot = await buildLifeDashboardSnapshot(db, lifeGraphContext);
      const recommendations = buildFollowUpRecommendations(snapshot.observations, snapshot);
      const presence = buildPresenceState(snapshot.observations, snapshot, recommendations);
      homeState = buildHomeState(snapshot, snapshot.observations, recommendations, presence, null);
    } catch (error) {
      logger.log({
        event: "dashboard.home_state_failed",
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
   * Antes sin try/catch: si `assembleRealitySnapshot` fallaba (p. ej.
   * una consulta a `core/life` real), tumbaba toda la página en vez de
   * degradarse — el mismo criterio de tolerancia a fallos que ya
   * protege a `lifeGraphContext` y `summary` en este archivo le
   * faltaba justo aquí. Corregido (bug real, encontrado en producción).
   */
  let brief = null;
  if (lifeGraphContext) {
    try {
      brief = await buildMorningBrief(
        db,
        lifeGraphContext,
        session.user.name ?? "",
        isFirstVisit,
      );
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
   * Calendario en vivo (Misión "conéctalo al dashboard principal") --
   * mismo criterio de tolerancia a fallos que el resto de esta página:
   * sin conexión, con error de sync, o con datos reales, la página
   * nunca se rompe por esto. `getLiveCalendarContext`
   * (`core/calendar-connections/`) ya decide sync + estado de la
   * conexión y nunca lanza por un fallo esperado (sync fallido); el
   * `try/catch` de aquí solo cubre un fallo inesperado antes de eso
   * (p. ej. la propia consulta de la conexión guardada).
   */
  let calendarOutcome: Awaited<ReturnType<typeof getLiveCalendarContext>> | null = null;
  if (lifeGraphContext) {
    try {
      calendarOutcome = await getLiveCalendarContext(db, lifeGraphContext.lifeGraphId);
      if (calendarOutcome.status === "error") {
        logger.log({
          event: "dashboard.calendar_sync_failed",
          severity: "error",
          requestId,
          route: ROUTE,
          userId: session.user.id,
          lifeGraphId: lifeGraphContext.lifeGraphId,
          ...describeError(calendarOutcome.error),
        });
      }
    } catch (error) {
      logger.log({
        event: "dashboard.calendar_failed",
        severity: "error",
        requestId,
        route: ROUTE,
        userId: session.user.id,
        lifeGraphId: lifeGraphContext.lifeGraphId,
        ...describeError(error),
      });
    }
  }

  if (homeState && calendarOutcome?.status === "connected") {
    homeState = { ...homeState, calendar: calendarOutcome.calendarContext };
  }

  /**
   * Fases 1-5 de "Experience Intelligence V1" (ver
   * `features/experience/README.md`): de todo lo que `homeState` ya
   * decidió, cuál ES la experiencia de hoy. `getRecentPrimaryKeys`/
   * `getPreviousFingerprint` nunca lanzan por sí solas (selects
   * simples); si fallan, todo el bloque se degrada a "sin experiencia
   * arbitrada hoy" en vez de romper la página, mismo criterio que el
   * resto de este archivo. `recordExperienceCardShown` es tolerante a
   * fallos por dentro (reusa `recordEvent`), así que nunca necesita su
   * propio catch.
   */
  let experience: ExperienceState | null = null;
  if (homeState) {
    try {
      const [recentPrimaryKeys, previousFingerprint] = await Promise.all([
        getRecentPrimaryKeys(db, session.user.id),
        getPreviousFingerprint(db, session.user.id),
      ]);
      experience = buildExperienceState(
        homeState,
        recentPrimaryKeys,
        summary?.memoriesStored ?? 0,
        previousFingerprint,
      );
      if (experience.primary) {
        await recordExperienceCardShown(db, session.user.id, experience.primary, experience.fingerprint);
      }
    } catch (error) {
      logger.log({
        event: "dashboard.experience_state_failed",
        severity: "error",
        requestId,
        route: ROUTE,
        userId: session.user.id,
        lifeGraphId: lifeGraphContext?.lifeGraphId,
        ...describeError(error),
      });
    }
  }

  /**
   * "La memoria interna de LUZ reflejada en la experiencia" -- un
   * teaser real (nunca solo un conteo, eso ya existía en
   * `DashboardActivitySummary` vía `summary.memoriesStored`) de la
   * última memoria activa que LUZ capturó. Mismo criterio de
   * tolerancia a fallos que el resto de esta página.
   */
  let recentMemory: Awaited<ReturnType<typeof getRecentMemoryHighlight>> = null;
  if (lifeGraphContext) {
    try {
      recentMemory = await getRecentMemoryHighlight(db, lifeGraphContext);
    } catch (error) {
      logger.log({
        event: "dashboard.recent_memory_failed",
        severity: "error",
        requestId,
        route: ROUTE,
        userId: session.user.id,
        lifeGraphId: lifeGraphContext.lifeGraphId,
        ...describeError(error),
      });
    }
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

  const pageContent = (
    <>
      {/*
        El saludo es lo primero que LUZ "dice" en cada visita — antes
        tenía el mismo peso tipográfico que cualquier otra línea de
        la página (`text-lg font-light` para saludo y fecha por
        igual). Ahora es la línea más grande de todo el Dashboard;
        la fecha queda deliberadamente más chica y muted, como una
        acotación, no como parte del saludo.
      */}
      <div className="animate-fade-in space-y-1">
        {homeState ? (
          <>
            <p className="text-2xl font-light text-zinc-100">
              {personalizeGreeting(homeState.greeting, session.user.name)}
            </p>
            {brief?.dateLine && <p className="text-sm text-zinc-500">{brief.dateLine}</p>}
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

      {/*
        Misión "Experience Intelligence V1": UNA sola experiencia
        primaria (Fase 1) -- reemplaza las antiguas secciones
        independientes "Lo que se acerca" y "Objetivos activos", que
        mostraban listas completas sin ninguna arbitración real (esta
        misma auditoría encontró que ninguna de las dos usaba todavía
        `HomeState`/`PresenceState`, ver `features/home/README.md`).
        Esa información ahora fluye, ya priorizada, a través de
        `experience.primary`/`.secondary`.
      */}
      {experience?.primary && (
        <PrimaryExperienceCard
          card={experience.primary}
          tone={experience.tone}
          isNew={experience.isNewPrimary}
        />
      )}

      {/*
        "¿Qué cambió desde tu última visita?" -- solo hechos reales
        detectados contra la huella de la visita anterior
        (`detect-what-changed.ts`), nunca novedad fabricada; vacío en
        la primera visita real (no hay "antes" contra qué comparar) y
        en cualquier visita donde de verdad no cambió nada.
      */}
      {experience && experience.whatChanged.length > 0 && (
        <p className="animate-fade-in mt-3 text-xs text-zinc-500" style={{ animationDelay: "140ms" }}>
          {experience.whatChanged.map((change) => change.summary).join(" ")}
        </p>
      )}

      {experience && experience.secondary.length > 0 && (
        <SecondaryExperienceList cards={experience.secondary} />
      )}

      {/*
        Calendario de hoy: información complementaria genuina (no
        cubierta por `experience`, que solo arbitra momentos relativos
        a "ahora" -- ver `features/experience/README.md`), por eso se
        mantiene, pero como apoyo visual a la experiencia primaria,
        nunca compitiendo con ella.
      */}
      {calendarOutcome?.status === "connected" && (
        <section className="animate-fade-in mt-8" style={{ animationDelay: "180ms" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-400">Tu calendario hoy</h2>
            <Link href="/calendar" className="text-xs text-zinc-500 hover:text-zinc-300">
              Ver todo →
            </Link>
          </div>
          {calendarOutcome.calendarContext.today.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-600">Nada agendado hoy.</p>
          ) : (
            <>
              <ul className="mt-3 space-y-2">
                {calendarOutcome.calendarContext.today.slice(0, 3).map((event) => (
                  <EventRow key={event.id} event={event} />
                ))}
              </ul>
              {calendarOutcome.calendarContext.today.length > 3 && (
                <Link href="/calendar" className="mt-2 inline-block text-xs text-zinc-500 hover:text-zinc-300">
                  +{calendarOutcome.calendarContext.today.length - 3} más
                </Link>
              )}
            </>
          )}
        </section>
      )}

      {calendarOutcome?.status === "not_connected" && (
        <p className="animate-fade-in mt-8 text-sm text-zinc-500" style={{ animationDelay: "180ms" }}>
          <Link
            href="/calendar/connect"
            className="underline decoration-zinc-700 underline-offset-4 transition hover:text-zinc-300"
          >
            Conecta tu calendario
          </Link>{" "}
          para ver qué tienes ocupado y libre.
        </p>
      )}

      {recentMemory && (
        <p className="animate-fade-in mt-8 text-sm text-zinc-500" style={{ animationDelay: "190ms" }}>
          Lo último que recuerdo: &ldquo;{truncateText(recentMemory.content, 140)}&rdquo;{" "}
          <Link
            href="/memories"
            className="underline decoration-zinc-700 underline-offset-4 transition hover:text-zinc-300"
          >
            Ver más
          </Link>
        </p>
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

      <DashboardActivitySummary
        user={session.user}
        summary={summary}
        hasUpcomingDeadline={(homeState?.upcoming.length ?? 0) > 0}
      />
    </>
  );

  return (
    <main className="flex min-h-full flex-col items-center px-6 py-16 text-white">
      {isFirstVisit ? (
        <ConversationOpeningRitual cue={FIRST_VISIT_CUE} contentClassName="w-full max-w-xl">
          {pageContent}
        </ConversationOpeningRitual>
      ) : (
        <div className="w-full max-w-xl">{pageContent}</div>
      )}
    </main>
  );
}
