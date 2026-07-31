import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import type { EntityType } from "./entity-type";
import { lifeGraphs, persons } from "./life-graph";

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
 *
 * Escopada por `lifeGraphId`, no por `userId` (ADR-0011, ADR-0012,
 * MEMORY_ENGINE_MIGRATION_PLAN.md): esta tabla no tenía consumidores
 * en código (verificado por grep) antes de este cambio, así que
 * repuntar la columna aquí no rompe nada existente.
 */
export const memoryEmbeddings = pgTable(
  "memory_embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references(() => lifeGraphs.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull().$type<EntityType>(),
    sourceId: uuid("source_id").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("memory_embeddings_life_graph_id_idx").on(table.lifeGraphId),
    index("memory_embeddings_source_idx").on(
      table.sourceType,
      table.sourceId,
    ),
  ],
);

export type MemoryEmbedding = typeof memoryEmbeddings.$inferSelect;
export type NewMemoryEmbedding = typeof memoryEmbeddings.$inferInsert;

/**
 * Estos tres enums duplican deliberadamente las listas de valores de
 * `core/memory-engine/value-objects/` (memory-type.ts, memory-source.ts,
 * memory-status.ts) en vez de importarlas — mismo patrón que
 * `insightTypeEnum`/`insightStatusEnum` en knowledge.ts: el schema de
 * persistencia no depende del dominio. Si esas listas cambian, este
 * archivo requiere una migración a juego.
 */
export const memoryTypeEnum = pgEnum("memory_type", [
  "fact",
  "pattern",
  "ritual",
  "preference",
  "relationship",
  "goal",
  "event",
  "intention",
]);

export const memorySourceEnum = pgEnum("memory_source", [
  "conversation",
  "journal",
  "document",
  "calendar",
  "email",
  "sensor",
  "manual",
]);

export const memoryStatusEnum = pgEnum("memory_status", [
  "active",
  "archived",
  "forgotten",
]);

/**
 * Evidencia cruda de la Memory (core/memory-engine/entities/memory.ts).
 * `personId` es nullable: no toda memoria es atribuible a un miembro
 * específico. `rankScore`/`rankedAt` viajan juntos porque `MemoryRank`
 * es un value object opcional como par, nunca como mitad — el check
 * constraint lo hace cumplir también a nivel de fila. `content` nunca
 * se trunca ni se limpia al archivar/olvidar (ver memory-status): Memory
 * no es un archivo a podar por espacio, es la base de la comprensión de
 * la persona — perder contenido reduce esa comprensión más de lo que
 * ahorra almacenamiento.
 */
export const memories = pgTable(
  "memories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references(() => lifeGraphs.id, { onDelete: "cascade" }),
    personId: uuid("person_id").references(() => persons.id, {
      onDelete: "set null",
    }),
    type: memoryTypeEnum("type").notNull(),
    content: text("content").notNull(),
    source: memorySourceEnum("source").notNull(),
    sourceId: text("source_id"),
    status: memoryStatusEnum("status").notNull().default("active"),
    rankScore: integer("rank_score"),
    rankedAt: timestamp("ranked_at", { withTimezone: true }),
    occurredAt: timestamp("occurred_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("memories_life_graph_id_idx").on(table.lifeGraphId),
    index("memories_person_id_idx").on(table.personId),
    index("memories_status_idx").on(table.status),
    /**
     * Index Optimization (evidencia medida, no "por si acaso" -- las tres
     * que siguen comparten el mismo prefijo `(life_graph_id, status)` pero
     * cada una sirve un ORDER BY real distinto que un índice compartido no
     * puede cubrir a la vez; confirmado con las tres activas al mismo
     * tiempo, ninguna sirve a las otras).
     *
     * `structured-memory-retrieval-strategy.ts` -- la recuperación de
     * memoria que arma el contexto de CADA mensaje de chat:
     * `WHERE life_graph_id=$1 AND status='active' ORDER BY rank_score DESC
     * NULLS LAST, created_at DESC LIMIT ≤150`. Medido con un LifeGraph
     * sintético de 5000 memorias (uso diario de casi un año, el caso real
     * que el producto busca): cost 537.08→37.83, 1.516ms→0.139ms, `Sort`
     * eliminado del plan.
     */
    index("memories_life_graph_id_status_rank_created_idx").on(
      table.lifeGraphId,
      table.status,
      table.rankScore.desc().nullsLast(),
      table.createdAt.desc(),
    ),
    /**
     * `get-recent-memory-highlight.ts` -- el teaser "lo último que
     * recuerdo" de CADA visita a `/dashboard`:
     * `WHERE life_graph_id=$1 AND status='active' ORDER BY created_at DESC
     * LIMIT 1`. Mismo LifeGraph sintético: cost 383.10→0.54,
     * 0.660ms→0.029ms.
     */
    index("memories_life_graph_id_status_created_idx").on(
      table.lifeGraphId,
      table.status,
      table.createdAt.desc(),
    ),
    /**
     * `search-memories.ts` (`listRecentActiveMemories`) -- listado
     * cronológico de `/memories`:
     * `WHERE life_graph_id=$1 AND status='active' ORDER BY occurred_at DESC
     * NULLS LAST, created_at DESC LIMIT 100`. Mismo LifeGraph sintético:
     * cost 524.53→25.79, 0.767ms→0.095ms. Visita menos frecuente que las
     * dos anteriores (navegación explícita a `/memories`, no cada sesión)
     * -- incluido de todas formas porque la mejora medida es real, no
     * porque "podría servir".
     */
    index("memories_life_graph_id_status_occurred_created_idx").on(
      table.lifeGraphId,
      table.status,
      table.occurredAt.desc().nullsLast(),
      table.createdAt.desc(),
    ),
    check(
      "memories_rank_score_range",
      sql`${table.rankScore} IS NULL OR (${table.rankScore} >= 0 AND ${table.rankScore} <= 100)`,
    ),
    check(
      "memories_rank_pair",
      sql`(${table.rankScore} IS NULL AND ${table.rankedAt} IS NULL) OR (${table.rankScore} IS NOT NULL AND ${table.rankedAt} IS NOT NULL)`,
    ),
  ],
);

export type MemoryRow = typeof memories.$inferSelect;
export type NewMemoryRow = typeof memories.$inferInsert;

/**
 * Arista entre dos memorias (core/memory-engine/entities/memory-connection.ts),
 * producida por la etapa Connect. Sin constraint de unicidad sobre
 * (fromMemoryId, toMemoryId) a propósito: varias conexiones distintas
 * entre el mismo par a lo largo del tiempo pueden ser señal real, no
 * ruido — deduplicar es una decisión de ConnectStage, no del schema.
 */
export const memoryConnections = pgTable(
  "memory_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references(() => lifeGraphs.id, { onDelete: "cascade" }),
    fromMemoryId: uuid("from_memory_id")
      .notNull()
      .references(() => memories.id, { onDelete: "cascade" }),
    toMemoryId: uuid("to_memory_id")
      .notNull()
      .references(() => memories.id, { onDelete: "cascade" }),
    strength: integer("strength"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("memory_connections_life_graph_id_idx").on(table.lifeGraphId),
    index("memory_connections_from_memory_id_idx").on(table.fromMemoryId),
    index("memory_connections_to_memory_id_idx").on(table.toMemoryId),
    check(
      "memory_connections_strength_range",
      sql`${table.strength} IS NULL OR (${table.strength} >= 0 AND ${table.strength} <= 100)`,
    ),
  ],
);

export type MemoryConnectionRow = typeof memoryConnections.$inferSelect;
export type NewMemoryConnectionRow = typeof memoryConnections.$inferInsert;
