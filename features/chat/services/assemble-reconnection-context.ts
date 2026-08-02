import { and, count, eq, max } from "drizzle-orm";
import type { Database } from "../../../core/db/client";
import { conversationMessages, memories } from "../../../core/db/schema";
import type { LifeGraphContext } from "../../../core/life/life-graph-context";
import { DrizzleContinuityLoopRepository } from "../../../core/continuity-engine";
import { span } from "../../../core/observability/trace";
import { buildLifeDashboardSnapshot } from "../../dashboard/services/build-life-dashboard-snapshot";
import { buildFollowUpRecommendations } from "../../dashboard/services/build-follow-up-recommendations";
import { buildPresenceState } from "../../presence/application/build-presence-state";
import { buildHomeState } from "../../home/application/build-home-state";
import { buildExperienceState } from "../../experience/application/build-experience-state";
import type { RealityChange } from "../../experience/domain/experience-state";
import { getPreviousFingerprint, getRecentPrimaryKeys } from "../../experience/services/experience-signal-log";
import {
  buildNarrativeState,
  toConversationContext,
  NARRATIVE_PROGRESSION_LABELS,
  type NarrativeContinuation,
} from "../../narrative";

/**
 * A partir de cuántas horas sin hablar se considera un vacío real --
 * por debajo de esto, reabrir la app dos veces en la misma tarde no
 * debería sentirse como "mira todo lo que cambió". Punto de partida
 * razonable, explícitamente ajustable (mismo espíritu que el resto de
 * las constantes de este redesign).
 */
const MEANINGFUL_GAP_HOURS = 8;

export interface ReconnectionActiveThread {
  readonly title: string;
  readonly summary: string;
  readonly chapterLabel: string;
}

export interface ReconnectionContext {
  readonly changes: readonly RealityChange[];
  readonly activeThread: ReconnectionActiveThread | null;
  readonly isReturningAfterSetback: boolean;
  readonly hasEcho: boolean;
  readonly continuation: NarrativeContinuation | null;
}

async function countMemories(db: Database, context: LifeGraphContext): Promise<number> {
  const [row] = await db
    .select({ value: count() })
    .from(memories)
    .where(eq(memories.lifeGraphId, context.lifeGraphId));
  return row?.value ?? 0;
}

/**
 * "Qué cambió" + "qué capítulo vive" (redesign del pipeline
 * conversacional, Beta) -- ya no una aproximación propia: construye el
 * mismo `NarrativeState` real que "Living Narrative Foundation"
 * (`features/narrative`) calcula para Dashboard/Presence, sobre el
 * mismo `HomeState`/`ExperienceState`/`ContinuityLoop[]` que
 * `app/dashboard/page.tsx` ya ensambla -- nunca una segunda
 * interpretación más simple en paralelo (el capítulo de una historia,
 * la recuperación tras un revés, el eco temporal, ya los resuelve
 * Narrative; reconstruirlos aquí sería exactamente la "lógica
 * duplicada" que este redesign existe para evitar).
 *
 * Único punto real de "cross-slice" en `features/chat/` -- este
 * archivo ya era la capa que traduce motores/módulos reales a lo que
 * la conversación necesita (mismo rol que cumple para
 * `core/belief-engine`/`core/knowledge-engine` en
 * `assemble-reality-snapshot.ts`), así que es la frontera correcta
 * para cruzar hacia `features/home`/`features/experience`/
 * `features/presence`/`features/dashboard`/`features/narrative`/
 * `core/continuity-engine`, no una excepción improvisada.
 *
 * Deliberadamente caro comparado con el resto del turno -- por eso
 * sigue gateado detrás de `isFirstContact` + un vacío real (mismo
 * costo de asemblar que ya paga cada carga del Dashboard, pagado solo
 * en el momento de la conversación donde de verdad importa).
 */
