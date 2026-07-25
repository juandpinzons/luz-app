import { createAccountIdentityResolver } from "../auth/drizzle-identity-resolver";
import { env } from "../core/config/env";
import { db } from "../core/db/client";
import { createKnowledgeEngine } from "../core/knowledge-engine";
import {
  claimNextKnowledgeJob,
  processKnowledgeJob,
} from "../features/knowledge/services/process-knowledge-job";

/**
 * Worker del Knowledge Engine -- SOLO para desarrollo local.
 *
 * Proceso Node completamente independiente del servidor web (decisión
 * CTO #6): se ejecuta con `npm run worker`, nunca dentro de una ruta
 * de Next.js. Hace polling continuo de `knowledge_jobs`.
 *
 * En producción, este loop infinito no puede correr en Vercel
 * (serverless, sin procesos persistentes) -- `app/api/cron/
 * knowledge-worker/route.ts` es el equivalente real desplegado
 * (2026-07-25, ver `docs/engineering/FIRST_MESSAGE_IDENTITY_PLAN.md`),
 * invocado por Vercel Cron, procesando un lote acotado por corrida en
 * vez de un job a la vez. Ambos comparten exactamente la misma lógica
 * de reclamo/procesamiento vía
 * `features/knowledge/services/process-knowledge-job.ts` -- nunca dos
 * copias que puedan divergir.
 */

const knowledgeEngine = createKnowledgeEngine(db);
const identityResolver = createAccountIdentityResolver(db);

async function tick(): Promise<void> {
  const job = await claimNextKnowledgeJob(db);

  if (!job) {
    return;
  }

  const result = await processKnowledgeJob(db, job, knowledgeEngine, identityResolver);

  if (result.ok) {
    console.log(`[worker] job ${job.id} completado`);
  } else {
    console.error(`[worker] job ${job.id} falló (intento ${job.attempts + 1}): ${result.error}`);
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
