import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import type { EntityType } from "./entity-type";
import { users } from "./users";

export const knowledgeJobStatusEnum = pgEnum("knowledge_job_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

/**
 * Cola de trabajos del Knowledge Engine. El worker (proceso
 * completamente independiente del servidor web) hace polling de esta
 * tabla; ninguna ruta HTTP espera su procesamiento.
 */
export const knowledgeJobs = pgTable(
  "knowledge_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull().$type<EntityType>(),
    sourceId: uuid("source_id").notNull(),
    status: knowledgeJobStatusEnum("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
  },
  (table) => [
    index("knowledge_jobs_status_idx").on(table.status),
    index("knowledge_jobs_user_id_idx").on(table.userId),
  ],
);

export type KnowledgeJob = typeof knowledgeJobs.$inferSelect;
export type NewKnowledgeJob = typeof knowledgeJobs.$inferInsert;
