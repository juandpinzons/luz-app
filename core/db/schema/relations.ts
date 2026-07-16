import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { EntityType } from "./entity-type";
import { insights } from "./knowledge";
import { users } from "./users";

/**
 * Aristas del Knowledge Graph Personal: conectan cualquier par de
 * entidades tipadas (persona, proyecto, hábito, objetivo, evento,
 * documento, insight...) entre sí. Es la pieza transversal que permite
 * que las tablas tipadas evolucionen hacia un grafo real sin recurrir a
 * un modelo Entity-Attribute-Value.
 */
export const entityRelations = pgTable(
  "entity_relations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    fromType: text("from_type").notNull().$type<EntityType>(),
    fromId: uuid("from_id").notNull(),
    relationType: text("relation_type").notNull(),
    toType: text("to_type").notNull().$type<EntityType>(),
    toId: uuid("to_id").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("entity_relations_from_idx").on(table.fromType, table.fromId),
    index("entity_relations_to_idx").on(table.toType, table.toId),
  ],
);

/**
 * Evidencia que sustenta un insight. Un insight nunca es texto libre:
 * siempre apunta a las fuentes concretas (mensajes, entradas de diario,
 * documentos, hechos) que el Knowledge Engine usó para generarlo.
 */
export const evidence = pgTable(
  "evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    insightId: uuid("insight_id")
      .notNull()
      .references(() => insights.id, { onDelete: "cascade" }),
    sourceType: text("source_type").notNull().$type<EntityType>(),
    sourceId: uuid("source_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("evidence_insight_id_idx").on(table.insightId)],
);

export type EntityRelation = typeof entityRelations.$inferSelect;
export type NewEntityRelation = typeof entityRelations.$inferInsert;
export type Evidence = typeof evidence.$inferSelect;
export type NewEvidence = typeof evidence.$inferInsert;
