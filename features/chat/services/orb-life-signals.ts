import { DrizzleGoalRepository, DrizzleProjectRepository, DrizzleRelationshipRepository } from "../../../core/life";
import type { Database } from "../../../core/db/client";
import type { LifeGraphContext } from "../../../core/life";
import { describeError } from "../../../core/observability/describe-error";
import { logger } from "../../../core/observability/logger";

export interface OrbLifeSignals {
  /** El más reciente entre goals/projects que pasaron a `completed`, si hay alguno. */
  mostRecentCompletionAt: Date | null;
  /** El `updatedAt` más reciente entre las relaciones de esta persona, si hay alguna. */
  mostRecentRelationshipTouchAt: Date | null;
}

const NO_SIGNALS: OrbLifeSignals = { mostRecentCompletionAt: null, mostRecentRelationshipTouchAt: null };

function mostRecent(dates: readonly Date[]): Date | null {
  return dates.length === 0 ? null : new Date(Math.max(...dates.map((date) => date.getTime())));
}

/**
 * Lecturas puntuales para el "momento" del orbe (Misión "Orb Experience
 * V1", Objetivo B: "logro reciente", "reencuentro con una relación") --
 * deliberadamente SEPARADAS de `RealitySnapshot` en vez de extenderlo:
 * `RealitySnapshot.life` solo expone lo ACTIVO
 * (`listActiveGoals`/`listActiveProjects`, ver `assemble-reality-snapshot.ts`),
 * así que "qué se completó hace poco" necesita su propia lectura, nunca
 * una segunda consulta redundante sobre lo mismo que ese ensamblador ya
 * trae. Mismos repositorios (`core/life`), un `.list()` cada uno, ya
 * indexados por `lifeGraphId`.
 *
 * Nunca lanza -- una falla aquí es "sin logro/reencuentro reciente que
 * mostrar", no un error que deba tumbar la bienvenida completa.
 */
export async function gatherOrbLifeSignals(db: Database, context: LifeGraphContext): Promise<OrbLifeSignals> {
  try {
    const [goals, projects, relationships] = await Promise.all([
      new DrizzleGoalRepository(db).list(context),
      new DrizzleProjectRepository(db).list(context),
      new DrizzleRelationshipRepository(db).list(context),
    ]);

    const completions = [
      ...goals.filter((goal) => goal.status === "completed").map((goal) => goal.updatedAt),
      ...projects.filter((project) => project.status === "completed").map((project) => project.updatedAt),
    ];

    return {
      mostRecentCompletionAt: mostRecent(completions),
      mostRecentRelationshipTouchAt: mostRecent(relationships.map((relationship) => relationship.updatedAt)),
    };
  } catch (error) {
    logger.log({
      event: "chat.orb_life_signals_failed",
      severity: "error",
      lifeGraphId: context.lifeGraphId,
      ...describeError(error),
    });
    return NO_SIGNALS;
  }
}
