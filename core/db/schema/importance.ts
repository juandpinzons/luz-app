import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { lifeGraphs } from "./life-graph";

/**
 * `core/importance-engine` -- importancia persistida y polimórfica
 * sobre CUALQUIER entidad (memoria, persona, goal, insight, belief,
 * concepto...), mismo criterio de "sin FK real, texto libre para el
 * tipo" que `entity_relations`/`contradictions` (la lista de tipos que
 * pueden tener importancia crece con el dominio, no debe forzarse a un
 * enum cerrado). Distinta de `memories.rank_score` (ranking DENTRO de
 * Memory Engine, ADR-0012) y de `ContextItem.relevanceScore`
 * (`DeterministicContextScoringStrategy`, ranking de UN turno de
 * conversación): esto es importancia GLOBAL, persistida, que evoluciona
 * con la evidencia acumulada -- Context Engine la lee como una señal
 * más al puntuar (`entity-importance-signal.ts`), nunca la reemplaza.
 * Una fila por (LifeGraph, entityType, entityId) -- `save()` es upsert.
 */
export const importanceScores = pgTable(
  "importance_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references(() => lifeGraphs.id, { onDelete: "cascade" }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    score: integer("score").notNull(),
    reason: text("reason").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("importance_scores_life_graph_id_idx").on(table.lifeGraphId),
    uniqueIndex("importance_scores_entity_idx").on(
      table.lifeGraphId,
      table.entityType,
      table.entityId,
    ),
    check(
      "importance_scores_score_range",
      sql`${table.score} >= 0 AND ${table.score} <= 100`,
    ),
  ],
);

export type ImportanceScoreRow = typeof importanceScores.$inferSelect;
export type NewImportanceScoreRow = typeof importanceScores.$inferInsert;
