import { NextResponse } from "next/server";
import { resolveUserIdForLifeGraph } from "@/auth/resolve-user-id-for-life-graph";
import { db } from "@/core/db/client";
import {
  DrizzleContinuityLoopRepository,
} from "@/core/continuity-engine";
import { DrizzleCuriosityQuestionRepository } from "@/core/curiosity-engine";
import {
  DrizzleGoalRepository,
  DrizzleLifeGraphRepository,
  DrizzleProjectRepository,
  DrizzleRelationshipRepository,
} from "@/core/life";
import { DrizzleMemoryRepository } from "@/core/memory-engine";
import { isCronAuthorized } from "@/core/observability/is-cron-authorized";
import { createRequestId, logger } from "@/core/observability/logger";
import { recordEvent } from "@/core/observability/record-event";
import { sendPushNotification } from "@/core/push-notifications/send-push-notification";
import { detectAllContinuityLoops } from "@/features/continuity/detection";

const ROUTE = "GET /api/cron/continuity-worker";

/**
 * Plan Hobby de Vercel -- una corrida al día, mismo criterio que
 * `knowledge-worker` (ver ese docblock). A diferencia de ese cron, este
 * no drena una cola: `continuity_loops` nunca tuvo un job que la
 * llenara -- `detectAllContinuityLoops` (`features/continuity/detection`)
 * existía completa y probada desde 2026-07-31, pero nada la invocaba en
 * producción. `assemble-reconnection-context.ts`/`app/dashboard/page.tsx`
 * ya leen loops correctamente; esta ruta es lo único que faltaba para
 * que hubiera algo real que leer.
 *
 * Alcance de esta primera versión -- fuentes `core/` únicamente
 * (Memory/Goal/Project/Relationship/Curiosity), deliberadamente sin
 * Calendar/Email/Recommendation todavía: esas requieren sincronizar
 * Apple Calendar/Gmail en vivo por cuenta, el mismo costo/riesgo de
 * fallo que `assemble-reconnection-context.ts` ya evita a propósito
 * fuera del turno de chat. `detectAllContinuityLoops` fue diseñada
 * exactamente para aceptar fuentes parciales (todas sus entradas son
 * opcionales) -- añadir Calendar/Email es una extensión aditiva futura,
 * no un rediseño.
 */
export const maxDuration = 60;

const TIME_BUDGET_MS = 50_000; // margen de seguridad sobre maxDuration=60s

export async function GET(request: Request): Promise<Response> {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const requestId = createRequestId();
  const startedAt = Date.now();

  const lifeGraphRepo = new DrizzleLifeGraphRepository(db);
  const goalRepo = new DrizzleGoalRepository(db);
  const projectRepo = new DrizzleProjectRepository(db);
  const relationshipRepo = new DrizzleRelationshipRepository(db);
  const memoryRepo = new DrizzleMemoryRepository(db);
  const curiosityRepo = new DrizzleCuriosityQuestionRepository(db);
  const loopRepo = new DrizzleContinuityLoopRepository(db);

  const contexts = await lifeGraphRepo.listAllContexts();

  let processed = 0;
  let created = 0;
  let failed = 0;

  for (const context of contexts) {
    if (Date.now() - startedAt >= TIME_BUDGET_MS) {
      break;
    }

    try {
      const [members, goals, projects, relationships, memories, curiosityQuestions, existingLoops] =
        await Promise.all([
          lifeGraphRepo.getMembers(context.lifeGraphId),
          goalRepo.list(context),
          projectRepo.list(context),
          relationshipRepo.list(context),
          memoryRepo.listActive(context),
          curiosityRepo.list(context),
          loopRepo.list(context),
        ]);

      const nameByPersonId = new Map(members.map((person) => [person.id, person.name]));
      const relationshipInputs = relationships.map((relationship) => ({
        relationship,
        personName: nameByPersonId.get(relationship.toPersonId),
      }));

      const newLoops = detectAllContinuityLoops({
        lifeGraphId: context.lifeGraphId,
        memories,
        goals,
        projects,
        relationships: relationshipInputs,
        curiosityQuestions,
        existingLoops,
      });

      if (newLoops.length > 0) {
        // Se resuelve una sola vez por persona, no por loop -- misión
        // "shell nativo iOS", 2026-08-18. Si esta persona no tiene un
        // dispositivo con push registrado (o Apple Developer Program
        // sigue sin completarse del lado del Founder), `sendPushNotification`
        // se degrada a un no-op logueado -- nunca bloquea que el loop
        // en sí se guarde.
        const userId = await resolveUserIdForLifeGraph(db, context.lifeGraphId);

        for (const loop of newLoops) {
          await loopRepo.save(context, loop);
          created += 1;

          if (userId) {
            await sendPushNotification(db, {
              userId,
              title: "LUZ tiene algo para ti",
              body: loop.title,
              triggerType: "continuity_loop",
              sourceId: loop.id,
            });
          }
        }
      }

      processed += 1;
    } catch (error) {
      failed += 1;
      await recordEvent(db, {
        type: "error",
        route: "cron.continuity_worker",
        message: error instanceof Error ? error.message : String(error),
        metadata: { lifeGraphId: context.lifeGraphId },
      });
    }
  }

  const durationMs = Date.now() - startedAt;
  logger.log({
    event: "cron.continuity_worker.completed",
    requestId,
    route: ROUTE,
    processed,
    created,
    failed,
    durationMs,
  });

  return NextResponse.json({ processed, created, failed, durationMs });
}
