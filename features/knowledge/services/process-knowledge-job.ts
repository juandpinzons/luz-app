import { and, asc, eq, lt, or } from "drizzle-orm";
import type { AccountIdentityResolver } from "../../../auth/identity-resolver";
import type { Database } from "../../../core/db/client";
import { type KnowledgeJob, knowledgeJobs } from "../../../core/db/schema";
import type { KnowledgeEngine } from "../../../core/knowledge-engine";
import { createEntityId } from "../../../core/life";
import { assembleRealitySnapshot } from "../../chat/services/assemble-reality-snapshot";

const MAX_ATTEMPTS = 3;
/** Un cron tiene 60s; cinco minutos cubren una ejecución lenta sin dejar jobs huérfanos para siempre. */
const PROCESSING_LEASE_MS = 5 * 60 * 1000;

export interface ProcessJobResult {
  ok: boolean;
  error?: string;
}

/**
 * Reclama el próximo `knowledge_jobs` pendiente o cuyo lease expiró
 * (`skipLocked`, seguro bajo múltiples llamadores concurrentes -- importa
 * una vez que `worker/index.ts` y la ruta de cron pueden correr al mismo
 * tiempo). Sin el lease, un timeout o crash después de marcar
 * `processing` dejaba el job permanentemente invisible para todos los
 * workers.
 * Extraído de `worker/index.ts` (2026-07-25, deploy del Knowledge
 * Engine) para que la ruta de cron y el worker de desarrollo local
 * compartan exactamente la misma lógica de reclamo/procesamiento --
 * nunca dos copias que puedan divergir.
 */
export async function claimNextKnowledgeJob(
  db: Database,
): Promise<KnowledgeJob | undefined> {
  return db.transaction(async (tx) => {
    const now = new Date();
    const expiredLease = new Date(now.getTime() - PROCESSING_LEASE_MS);
    const [job] = await tx
      .select()
      .from(knowledgeJobs)
      .where(
        or(
          eq(knowledgeJobs.status, "pending"),
          and(
            eq(knowledgeJobs.status, "processing"),
            lt(knowledgeJobs.processingAt, expiredLease),
          ),
        ),
      )
      .orderBy(asc(knowledgeJobs.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });

    if (!job) {
      return undefined;
    }

    await tx
      .update(knowledgeJobs)
      .set({
        status: "processing",
        attempts: job.attempts + 1,
        processingAt: now,
      })
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
    const snapshot = await assembleRealitySnapshot(db, lifeGraphContext, {
      // El job existe por esta Memory concreta. Forzarla dentro del
      // snapshot evita que un historial grande la expulse del top-N y
      // que Knowledge procese evidencia distinta a la que lo disparó.
      focusMemoryId: createEntityId(job.sourceId),
    });

    await knowledgeEngine.run(snapshot, {
      ...lifeGraphContext,
      memoryId: createEntityId(job.sourceId),
    });

    await db
      .update(knowledgeJobs)
      .set({
        status: "completed",
        processingAt: null,
        processedAt: new Date(),
      })
      .where(eq(knowledgeJobs.id, job.id));

    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const nextStatus = job.attempts >= MAX_ATTEMPTS ? "failed" : "pending";

    await db
      .update(knowledgeJobs)
      .set({ status: nextStatus, processingAt: null, lastError: message })
      .where(eq(knowledgeJobs.id, job.id));

    return { ok: false, error: message };
  }
}
