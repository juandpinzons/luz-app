import { eq, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { auth } from "@/auth";
import { getLifeGraphContext, getUserContext } from "@/auth/user-context";
import { getLiveCalendarContext } from "@/features/home/services/get-live-calendar-context";
import { getLiveEmailContext } from "@/features/reality/get-live-email-context";
import { getLiveYoutubeContext } from "@/features/reality/get-live-youtube-context";
import { DrizzleContinuityLoopRepository } from "@/core/continuity-engine";
import { db } from "@/core/db/client";
import { conversations } from "@/core/db/schema";
import { EventRow } from "@/features/home/components/event-row";
import { EmailRow } from "@/features/home/components/email-row";
import { YoutubeVideoRow } from "@/features/home/components/youtube-video-row";
import {
  buildMorningBrief,
  timeOfDayGreeting,
} from "@/features/dashboard/services/build-morning-brief";
import {
  buildDashboardSummary,
  type DashboardSummary,
} from "@/features/dashboard/services/build-dashboard-summary";
import { buildLifeDashboardSnapshot } from "@/features/dashboard/services/build-life-dashboard-snapshot";
import type { LifeDashboardSnapshot } from "@/features/dashboard/services/build-life-dashboard-snapshot";
import { buildFollowUpRecommendations } from "@/features/dashboard/services/build-follow-up-recommendations";
import type { FollowUpRecommendation } from "@/features/dashboard/services/build-follow-up-recommendations";
import { buildPresenceState } from "@/features/presence/application/build-presence-state";
import type { PresenceState } from "@/features/presence/domain/presence-state";
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
import { DeleteAccountButton } from "@/components/delete-account-button";
import { selectEditorialPhrase } from "@/features/dashboard/services/select-editorial-phrase";
import { describeError } from "@/core/observability/describe-error";
import { createRequestId, logger } from "@/core/observability/logger";
import { logTraceSummary, runTrace, span } from "@/core/observability/trace";
import { ConversationOpeningRitual } from "@/features/chat/components/conversation-opening-ritual";
import { assembleIdentityEvolution } from "@/features/identity-evolution";
import { buildNarrativeState } from "@/features/narrative";
import { deriveMood, type AvatarMoodSignal } from "@/features/avatar";
import { PresenceAvatar } from "@/features/avatar/components/presence-avatar";

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
  // app/api/chat/route.ts) -- y para atribuir cada span real de esta
  // carga a la misma traza (`runTrace`, misión "complete latency
  // profile").
  const requestId = createRequestId();
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
   *
   * Misión "complete latency profile": toda esta carga corre dentro de
   * `runTrace` -- cada `load*` de abajo se envuelve en `span()` con el
   * nombre del subsistema real que mide (Reality/Memory/Knowledge/
   * Identity Evolution ya se miden dentro de `assembleRealitySnapshot`,
   * anidados bajo "Morning Brief" -> "Reality"). Medición pura: ningún
   * `span()` cambia qué hace el código que envuelve.
   */
  interface HomeStateBaseResult {
    readonly homeState: HomeState;
    /** Cruda, previa al passthrough aplanado de `HomeState` -- `deriveMood` (Avatar V1) la necesita tal cual, nunca reconstruida desde `HomeState`. */
    readonly presence: PresenceState;
    /** Solo `overdue` la necesita `buildNarrativeState`, ver su propio docblock. */
    readonly snapshot: LifeDashboardSnapshot;
    /** Lista completa, sin recortar -- distinta de `homeState.attentionNeeded` (Presence ya la acotó a 2-3). */
    readonly recommendations: FollowUpRecommendation[];
  }

  async function loadDashboardData(): Promise<{
    summary: DashboardSummary | null;
    homeState: HomeState | null;
    experience: ExperienceState | null;
    avatarMood: AvatarMoodSignal | null;
    brief: Awaited<ReturnType<typeof buildMorningBrief>> | null;
    calendarOutcome: Awaited<ReturnType<typeof getLiveCalendarContext>> | null;
    emailOutcome: Awaited<ReturnType<typeof getLiveEmailContext>> | null;
    youtubeOutcome: Awaited<ReturnType<typeof getLiveYoutubeContext>> | null;
    editorialPhrase: string | null;
    isFirstVisit: boolean;
  }> {
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
  async function loadHomeStateBase(): Promise<HomeStateBaseResult | null> {
    if (!lifeGraphContext) return null;
    try {
      const snapshot = await span("Life Dashboard Snapshot", "engine", () =>
        buildLifeDashboardSnapshot(db, lifeGraphContext),
      );
      const recommendations = await span("Recommendations", "compute", async () =>
        buildFollowUpRecommendations(snapshot.observations, snapshot),
      );
      const presence = await span("Presence", "compute", async () =>
        buildPresenceState(snapshot.observations, snapshot, recommendations),
      );
      const homeState = await span("Home", "compute", async () =>
        buildHomeState(snapshot, snapshot.observations, recommendations, presence, null),
      );
      return { homeState, presence, snapshot, recommendations };
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
   * War Room 2026-08-09 -- biblioteca editorial, primer consumidor
   * real (`select-editorial-phrase.ts`). Solo se usa cuando ninguna de
   * las otras tres ramas del saludo aplica (ver más abajo,
   * `returningGapDays === null`); esa condición se evalúa después de
   * este `Promise.all`, así que esta carga corre siempre en paralelo
   * con las demás y simplemente no se usa si no hace falta -- mismo
   * costo que cualquier otra rama de este bloque, nunca una consulta
   * extra condicional.
   */
  async function loadEditorialPhrase(): Promise<string | null> {
    if (!lifeGraphContext) return null;
    return selectEditorialPhrase(db, lifeGraphContext);
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
   * Correo en vivo -- mismo criterio exacto que `loadCalendarOutcome`
   * (misma tolerancia a fallos, mismo `try/catch` para lo inesperado
   * antes de `getLiveEmailContext`). Se une a este mismo `Promise.all`
   * en vez de quedarse detrás de un enlace estático (ver el commit que
   * conectó Gmail): "conéctalo al dashboard principal" para Gmail,
   * mismo paso que Calendar ya dio.
   */
  async function loadEmailOutcome(): Promise<Awaited<ReturnType<typeof getLiveEmailContext>> | null> {
    if (!lifeGraphContext) return null;
    try {
      const outcome = await getLiveEmailContext(db, lifeGraphContext.lifeGraphId);
      if (outcome.status === "error") {
        logger.log({
          event: "dashboard.gmail_sync_failed",
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
        event: "dashboard.gmail_failed",
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

  /** YouTube en vivo -- mismo criterio exacto que `loadEmailOutcome`. */
  async function loadYoutubeOutcome(): Promise<Awaited<ReturnType<typeof getLiveYoutubeContext>> | null> {
    if (!lifeGraphContext) return null;
    try {
      const outcome = await getLiveYoutubeContext(db, lifeGraphContext.lifeGraphId);
      if (outcome.status === "error") {
        logger.log({
          event: "dashboard.youtube_sync_failed",
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
        event: "dashboard.youtube_failed",
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

  // Las ocho solo necesitan `lifeGraphContext`/`userId`, ya resueltos
  // arriba -- ninguna depende del resultado de otra, así que corren
  // todas a la vez. `recentPrimaryKeys`/`previousFingerprint` son los
  // dos `select` simples que antes solo se pedían DESPUÉS de tener
  // `homeState` en mano, aunque nunca lo necesitaron a él tampoco.
  const [
    summary,
    homeStateBaseResult,
    brief,
    calendarOutcome,
    emailOutcome,
    youtubeOutcome,
    recentPrimaryKeys,
    previousFingerprint,
    editorialPhrase,
  ] = await Promise.all([
    span("Dashboard Summary", "orchestration", loadSummary),
    span("Home State", "orchestration", loadHomeStateBase),
    span("Morning Brief", "orchestration", loadMorningBrief),
    span("Calendar", "external_api", loadCalendarOutcome),
    span("Gmail", "external_api", loadEmailOutcome),
    span("YouTube", "external_api", loadYoutubeOutcome),
    span("Experience.recentPrimaryKeys", "repository", () => getRecentPrimaryKeys(db, userId)),
    span("Experience.previousFingerprint", "repository", () => getPreviousFingerprint(db, userId)),
    span("Editorial Phrase", "repository", loadEditorialPhrase),
  ]);

  let homeState = homeStateBaseResult?.homeState ?? null;
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
  /**
   * Avatar V1 (Presence Avatar UI, `features/avatar/`) -- el `mood` de
   * fondo que alimenta `<PresenceAvatar>` en esta página. Narrative
   * necesita `experience` ya resuelto (`experienceState`), así que
   * Narrative/Identity no pueden unirse al primer `Promise.all` de
   * arriba -- pero tampoco dependen entre sí ni de `experience`, así
   * que arrancan en paralelo con el cómputo de Experience (mismo
   * criterio de "correr lo independiente en paralelo" que ya aplica el
   * resto de este archivo), nunca en secuencia detrás de él.
   */
  let avatarMood: AvatarMoodSignal | null = null;
  if (homeState && homeStateBaseResult) {
    const capturedHomeState = homeState;
    const capturedBase = homeStateBaseResult;

    const avatarInputsPromise = Promise.all([
      span("Continuity", "repository", () => new DrizzleContinuityLoopRepository(db).list(lifeGraphContext!)),
      span("Identity Evolution", "engine", () => assembleIdentityEvolution(db, lifeGraphContext!)),
    ]).catch((error: unknown) => {
      logger.log({
        event: "dashboard.avatar_inputs_failed",
        severity: "error",
        requestId,
        route: ROUTE,
        userId,
        lifeGraphId: lifeGraphContext?.lifeGraphId,
        ...describeError(error),
      });
      return null;
    });

    try {
      experience = await span("Experience", "compute", async () =>
        buildExperienceState(
          capturedHomeState,
          recentPrimaryKeys,
          summary?.memoriesStored ?? 0,
          previousFingerprint,
        ),
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

    const avatarInputs = await avatarInputsPromise;
    if (experience && avatarInputs) {
      const [loops, identitySnapshot] = avatarInputs;
      try {
        const narrativeState = buildNarrativeState({
          homeState: capturedHomeState,
          experienceState: experience,
          loops,
          recommendations: capturedBase.recommendations,
          lifeDashboardSnapshot: capturedBase.snapshot,
          // `getLiveCalendarContext` solo expone el `CalendarSnapshot`
          // crudo internamente (lo traduce a `HomeCalendarContext` antes
          // de devolverlo) -- mismo `calendar: null` que ya usa el único
          // otro llamador real de Narrative (`assembleReconnectionContext.ts`),
          // nunca tocar `core/calendar-connections` solo para exponerlo.
          calendar: null,
          email: null,
          recentlyNarratedThreadIds: [],
        });
        avatarMood = deriveMood({
          presence: capturedBase.presence,
          experience,
          narrative: narrativeState,
          identity: identitySnapshot,
        });
      } catch (error) {
        logger.log({
          event: "dashboard.avatar_mood_failed",
          severity: "error",
          requestId,
          route: ROUTE,
          userId,
          lifeGraphId: lifeGraphContext?.lifeGraphId,
          ...describeError(error),
        });
      }
    }
  }

    return {
      summary,
      homeState,
      experience,
      avatarMood,
      brief,
      calendarOutcome,
      emailOutcome,
      youtubeOutcome,
      editorialPhrase,
      isFirstVisit,
    };
  }

  const { result: dashboardData, summary: trace } = await runTrace(
    requestId,
    "dashboard.request",
    loadDashboardData,
  );
  logTraceSummary(trace, { route: ROUTE, userId });
  const {
    summary,
    homeState,
    experience,
    avatarMood,
    brief,
    calendarOutcome,
    emailOutcome,
    youtubeOutcome,
    editorialPhrase,
    isFirstVisit,
  } = dashboardData;

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
      <div className="animate-fade-in flex items-center gap-4">
        {avatarMood && <PresenceAvatar mood={avatarMood} size="lg" className="flex-shrink-0" />}
        <div className="space-y-1">
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
      ) : returningGapDays !== null ? (
        <div
          className="animate-fade-in mt-6 rounded-2xl border border-luz/25 bg-zinc-900/60 px-5 py-4 text-zinc-200"
          style={{ animationDelay: "100ms" }}
        >
          {buildReturningLine(returningGapDays)}
        </div>
      ) : (
        /*
          War Room 2026-08-09 -- biblioteca editorial, primer
          consumidor real. Este es el único caso que antes no decía
          nada: no primera visita, sin línea de continuidad de IA, y
          sin pausa real que reconocer (`returningGapDays === null` --
          alguien que vuelve dentro de RETURNING_GAP_DAYS, el caso más
          común para quien usa LUZ con regularidad). `editorialPhrase`
          ya viene resuelto (o `null`, degradación silenciosa) del
          `Promise.all` de arriba -- ninguna consulta nueva acá.
        */
        editorialPhrase && (
          <div
            className="animate-fade-in mt-6 rounded-2xl border border-luz/25 bg-zinc-900/60 px-5 py-4 text-zinc-200"
            style={{ animationDelay: "100ms" }}
          >
            {editorialPhrase}
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
        Beta-critical polish (feedback directo de Juan, 2026-08-03):
        "quiero que Luz mejore la parte de 'hoy' que en 5-10 segundos se
        vea lo más importante... que no salga un reguero de información".
        `PostponedExperienceNote` (cosas que la propia arbitración
        decidió NO liderar hoy) se retira de Hoy por completo -- mostrar
        lo pospuesto contradice el punto de posponerlo (Principio 4,
        Silencio intencional). El calendario baja de "hasta 3 eventos +
        N más" a un solo evento, lo único que cabe en la misma lectura
        de 5-10 segundos que el resto de la pantalla; el resto vive en
        `/calendar`, que ya existe. El teaser de memoria reciente se
        retira -- duplicaba lo que `/memories` ya hace mejor, y ya no
        hace falta un segundo camino ahora que `/chat` tiene "Historial".
      */}
      {calendarOutcome?.status === "connected" &&
        calendarOutcome.calendarContext.today.length > 0 && (
          <section className="animate-fade-in mt-8" style={{ animationDelay: "180ms" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-zinc-400">Tu calendario hoy</h2>
              <Link href="/calendar" className="text-xs text-zinc-500 hover:text-zinc-300">
                Ver todo →
              </Link>
            </div>
            <ul className="mt-3 space-y-2">
              <EventRow event={calendarOutcome.calendarContext.today[0]} />
            </ul>
            {calendarOutcome.calendarContext.today.length > 1 && (
              <Link href="/calendar" className="mt-2 inline-block text-xs text-zinc-500 hover:text-zinc-300">
                +{calendarOutcome.calendarContext.today.length - 1} más
              </Link>
            )}
          </section>
        )}

      {/*
        "Esperando tu respuesta" -- la señal `waiting_reply` es la única
        de las cinco de `EmailSnapshot` que pide una acción real (a
        diferencia de "nuevo"/"no leído", que son solo estado). Mismo
        criterio de "cero fabricación" que la biblioteca editorial
        (`PRESENCE_PRINCIPLES.md` #9, ver P2-6 en el backlog): sin nada
        esperando respuesta, esta sección simplemente no se muestra --
        nunca un "bandeja al día" inventado para llenar el espacio.
      */}
      {emailOutcome?.status === "connected" && emailOutcome.snapshot.waitingReply.length > 0 && (
        <section className="animate-fade-in mt-8" style={{ animationDelay: "190ms" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-400">Esperando tu respuesta</h2>
            <Link href="/gmail" className="text-xs text-zinc-500 hover:text-zinc-300">
              Ver todo →
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            <EmailRow message={emailOutcome.snapshot.waitingReply[0]} />
          </ul>
          {emailOutcome.snapshot.waitingReply.length > 1 && (
            <Link href="/gmail" className="mt-2 inline-block text-xs text-zinc-500 hover:text-zinc-300">
              +{emailOutcome.snapshot.waitingReply.length - 1} más
            </Link>
          )}
        </section>
      )}

      {/*
        YouTube (misión "integrar YouTube", 2026-08-17) -- mismo
        criterio de "cero fabricación" que "Esperando tu respuesta":
        sin ningún video con like todavía, esta sección simplemente no
        se muestra. Un solo video (el más reciente), mismo patrón que
        el resto de los teasers de Hoy -- el resto vive en `/youtube`.
      */}
      {youtubeOutcome?.status === "connected" && youtubeOutcome.snapshot.likedVideos.length > 0 && (
        <section className="animate-fade-in mt-8" style={{ animationDelay: "195ms" }}>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-400">Te gustó</h2>
            <Link href="/youtube" className="text-xs text-zinc-500 hover:text-zinc-300">
              Ver todo →
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            <YoutubeVideoRow video={youtubeOutcome.snapshot.likedVideos[0]} />
          </ul>
          {youtubeOutcome.snapshot.likedVideos.length > 1 && (
            <Link href="/youtube" className="mt-2 inline-block text-xs text-zinc-500 hover:text-zinc-300">
              +{youtubeOutcome.snapshot.likedVideos.length - 1} más
            </Link>
          )}
        </section>
      )}

      {/*
        Auditoría de interfaz (2026-08-15): antes, cada fuente sin
        conectar tenía su propio párrafo suelto ("Conecta tu
        calendario", "Conecta tu Gmail", "Tu acceso a Gmail expiró")
        -- densidad creciendo en Hoy con cada fuente nueva que se
        agregara. Un solo enlace a `/connections` (que ya lista las
        tres con su estado real) cubre cualquier combinación sin sumar
        un párrafo por fuente.

        Ampliación 2026-08-17 (pedido directo del Founder): antes este
        enlace solo aparecía si algo estaba sin conectar -- con todo
        conectado, desaparecía por completo y "/connections" se volvía
        invisible desde Hoy. Ahora siempre está, mismo texto discreto
        de siempre (nunca compite con el saludo ni con la experiencia
        primaria) -- `/connections` ahora también muestra la visión de
        producto ("Próximamente"), no solo el estado de lo ya
        conectado, así que vale la pena que siempre se pueda llegar.
      */}
      <p className="animate-fade-in mt-8 text-sm text-zinc-500" style={{ animationDelay: "190ms" }}>
        <Link href="/connections" className="underline decoration-zinc-700 underline-offset-4 transition hover:text-zinc-300">
          Conexiones
        </Link>{" "}
        — qué apps y fuentes puede ver LUZ, además de lo que le cuentas.
      </p>

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

      {/*
        Política de datos (`docs/legal/PRIVACY_POLICY_WORKING_DRAFT_V1.md`,
        §15): el mecanismo real de borrado (`DeleteAccountButton`,
        `/api/account/delete`) ya existía -- transaccional, en cascada,
        con confirmación en dos pasos -- pero no estaba montado en
        ninguna pantalla. Al final de Hoy, nunca arriba ni compitiendo
        con el saludo: es la acción menos frecuente y más irreversible
        de toda la app, coherente con dónde ya vive "¿Cómo vamos?".
      */}
      <div className="mt-10 border-t border-zinc-900 pt-4">
        <p className="text-xs text-zinc-600">
          Puedes eliminar tu cuenta y todos tus datos (conversaciones, memorias, creencias, conexiones) en cualquier
          momento -- es permanente, sin forma de deshacerlo.
        </p>
        <div className="mt-2">
          <DeleteAccountButton />
        </div>
      </div>
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
