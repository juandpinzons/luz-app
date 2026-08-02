import { eq, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
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
import { PostponedExperienceNote } from "@/features/experience/components/postponed-experience-note";
import { DashboardActivitySummary } from "@/features/dashboard/components/dashboard-activity-summary";
import { describeError } from "@/core/observability/describe-error";
import { createRequestId, elapsedMs, logger, nowMs } from "@/core/observability/logger";
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
  // app/api/chat/route.ts). `renderStartedAt` alimenta el log de
  // duración al final -- ver "Latencia" más abajo.
  const requestId = createRequestId();
  const renderStartedAt = nowMs();
  // Capturado una sola vez, fuera de cualquier cierre -- evita
  // cualquier duda sobre si el angostamiento de tipos de TypeScript
  // (`session.user.id` ya no puede ser `undefined` tras el `redirect`
  // de arriba) sigue vigente dentro de las funciones anidadas de abajo.
  const userId = session.user.id;
  const userName = session.user.name;

  /**
   * LATENCIA (misión "que LUZ sea más rápida"): antes, cada una de las
   * piezas de abajo (resumen, Life Graph completo, línea de
   * continuidad generada por IA, sincronización real de Google
   * Calendar, memoria reciente) se esperaba una detrás de otra con
   * `await` secuenciales, aunque NINGUNA depende del resultado de
   * ninguna otra -- todas solo necesitan `lifeGraphContext`/`userId`,
   * ya resueltos. Encadenadas así, el tiempo total era la SUMA de las
   * cinco (la llamada real a IA de `buildMorningBrief` y la
   * sincronización real con Google Calendar de `getLiveCalendarContext`
   * son, con diferencia, las dos más lentas) -- el origen real de "la
   * transición a 'hoy' toma varios segundos". Correrlas en paralelo
   * (`Promise.all`) hace que el tiempo total sea el MÁXIMO de las
   * cinco, no la suma -- sin cambiar ni una regla de negocio, ni un
   * mensaje de error, ni el criterio de tolerancia a fallos de cada
   * una (cada función interna conserva su propio `try/catch` y su
   * propio evento de log, exactamente como antes).
   */

  async function loadConversationCount(): Promise<number> {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(conversations)
      .where(eq(conversations.userId, userId));
    return row.n;
  }

  async function loadLifeGraphContext() {
    try {
      return await getLifeGraphContext();
    } catch (error) {
      logger.log({
        event: "dashboard.life_graph_context_failed",
        severity: "error",
        requestId,
        route: ROUTE,
        userId,
        ...describeError(error),
      });
      return null;
    }
  }

  // Independientes entre sí -- ninguna necesita el resultado de la
  // otra, ambas solo necesitan `userId` (ya resuelto por `auth()`).
  const [conversationCount, lifeGraphContext] = await Promise.all([
    loadConversationCount(),
    loadLifeGraphContext(),
  ]);

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
  const isFirstVisit = conversationCount === 0;

  /**
   * Resumen del Dashboard (Sprint Alpha-1a: Dashboard) — datos reales
   * únicamente, nunca placeholders. Igual que `lifeGraphContext` arriba,
   * si esto falla la página se degrada (secciones ocultas) en vez de
   * romperse — mismo criterio de tolerancia a fallos de todo el archivo.
   */
  async function loadSummary(): Promise<DashboardSummary | null> {
    try {
      const userContext = await getUserContext();
      if (!userContext) return null;
      return await buildDashboardSummary(db, userContext, lifeGraphContext);
    } catch (error) {
      logger.log({
        event: "dashboard.summary_failed",
        severity: "error",
        requestId,
        route: ROUTE,
        userId,
        ...describeError(error),
      });
      return null;
    }
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
  async function loadHomeStateBase(): Promise<HomeState | null> {
    if (!lifeGraphContext) return null;
    try {
      const snapshot = await buildLifeDashboardSnapshot(db, lifeGraphContext);
      const recommendations = buildFollowUpRecommendations(snapshot.observations, snapshot);
      const presence = buildPresenceState(snapshot.observations, snapshot, recommendations);
      return buildHomeState(snapshot, snapshot.observations, recommendations, presence, null);
    } catch (error) {
      logger.log({
        event: "dashboard.home_state_failed",
        severity: "error",
        requestId,
        route: ROUTE,
        userId,
        lifeGraphId: lifeGraphContext.lifeGraphId,
        ...describeError(error),
      });
      return null;
    }
  }

  /**
   * Antes sin try/catch: si `assembleRealitySnapshot` fallaba (p. ej.
   * una consulta a `core/life` real), tumbaba toda la página en vez de
   * degradarse — el mismo criterio de tolerancia a fallos que ya
   * protege a `lifeGraphContext` y `summary` en este archivo le
   * faltaba justo aquí. Corregido (bug real, encontrado en producción).
   */
  async function loadMorningBrief() {
    if (!lifeGraphContext) return null;
    try {
      return await buildMorningBrief(db, lifeGraphContext, userName ?? "", isFirstVisit);
    } catch (error) {
      logger.log({
        event: "dashboard.morning_brief_failed",
        severity: "error",
        requestId,
        route: ROUTE,
        userId,
        lifeGraphId: lifeGraphContext.lifeGraphId,
        ...describeError(error),
      });
      return null;
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
  async function loadCalendarOutcome(): Promise<Awaited<ReturnType<typeof getLiveCalendarContext>> | null> {
    if (!lifeGraphContext) return null;
    try {
      const outcome = await getLiveCalendarContext(db, lifeGraphContext.lifeGraphId);
      if (outcome.status === "error") {
        logger.log({
          event: "dashboard.calendar_sync_failed",
          severity: "error",
          requestId,
          route: ROUTE,
          userId,
          lifeGraphId: lifeGraphContext.lifeGraphId,
          ...describeError(outcome.error),
        });
      }
      return outcome;
    } catch (error) {
      logger.log({
        event: "dashboard.calendar_failed",
        severity: "error",
        requestId,
        route: ROUTE,
        userId,
        lifeGraphId: lifeGraphContext.lifeGraphId,
        ...describeError(error),
      });
      return null;
    }
  }

  /**
   * "La memoria interna de LUZ reflejada en la experiencia" -- un
   * teaser real (nunca solo un conteo, eso ya existía en
   * `DashboardActivitySummary` vía `summary.memoriesStored`) de la
   * última memoria activa que LUZ capturó. Mismo criterio de
   * tolerancia a fallos que el resto de esta página.
   */
  async function loadRecentMemory(): Promise<Awaited<ReturnType<typeof getRecentMemoryHighlight>>> {
    if (!lifeGraphContext) return null;
    try {
      return await getRecentMemoryHighlight(db, lifeGraphContext);
    } catch (error) {
      logger.log({
        event: "dashboard.recent_memory_failed",
        severity: "error",
        requestId,
        route: ROUTE,
        userId,
        lifeGraphId: lifeGraphContext.lifeGraphId,
        ...describeError(error),
      });
      return null;
    }
  }

  // Las siete solo necesitan `lifeGraphContext`/`userId`, ya resueltos
  // arriba -- ninguna depende del resultado de otra, así que corren
  // todas a la vez. `recentPrimaryKeys`/`previousFingerprint` son los
  // dos `select` simples que antes solo se pedían DESPUÉS de tener
  // `homeState` en mano, aunque nunca lo necesitaron a él tampoco.
  const [summary, homeStateBase, brief, calendarOutcome, recentMemory, recentPrimaryKeys, previousFingerprint] =
    await Promise.all([
      loadSummary(),
      loadHomeStateBase(),
      loadMorningBrief(),
      loadCalendarOutcome(),
      loadRecentMemory(),
      getRecentPrimaryKeys(db, userId),
      getPreviousFingerprint(db, userId),
    ]);

  let homeState = homeStateBase;
  if (homeState && calendarOutcome?.status === "connected") {
    homeState = { ...homeState, calendar: calendarOutcome.calendarContext };
  }

  /**
   * Fases 1-5 de "Experience Intelligence V1" (ver
   * `features/experience/README.md`): de todo lo que `homeState` ya
   * decidió, cuál ES la experiencia de hoy. Esta fase sí depende de
   * `homeState` YA parcheado con el calendario, así que no puede unirse
   * al `Promise.all` de arriba -- pero ya no espera ninguna consulta
   * propia (`recentPrimaryKeys`/`previousFingerprint` ya están
   * resueltos). `recordExperienceCardShown` es una escritura de
   * analítica (qué tarjeta se mostró, para la rotación futura) que la
   * persona no necesita esperar para ver la página -- programada con
   * `after()` (mismo patrón ya establecido en `app/api/chat/route.ts`),
   * corre después de que la respuesta ya salió, nunca antes.
   */
  let experience: ExperienceState | null = null;
  if (homeState) {
    try {
      experience = buildExperienceState(
        homeState,
        recentPrimaryKeys,
        summary?.memoriesStored ?? 0,
        previousFingerprint,
      );
      if (experience.primary) {
        const primaryCard = experience.primary;
        const fingerprint = experience.fingerprint;
        after(() => recordExperienceCardShown(db, userId, primaryCard, fingerprint));
      }
    } catch (error) {
      logger.log({
        event: "dashboard.experience_state_failed",
        severity: "error",
        requestId,
        route: ROUTE,
        userId,
        lifeGraphId: lifeGraphContext?.lifeGraphId,
        ...describeError(error),
      });
    }
  }

  logger.log({
    event: "dashboard.render_completed",
    severity: "info",
    requestId,
    route: ROUTE,
    userId,
    durationMs: elapsedMs(renderStartedAt),
  });

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

      {experience && experience.postponed.length > 0 && (
        <PostponedExperienceNote cards={experience.postponed} />
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
