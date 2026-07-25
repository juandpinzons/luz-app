import { asc, eq } from "drizzle-orm";
import type { AccountIdentityResolver } from "../../../auth/identity-resolver";
import type { Database } from "../../../core/db/client";
import { type KnowledgeJob, knowledgeJobs } from "../../../core/db/schema";
import type { KnowledgeEngine } from "../../../core/knowledge-engine";
import { createEntityId } from "../../../core/life";
import { assembleRealitySnapshot } from "../../chat/services/assemble-reality-snapshot";

const MAX_ATTEMPTS = 3;

export interface ProcessJobResult {
  ok: boolean;
  error?: string;
}

/**
 * Reclama el próximo `knowledge_jobs` pendiente (`skipLocked`, seguro
 * bajo múltiples llamadores concurrentes -- importa una vez que
 * `worker/index.ts` y la ruta de cron pueden correr al mismo tiempo).
 * Extraído de `worker/index.ts` (2026-07-25, deploy del Knowledge
 * Engine) para que la ruta de cron y el worker de desarrollo local
 * compartan exactamente la misma lógica de reclamo/procesamiento --
 * nunca dos copias que puedan divergir.
 */
export async function claimNextKnowledgeJob(
  db: Database,
): Promise<KnowledgeJob | undefined> {
  return db.transaction(async (tx) => {
    const [job] = await tx
      .select()
      .from(knowledgeJobs)
      .where(eq(knowledgeJobs.status, "pending"))
      .orderBy(asc(knowledgeJobs.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });

    if (!job) {
      return undefined;
    }

    await tx
      .update(knowledgeJobs)
      .set({ status: "processing", attempts: job.attempts + 1 })
      .where(eq(knowledgeJobs.id, job.id));

    return job;
  });
}

/**
 * Resuelve el `LifeGraphContext` del job, ensambla el mismo
 * `RealitySnapshot` que ya usa el chat (ADR-0013) y corre el pipeline
 * completo del Knowledge Engine sobre eso -- nunca lanza; el llamador
 * decide cómo loguear/reportar el resultado (worker de desarrollo vs.
 * ruta de cron en producción quieren cosas distintas).
 */
export async function processKnowledgeJob(
  db: Database,
  job: KnowledgeJob,
  knowledgeEngine: KnowledgeEngine,
  identityResolver: AccountIdentityResolver,
): Promise<ProcessJobResult> {
  try {
    const lifeGraphContext = await identityResolver.resolve(job.userId);
    const snapshot = await assembleRealitySnapshot(db, lifeGraphContext);

    await knowledgeEngine.run(snapshot, {
      ...lifeGraphContext,
      memoryId: createEntityId(job.sourceId),
    });

    await db
      .update(knowledgeJobs)
      .set({ status: "completed", processedAt: new Date() })
      .where(eq(knowledgeJobs.id, job.id));

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const nextStatus = job.attempts >= MAX_ATTEMPTS ? "failed" : "pending";

    await db
      .update(knowledgeJobs)
      .set({ status: nextStatus, lastError: message })
      .where(eq(knowledgeJobs.id, job.id));

    return { ok: false, error: message };
  }
}
