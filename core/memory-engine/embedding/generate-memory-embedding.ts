import { and, eq } from "drizzle-orm";
import type { AIProvider } from "../../../ai/provider";
import type { Database } from "../../db/client";
import { memoryEmbeddings } from "../../db/schema";
import type { LifeGraphContext } from "../../life/life-graph-context";
import type { Memory } from "../entities/memory";

/**
 * Genera y persiste el embedding de una `Memory` -- el paso que faltaba
 * para que `AISemanticMemoryRetrievalStrategy` tenga algo real que
 * comparar (`memory_embeddings.embedding` era estructura lista, cero
 * filas, ver `core/db/schema/memory.ts`). Llamado desde
 * `process-knowledge-job.ts`, nunca desde el turno de chat en vivo --
 * mismo criterio de costo/latencia que ya rige `enrichKnowledgeGraph`
 * (async, "fire and forget" respecto al mensaje que lo disparó).
 *
 * **Guard de existencia antes de insertar** -- mismo patrón que ya
 * corrigió la duplicación de evidencia de Concept/Belief tras un retry
 * de job (`enrichment idempotency fix`, 2026-07-29): un `knowledge_job`
 * puede reintentarse hasta `MAX_ATTEMPTS` veces tras un timeout de
 * Vercel; sin este guard, cada reintento generaría una fila nueva en
 * `memory_embeddings` para la misma Memory, inflando el pool candidato
 * de `AISemanticMemoryRetrievalStrategy` sin ninguna señal nueva.
 *
 * Nunca lanza por un fallo de la llamada a embeddings -- el llamador
 * (`processKnowledgeJob`) decide cómo tratar el error; una Memory sin
 * embedding simplemente no compite en la mitad semántica todavía
 * (degradación honesta, mismo criterio que el resto de Memory Engine).
 */
export async function generateMemoryEmbedding(
  db: Database,
  ai: AIProvider,
  context: LifeGraphContext,
  memory: Memory,
): Promise<void> {
  const [existing] = await db
    .select({ id: memoryEmbeddings.id })
    .from(memoryEmbeddings)
    .where(
      and(
        eq(memoryEmbeddings.lifeGraphId, context.lifeGraphId),
        eq(memoryEmbeddings.sourceType, "memory"),
        eq(memoryEmbeddings.sourceId, memory.id),
      ),
    )
    .limit(1);

  if (existing) {
    return;
  }

  const embedding = await ai.embed(memory.content);

  await db.insert(memoryEmbeddings).values({
    lifeGraphId: context.lifeGraphId,
    sourceType: "memory",
    sourceId: memory.id,
    content: memory.content,
    embedding,
  });
}
