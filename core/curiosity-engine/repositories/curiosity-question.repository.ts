import type { LifeGraphContext } from "../../life/life-graph-context";
import type { EntityId } from "../../life/value-objects/entity-id";
import type { CuriosityQuestion } from "../entities/curiosity-question";

export interface CuriosityQuestionRepository {
  list(context: LifeGraphContext): Promise<CuriosityQuestion[]>;
  /** A lo sumo una `pending` por LifeGraph -- ver docblock del schema. */
  getPending(context: LifeGraphContext): Promise<CuriosityQuestion | null>;
  save(context: LifeGraphContext, question: CuriosityQuestion): Promise<CuriosityQuestion>;
  updateStatus(
    context: LifeGraphContext,
    id: EntityId,
    status: "resolved" | "dismissed",
    resolvedAt: Date,
  ): Promise<void>;
  /** Atómico (`UPDATE ... SET times_offered = times_offered + 1 ... RETURNING`) -- sin lectura previa, nunca una carrera entre dos turnos concurrentes. Devuelve el conteo nuevo. */
  incrementTimesOffered(context: LifeGraphContext, id: EntityId): Promise<number>;
}
