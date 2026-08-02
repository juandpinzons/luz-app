import type { LifeGraphContext } from "../../life/life-graph-context";
import type { EntityId } from "../../life/value-objects/entity-id";

/**
 * Solo lo que este redesign necesita hoy -- filtrar candidatos ya
 * mostrados y marcar uno como visto. `accepted`/`edited`/`dismissed`
 * (ver `SeenPrompt.status`) quedan definidos en la entidad para uso
 * futuro de Dashboard/Learning, pero ningún método aquí los escribe
 * todavía -- agregar `setStatus()` es trabajo de ese momento, no de
 * este.
 */
export interface SeenPromptRepository {
  /**
   * Todos los `subjectId` ya vistos de este tipo, en este LifeGraph --
   * una sola consulta para filtrar N candidatos (`intención sin
   * seguimiento`, `cierre sin reconocer`), nunca N consultas
   * individuales (mismo criterio que `getHistoryForBeliefs`).
   */
  listSeenSubjectIds(
    context: LifeGraphContext,
    subjectType: string,
  ): Promise<Set<EntityId>>;

  /** Upsert: marcar de nuevo el mismo sujeto no crea una segunda fila (`seen_prompts_subject_idx`, única). */
  markSeen(
    context: LifeGraphContext,
    subjectType: string,
    subjectId: EntityId,
  ): Promise<void>;
}
