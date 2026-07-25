import { NextResponse } from "next/server";
import { createAccountIdentityResolver } from "@/auth/drizzle-identity-resolver";
import { db } from "@/core/db/client";
import { createKnowledgeEngine } from "@/core/knowledge-engine";
import { createRequestId, logger } from "@/core/observability/logger";
import { recordEvent } from "@/core/observability/record-event";
import {
  claimNextKnowledgeJob,
  processKnowledgeJob,
} from "@/features/knowledge/services/process-knowledge-job";

const ROUTE = "GET /api/cron/knowledge-worker";

/**
 * Plan Hobby de Vercel limita los cron jobs a una vez al día -- así
 * que esta ruta procesa TODO lo que quepa en el tiempo disponible en
 * una sola corrida, nunca un job a la vez (a diferencia de
 * `worker/index.ts`, hecho para un loop continuo en desarrollo local
 * donde correr cada pocos segundos no cuesta nada). Ver
 * `docs/engineering/FIRST_MESSAGE_IDENTITY_PLAN.md` -- esto es lo que
 * despliega de verdad el Knowledge Engine, que hasta hoy nunca había
 * corrido en producción (146 jobs pendientes, 0 insights, siempre).
 */
export const maxDuration = 60;

const TIME_BUDGET_MS = 50_000; // margen de seguridad sobre maxDuration=60s

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const requestId = createRequestId();
  const startedAt = Date.now();

  const knowledgeEngine = createKnowledgeEngine(db);
  const identityResolver = createAccountIdentityResolver(db);

  let processed = 0;
  let completed = 0;
  let failed = 0;

  while (Date.now() - startedAt < TIME_BUDGET_MS) {
    const job = await claimNextKnowledgeJob(db);

    if (!job) {
      break;
    }

    const result = await processKnowledgeJob(db, job, knowledgeEngine, identityResolver);
    processed += 1;

    if (result.ok) {
      completed += 1;
    } else {
      failed += 1;
      await recordEvent(db, {
        type: "error",
        route: "cron.knowledge_worker",
        message: result.error,
        metadata: { jobId: job.id, userId: job.userId },
      });
    }
  }

  const durationMs = Date.now() - startedAt;
  logger.log({
    event: "cron.knowledge_worker.completed",
    requestId,
    route: ROUTE,
    processed,
    completed,
    failed,
    durationMs,
  });

  return NextResponse.json({ processed, completed, failed, durationMs });
}
