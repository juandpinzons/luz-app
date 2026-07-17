import type { EntityId } from "../../life/value-objects/entity-id";

/**
 * Un `Insight` nunca es texto libre: siempre apunta a la memoria
 * concreta que lo sustenta. `memoryId` es un `EntityId` — Knowledge no
 * importa ningún tipo de `core/memory-engine`, ni siquiera para esto
 * (ADR-0013): el id ya es el tipo compartido, y es lo único que un
 * registro persistido necesita conservar.
 *
 * El nombre `memoryId` refleja que Memory es hoy la única fuente de
 * evidencia con un engine real, no que la evidencia esté limitada a
 * memorias para siempre. `EntityId` ya es neutral por diseño — cuando
 * exista una fuente de evidencia no proveniente de Memory (Gmail,
 * Calendar, Drive, Notion, Health, Slack...), la decisión pendiente es
 * si esta tabla se amplía con un campo/tipo de fuente adicional o si
 * cada nueva fuente se proyecta primero a algo memory-like — no que
 * `EntityId` necesite cambiar.
 */
export interface Evidence {
  id: EntityId;
  lifeGraphId: EntityId;
  insightId: EntityId;
  memoryId: EntityId;
  createdAt: Date;
}
