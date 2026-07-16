import type { EntityType } from "../../db/schema";
import type { UserContext } from "../../identity/user-context";

export interface SemanticMemoryMatch {
  content: string;
  sourceType: EntityType;
  sourceId: string;
  score: number;
}

/**
 * Memoria semántica: conversaciones, diario, documentos y notas
 * recuperados por significado (embeddings + pgvector), no por palabra
 * exacta.
 */
export interface SemanticMemoryRepository {
  search(
    context: UserContext,
    query: string,
    limit?: number,
  ): Promise<SemanticMemoryMatch[]>;
}

/**
 * Implementación pendiente (decisión CTO #12): requiere generar el
 * embedding de `query` con el proveedor de IA y compararlo contra
 * `memory_embeddings` vía pgvector. Falla de forma explícita en vez de
 * devolver resultados vacíos silenciosamente, para que quede claro que
 * la búsqueda semántica todavía no existe.
 */
export class NotImplementedSemanticMemoryRepository
  implements SemanticMemoryRepository
{
  async search(): Promise<SemanticMemoryMatch[]> {
    throw new Error(
      "SemanticMemoryRepository: búsqueda semántica aún no implementada (pendiente de generación de embeddings).",
    );
  }
}
