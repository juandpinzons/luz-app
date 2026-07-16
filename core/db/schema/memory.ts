import { index, pgTable, text, timestamp, uuid, vector } from "drizzle-orm/pg-core";
import type { EntityType } from "./entity-type";
import { users } from "./users";

/**
 * Dimensión de los vectores de embedding. Fijada por el modelo de
 * embeddings que use `ai/provider.ts` (ej. text-embedding-3-small = 1536).
 * Si el modelo cambia de dimensión, esta tabla requiere una migración.
 */
export const EMBEDDING_DIMENSIONS = 1536;

/**
 * Memoria semántica: conversaciones, entradas de diario y documentos
 * indexados por significado (pgvector), no solo por palabra.
 *
 * NOTA (fase actual): la columna `embedding` se deja nullable a
 * propósito. La generación de embeddings todavía no está implementada
 * (ver decisión CTO #12) — esta tabla solo deja la estructura lista.
 */
export const memoryEmbeddings = pgTable(
  "memory_embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull().$type<EntityType>(),
    sourceId: uuid("source_id").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("memory_embeddings_user_id_idx").on(table.userId),
    index("memory_embeddings_source_idx").on(
      table.sourceType,
      table.sourceId,
    ),
  ],
);

export type MemoryEmbedding = typeof memoryEmbeddings.$inferSelect;
export type NewMemoryEmbedding = typeof memoryEmbeddings.$inferInsert;
