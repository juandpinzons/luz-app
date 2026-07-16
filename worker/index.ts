import { asc, eq } from "drizzle-orm";
import { env } from "../core/config/env";
import { db } from "../core/db/client";
import { type KnowledgeJob, knowledgeJobs } from "../core/db/schema";
import { createKnowledgeEngine } from "../core/knowledge/knowledge-engine";

/**
 * Worker del Knowledge Engine.
 *
 * Proceso Node completamente independiente del servidor web (decisión
 * CTO #6): se ejecuta con `npm run worker`, nunca dentro de una ruta de
 * Next.js. Hace polling de `knowledge_jobs` sobre una tabla en
 * PostgreSQL (decisión CTO: cola de trabajos + worker dedicado, sin
 * Redis) y ejecuta el pipeline del Knowledge Engine para cada trabajo
 * pendiente.
 */

const MAX_ATTEMPTS = 3;

const knowledgeEngine = createKnowledgeEngine(db);

async function claimNextJob(): Promise<KnowledgeJob | undefined> {
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

async function processJob(job: KnowledgeJob): Promise<void> {
  try {
    await knowledgeEngine.run({
      userId: job.userId,
      sourceType: job.sourceType,
      sourceId: job.sourceId,
    });

    await db
      .update(knowledgeJobs)
      .set({ status: "completed", processedAt: new Date() })
      .where(eq(knowledgeJobs.id, job.id));

    console.log(`[worker] job ${job.id} completado`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const nextStatus = job.attempts >= MAX_ATTEMPTS ? "failed" : "pending";

    await db
      .update(knowledgeJobs)
      .set({ status: nextStatus, lastError: message })
      .where(eq(knowledgeJobs.id, job.id));

    console.error(`[worker] job ${job.id} falló (intento ${job.attempts}): ${message}`);
  }
}

async function tick(): Promise<void> {
  const job = await claimNextJob();

  if (job) {
    await processJob(job);
  }
}

async function main(): Promise<void> {
  console.log(
    `[worker] Knowledge Engine worker iniciado. Polling cada ${env.WORKER_POLL_INTERVAL_MS}ms.`,
  );

  for (;;) {
    try {
      await tick();
    } catch (error) {
      console.error("[worker] error inesperado en el ciclo de polling:", error);
    }

    await new Promise((resolve) =>
      setTimeout(resolve, env.WORKER_POLL_INTERVAL_MS),
    );
  }
}

main().catch((error) => {
  console.error("[worker] error fatal:", error);
  process.exit(1);
});
