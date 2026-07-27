import type { LifeGraphContext } from "../../life/life-graph-context";
import type { EntityId } from "../../life/value-objects/entity-id";
import type { Contradiction, ContradictionRef } from "../entities/contradiction";

export interface ContradictionRepository {
  getById(context: LifeGraphContext, id: EntityId): Promise<Contradiction | null>;
  list(context: LifeGraphContext): Promise<Contradiction[]>;
  /** Contradicciones donde `ref` participa en cualquiera de los dos extremos, sin importar el status. */
  listByRef(context: LifeGraphContext, ref: ContradictionRef): Promise<Contradiction[]>;
  /** Upsert -- resolver/reconocer/descartar es volver a llamar `save()` con el `status` cambiado. */
  save(context: LifeGraphContext, contradiction: Contradiction): Promise<Contradiction>;
}
