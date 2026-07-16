import type { Database } from "../db/client";
import { knowledgeJobs } from "../db/schema";
import type { PipelineContext } from "./types";

/**
 * Encola un trabajo para el Knowledge Engine. Es una simple inserción en
 * `knowledge_jobs` — no ejecuta el pipeline ni espera resultado. El
 * worker (proceso independiente) es quien lo recoge más tarde. Ninguna
 * ruta HTTP debe esperar el procesamiento (decisión CTO #6): esta
 * función es intencionalmente rápida y de "fire and forget".
 */
export async function enqueueKnowledgeJob(
  db: Database,
  context: PipelineContext,
): Promise<void> {
  await db.insert(knowledgeJobs).values({
    userId: context.userId,
    sourceType: context.sourceType,
    sourceId: context.sourceId,
  });
}
