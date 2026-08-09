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

  /**
   * War Room 2026-08-09 (biblioteca editorial): a diferencia de
   * `listSeenSubjectIds` ("visto alguna vez, para siempre"), esto sirve
   * a contenido que sí puede repetirse después de un tiempo
   * (`repeat_after` en `editorial/*​/phrases.yaml`) -- solo lo visto
   * desde `since` cuenta como "todavía no puede repetirse".
   */
  listSeenSubjectIdsSince(
    context: LifeGraphContext,
    subjectType: string,
    since: Date,
  ): Promise<Set<EntityId>>;

  /** Upsert: marcar de nuevo el mismo sujeto no crea una segunda fila (`seen_prompts_subject_idx`, única). */
  markSeen(
    context: LifeGraphContext,
    subjectType: string,
    subjectId: EntityId,
  ): Promise<void>;

  /**
   * A diferencia de `markSeen` (`onConflictDoNothing`, la primera vez
   * gana para siempre), esto sí actualiza `firstSeenAt` en cada
   * llamada -- lo que este método usa para decidir "todavía no puede
   * repetirse" es la fecha de la ÚLTIMA vez, no la primera. Mismo
   * nombre de columna (`firstSeenAt` sigue significando "primera vez
   * que se vio ESTE ciclo", no una mentira -- ver docblock de la
   * entidad si esto necesita su propia columna más adelante).
   */
  markSeenAgain(
    context: LifeGraphContext,
    subjectType: string,
    subjectId: EntityId,
  ): Promise<void>;
}
