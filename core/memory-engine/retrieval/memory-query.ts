import type { EntityId } from "../../life/value-objects/entity-id";
import type { MemoryType } from "../value-objects/memory-type";

/** Forma de una búsqueda de memorias — no cómo se ejecuta, ver `MemoryRetrievalStrategy`. */
export interface MemoryQuery {
  text?: string;
  type?: MemoryType;
  personId?: EntityId;
  occurredAfter?: Date;
  occurredBefore?: Date;
  limit?: number;
  /**
   * Opt-in explícito, nunca por defecto (auditoría de arquitectura,
   * 2026-08-16) -- `StructuredMemoryRetrievalStrategy` es un camino
   * compartido entre el chat y las pantallas de la persona
   * (`/memories`, `/life`); sin este campo no habría forma de que un
   * llamador dijera "esta lectura es para LUZ, no para el usuario".
   * `false`/`undefined` (todo llamador existente) sigue excluyendo
   * `hiddenFromUser`, comportamiento idéntico a antes de este campo.
   */
  includeHiddenFromUser?: boolean;
}
