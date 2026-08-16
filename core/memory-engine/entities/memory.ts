import type { EntityId } from "../../life/value-objects/entity-id";
import type { MemoryRank } from "../value-objects/memory-rank";
import type { MemorySource } from "../value-objects/memory-source";
import type { MemoryStatus } from "../value-objects/memory-status";
import type { MemoryType } from "../value-objects/memory-type";

/**
 * Evidencia cruda (MEMORY_ENGINE_SPEC.md: "Memory no razona"). Es su
 * propio aggregate root — Memory opera SOBRE un LifeGraph
 * (`lifeGraphId` es solo la frontera de tenencia), nunca es miembro
 * del aggregate `LifeGraph` (ADR-0011).
 *
 * `personId` es opcional: no toda memoria es atribuible a un miembro
 * específico del grafo (p. ej. una observación de un sensor).
 * `sourceId` es un id opaco a la fuente original (mensaje de
 * conversación, entrada de diario...) — Memory no interpreta su forma,
 * solo lo guarda como referencia.
 */
export interface Memory {
  id: EntityId;
  lifeGraphId: EntityId;
  personId?: EntityId;
  type: MemoryType;
  content: string;
  source: MemorySource;
  sourceId?: string;
  status: MemoryStatus;
  /**
   * Excluida de toda lectura orientada a un humano (chat, dashboard,
   * /memories, /life) sin dejar de ser `active` para el procesamiento
   * interno. `undefined`/`false` se tratan igual -- ausencia de bandera
   * en literales construidos a mano (p. ej. Capture) nunca implica
   * "suprimida".
   */
  suppressed?: boolean;
  /**
   * Distinta de `suppressed` -- excluida SOLO de lecturas de cara a la
   * persona (`/memories`, `/dashboard`, `/life`), LUZ la sigue viendo en
   * el chat (`MemoryQuery.includeHiddenFromUser`). Ver docblock de la
   * columna en `core/db/schema/memory.ts` para el contraste completo.
   * `undefined`/`false` se tratan igual, mismo criterio que `suppressed`.
   */
  hiddenFromUser?: boolean;
  rank?: MemoryRank;
  occurredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
