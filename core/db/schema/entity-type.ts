/**
 * Tipos de entidad que pueden participar como nodo del Knowledge Graph
 * Personal (en `entity_relations`, `evidence`, `memory_embeddings` y
 * `knowledge_jobs`). Postgres no soporta claves foráneas polimórficas
 * nativas, así que la integridad referencial de estos campos la garantiza
 * el código de dominio (`core/memory`, `core/knowledge`), no la base de
 * datos.
 */
export const ENTITY_TYPES = [
  "conversation",
  "conversation_message",
  "journal_entry",
  "document",
  "project",
  "goal",
  "habit",
  "person",
  "insight",
  "memory",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];