export async function assembleReconnectionContext(
  db: Database,
  context: LifeGraphContext,
  userId: string,
  isFirstContact: boolean,
): Promise<ReconnectionContext | null> {
  if (!isFirstContact) {
    return null;
  }

  const [row] = await db
    .select({ lastAssistantMessageAt: max(conversationMessages.createdAt) })
    .from(conversationMessages)
    .where(
      and(eq(conversationMessages.userId, userId), eq(conversationMessages.role, "assistant")),
    );

  const lastAssistantMessageAt = row?.lastAssistantMessageAt ?? null;
  if (!lastAssistantMessageAt) {
    // Nunca respondió antes -- primer contacto real, no una
    // reapertura. `ReopenStrategyRule`/`ListenStrategyRule` ya cubren
    // ese momento; esta regla no tiene nada real que decir todavía.
    return null;
  }

  const gapHours = (Date.now() - lastAssistantMessageAt.getTime()) / (1000 * 60 * 60);
  if (gapHours < MEANINGFUL_GAP_HOURS) {
    return null;
  }

  const snapshot = await span("Life Dashboard Snapshot", "engine", () =>
    buildLifeDashboardSnapshot(db, context),
  );
  const recommendations = buildFollowUpRecommendations(snapshot.observations, snapshot);
  const presence = buildPresenceState(snapshot.observations, snapshot, recommendations);
  // Sin calendario/correo en vivo aquí -- Narrative solo usa `overdue`
  // de `lifeDashboardSnapshot` para lo que este momento necesita
  // (ver README de `features/narrative`); sincronizar Apple Calendar
  // en vivo dentro del turno de chat sería un costo/riesgo de fallo
  // nuevo sin beneficio real para esta decisión puntual.
  const homeState = buildHomeState(snapshot, snapshot.observations, recommendations, presence, null);

  const [recentPrimaryKeys, previousFingerprint, loops, memoriesStored] = await Promise.all([
    span("Experience.recentPrimaryKeys", "repository", () => getRecentPrimaryKeys(db, userId)),
    span("Experience.previousFingerprint", "repository", () => getPreviousFingerprint(db, userId)),
    span("Continuity", "repository", () => new DrizzleContinuityLoopRepository(db).list(context)),
    span("Reconnection.countMemories", "repository", () => countMemories(db, context)),
  ]);

  const experienceState = buildExperienceState(
    homeState,
    recentPrimaryKeys,
    memoriesStored,
    previousFingerprint,
  );

  const narrativeState = await span("Narrative", "engine", async () =>
    buildNarrativeState({
      homeState,
      experienceState,
      loops,
      recommendations,
      lifeDashboardSnapshot: snapshot,
      calendar: null,
      email: null,
      // Sin historial propio todavía -- este es el primer consumidor
      // real de Narrative en el chat (ver `to-conversation-context.ts`:
      // "Ningún llamador real hoy"), así que no hay
      // `recentlyNarratedThreadIds` que reutilizar. El propio mecanismo
      // de diversidad de este redesign (`conversation-signal-log.ts`,
      // a nivel de tipo de estrategia) sigue evitando la repetición
      // gruesa mientras tanto.
      recentlyNarratedThreadIds: [],
    }),
  );

  const conversationContext = toConversationContext(narrativeState);

  if (
    narrativeState.recentChanges.length === 0 &&
    !conversationContext.activeThreadId &&
    !conversationContext.continuation
  ) {
    return null;
  }

  const currentThread = narrativeState.currentActiveStory?.current ?? null;

  return {
    changes: narrativeState.recentChanges,
    activeThread: currentThread
      ? {
          title: currentThread.title,
          summary: currentThread.summary,
          chapterLabel: NARRATIVE_PROGRESSION_LABELS[currentThread.chapter.stage],
        }
      : null,
    isReturningAfterSetback: conversationContext.isReturningAfterSetback,
    hasEcho: conversationContext.hasEcho,
    continuation: conversationContext.continuation,
  };
}
