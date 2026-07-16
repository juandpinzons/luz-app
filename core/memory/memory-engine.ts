import type { Database } from "../db/client";
import type { UserContext } from "../identity/user-context";
import {
  type SemanticMemoryMatch,
  type SemanticMemoryRepository,
  NotImplementedSemanticMemoryRepository,
} from "./semantic/semantic-memory.repository";
import {
  DrizzleStructuredMemoryRepository,
  type StructuredMemoryRepository,
  type StructuredMemorySnapshot,
} from "./structured/structured-memory.repository";

export interface MemoryRecallResult {
  structured: StructuredMemorySnapshot;
  semantic: SemanticMemoryMatch[];
}

/**
 * Único punto de acceso a la memoria de LUZ. Ninguna feature, ruta o
 * componente de UI debe leer `structured/` o `semantic/` directamente:
 * siempre pasan por este engine, que decide qué tipo de memoria
 * consultar según lo que se le pida.
 */
export class MemoryEngine {
  constructor(
    private readonly structured: StructuredMemoryRepository,
    private readonly semantic: SemanticMemoryRepository,
  ) {}

  /**
   * Memoria estructurada siempre se consulta (lectura barata de tablas
   * tipadas). La búsqueda semántica solo se ejecuta si se pasa `query`,
   * y hoy lanza error controlado hasta que existan embeddings.
   */
  async recall(
    context: UserContext,
    query?: string,
  ): Promise<MemoryRecallResult> {
    const structured = await this.structured.getSnapshot(context);

    if (!query) {
      return { structured, semantic: [] };
    }

    const semantic = await this.semantic.search(context, query);

    return { structured, semantic };
  }
}

export function createMemoryEngine(db: Database): MemoryEngine {
  return new MemoryEngine(
    new DrizzleStructuredMemoryRepository(db),
    new NotImplementedSemanticMemoryRepository(),
  );
}

export type { StructuredMemorySnapshot } from "./structured/structured-memory.repository";
export type { SemanticMemoryMatch } from "./semantic/semantic-memory.repository";
