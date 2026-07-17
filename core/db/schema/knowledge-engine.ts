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
} from "drizzle-orm/pg-core";
import { lifeGraphs } from "./life-graph";

/**
 * Tablas del nuevo `core/knowledge-engine` (ADR-0014, PR-5) — nombradas
 * `knowledge_engine_*`, no `insights`/`evidence`, porque esos nombres ya
 * los usa `knowledge.ts` (legado, `userId`-escalado, consumido hoy por
 * `core/knowledge/` y `worker/index.ts`, Fase A/B de ADR-0014: no se
 * toca). Coexisten sin colisión hasta que la Fase C (todavía no
 * autorizada) retire las tablas viejas y estas puedan tomar los nombres
 * definitivos. Enums duplicados con nombre propio por la misma razón —
 * ningún objeto de Postgres compartido con el schema legado, para que
 * la Fase C pueda borrar este archivo entero sin desenredar nada.
 */

export const knowledgeEngineInsightTypeEnum = pgEnum(
  "knowledge_engine_insight_type",
  ["pattern", "preference", "fact", "risk", "recommendation"],
);

export const knowledgeEngineInsightStatusEnum = pgEnum(
  "knowledge_engine_insight_status",
  ["proposed", "validated", "rejected"],
);

/**
 * Espeja `core/knowledge-engine/entities/insight.ts` exactamente.
 * `confidenceScore`/`confidenceAssignedAt` son el `Confidence` value
 * object aplanado en dos columnas — ambas `NOT NULL`, sin par opcional
 * como `memories.rank_score`/`ranked_at`: `Insight.confidence` nunca es
 * opcional en el dominio (comentario de la entidad: "nunca se persiste
 * un insight sin validar"), así que no hace falta el check de pareja
 * que sí necesita Memory. Sin `.default("proposed")` en `status` —a
 * diferencia de la tabla legada— porque ninguna fila de esta tabla
 * debería insertarse sin que Validate ya haya decidido.
 */
export const knowledgeEngineInsights = pgTable(
  "knowledge_engine_insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references(() => lifeGraphs.id, { onDelete: "cascade" }),
    type: knowledgeEngineInsightTypeEnum("type").notNull(),
    description: text("description").notNull(),
    confidenceScore: integer("confidence_score").notNull(),
    confidenceAssignedAt: timestamp("confidence_assigned_at", {
      withTimezone: true,
    }).notNull(),
    status: knowledgeEngineInsightStatusEnum("status").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
  },
  (table) => [
    index("knowledge_engine_insights_life_graph_id_idx").on(
      table.lifeGraphId,
    ),
    index("knowledge_engine_insights_status_idx").on(table.status),
    check(
      "knowledge_engine_insights_confidence_score_range",
      sql`${table.confidenceScore} >= 0 AND ${table.confidenceScore} <= 100`,
    ),
  ],
);

export type KnowledgeEngineInsightRow =
  typeof knowledgeEngineInsights.$inferSelect;
export type NewKnowledgeEngineInsightRow =
  typeof knowledgeEngineInsights.$inferInsert;

/**
 * Espeja `core/knowledge-engine/entities/evidence.ts`. `memoryId` es
 * `uuid` SIN referencia foránea a propósito, misma razón que la propia
 * entidad ya documenta: Knowledge no importa ningún tipo de
 * `core/memory-engine`, ni siquiera aquí, y el id se mantiene neutral
 * para cuando exista evidencia no proveniente de Memory (Gmail,
 * Calendar, Drive, Health, sensores, ubicación — ver el docblock de
 * `InsightRelationshipStrategy`, aclaración arquitectónica previa a
 * este PR). Un FK real fijaría permanentemente "evidencia = fila de
 * `memories`", exactamente lo que esa aclaración dice que el contrato
 * no debe presuponer. La integridad referencial de este campo es
 * responsabilidad del código de dominio, no de la base de datos — mismo
 * criterio ya documentado para `entity_relations`/`evidence` legados en
 * `entity-type.ts`.
 */
export const knowledgeEngineEvidence = pgTable(
  "knowledge_engine_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references(() => lifeGraphs.id, { onDelete: "cascade" }),
    insightId: uuid("insight_id")
      .notNull()
      .references(() => knowledgeEngineInsights.id, { onDelete: "cascade" }),
    memoryId: uuid("memory_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("knowledge_engine_evidence_insight_id_idx").on(table.insightId),
    index("knowledge_engine_evidence_life_graph_id_idx").on(
      table.lifeGraphId,
    ),
  ],
);

export type KnowledgeEngineEvidenceRow =
  typeof knowledgeEngineEvidence.$inferSelect;
export type NewKnowledgeEngineEvidenceRow =
  typeof knowledgeEngineEvidence.$inferInsert;

/**
 * Espeja `core/knowledge-engine/entities/insight-relationship.ts`.
 * `fromInsightId`/`toInsightId` sí llevan FK real — a diferencia de
 * `memoryId` en evidence, esto es una arista Insight→Insight, enteramente
 * interna al aggregate de Knowledge, sin la misma razón para quedar
 * neutral. Sin constraint de unicidad sobre el par, mismo criterio que
 * `memory_connections`: varias conexiones distintas a través del tiempo
 * pueden ser señal real, deduplicar es decisión de la estrategia, no
 * del schema.
 */
export const knowledgeEngineInsightRelationships = pgTable(
  "knowledge_engine_insight_relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references(() => lifeGraphs.id, { onDelete: "cascade" }),
    fromInsightId: uuid("from_insight_id")
      .notNull()
      .references(() => knowledgeEngineInsights.id, { onDelete: "cascade" }),
    toInsightId: uuid("to_insight_id")
      .notNull()
      .references(() => knowledgeEngineInsights.id, { onDelete: "cascade" }),
    relationType: text("relation_type").notNull(),
    strength: integer("strength"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("knowledge_engine_insight_relationships_life_graph_id_idx").on(
      table.lifeGraphId,
    ),
    index("knowledge_engine_insight_relationships_from_insight_id_idx").on(
      table.fromInsightId,
    ),
    index("knowledge_engine_insight_relationships_to_insight_id_idx").on(
      table.toInsightId,
    ),
    check(
      "knowledge_engine_insight_relationships_strength_range",
      sql`${table.strength} IS NULL OR (${table.strength} >= 0 AND ${table.strength} <= 100)`,
    ),
  ],
);

export type KnowledgeEngineInsightRelationshipRow =
  typeof knowledgeEngineInsightRelationships.$inferSelect;
export type NewKnowledgeEngineInsightRelationshipRow =
  typeof knowledgeEngineInsightRelationships.$inferInsert;
