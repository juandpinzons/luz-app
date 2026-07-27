import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
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

/**
 * `core/knowledge-engine/reasoning` -- una conclusión razonada a partir
 * de VARIOS insights ya validados y correlacionados entre sí (nunca de
 * una sola pieza de evidencia: eso ya es el trabajo de `Insight`).
 * "Reasoning" es el siguiente nivel sobre Knowledge: Knowledge
 * interpreta UNA evidencia ("qué significa esto"), Reasoning combina
 * VARIAS interpretaciones ya validadas para concluir algo que ninguna
 * de ellas dice por sí sola. Mismo criterio que `knowledgeEngineInsights`:
 * `status` existe para soportar invalidación futura (Principio 4 --
 * probabilística, no permanente), pero ninguna fila se inserta sin que
 * Validate ya haya decidido -- sin `.default("validated")` a propósito,
 * igual que insights no tiene `.default("proposed")`.
 */
export const knowledgeEngineReasoningStatusEnum = pgEnum(
  "knowledge_engine_reasoning_status",
  ["validated", "invalidated"],
);

export const knowledgeEngineReasoningConclusions = pgTable(
  "knowledge_engine_reasoning_conclusions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references(() => lifeGraphs.id, { onDelete: "cascade" }),
    statement: text("statement").notNull(),
    confidenceScore: integer("confidence_score").notNull(),
    confidenceAssignedAt: timestamp("confidence_assigned_at", {
      withTimezone: true,
    }).notNull(),
    status: knowledgeEngineReasoningStatusEnum("status").notNull(),
    /**
     * Notas de incertidumbre explícitas -- lo que la conclusión NO
     * puede respaldar todavía, o qué la fortalecería/debilitaría
     * (Principio 3: explicabilidad completa, no solo para lo que LUZ
     * SÍ sabe). Arreglo de notas discretas, no un párrafo libre: cada
     * elemento es una afirmación de incertidumbre propia, consistente
     * con el resto del contrato (nunca texto libre sin estructura).
     */
    uncertaintyNotes: text("uncertainty_notes").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("knowledge_engine_reasoning_conclusions_life_graph_id_idx").on(
      table.lifeGraphId,
    ),
    index("knowledge_engine_reasoning_conclusions_status_idx").on(table.status),
    check(
      "knowledge_engine_reasoning_conclusions_confidence_score_range",
      sql`${table.confidenceScore} >= 0 AND ${table.confidenceScore} <= 100`,
    ),
  ],
);

export type KnowledgeEngineReasoningConclusionRow =
  typeof knowledgeEngineReasoningConclusions.$inferSelect;
export type NewKnowledgeEngineReasoningConclusionRow =
  typeof knowledgeEngineReasoningConclusions.$inferInsert;

/**
 * Evidencia de una conclusión de razonamiento -- una sola tabla para
 * evidencia de apoyo Y evidencia contradictoria (`role`), no dos
 * tablas separadas: ambas son la misma relación estructural (esta
 * pieza participó en el razonamiento), solo cambia su papel. `refType`
 * es texto libre sin FK real -- mismo criterio que
 * `knowledge_engine_evidence.memoryId`/`ContradictionRef`: hoy
 * `"insight"`/`"memory"`, preparado para `"belief"`/`"concept"` cuando
 * el Reasoning Engine se extienda a consumirlos directamente
 * (compatibilidad futura explícita, sin adelantar esa integración
 * todavía).
 */
export const knowledgeEngineReasoningEvidenceRoleEnum = pgEnum(
  "knowledge_engine_reasoning_evidence_role",
  ["supporting", "contradicting"],
);

export const knowledgeEngineReasoningEvidence = pgTable(
  "knowledge_engine_reasoning_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references(() => lifeGraphs.id, { onDelete: "cascade" }),
    conclusionId: uuid("conclusion_id")
      .notNull()
      .references((): AnyPgColumn => knowledgeEngineReasoningConclusions.id, {
        onDelete: "cascade",
      }),
    refType: text("ref_type").notNull(),
    refId: uuid("ref_id").notNull(),
    role: knowledgeEngineReasoningEvidenceRoleEnum("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("knowledge_engine_reasoning_evidence_conclusion_id_idx").on(
      table.conclusionId,
    ),
    index("knowledge_engine_reasoning_evidence_life_graph_id_idx").on(
      table.lifeGraphId,
    ),
    index("knowledge_engine_reasoning_evidence_ref_idx").on(
      table.refType,
      table.refId,
    ),
  ],
);

export type KnowledgeEngineReasoningEvidenceRow =
  typeof knowledgeEngineReasoningEvidence.$inferSelect;
export type NewKnowledgeEngineReasoningEvidenceRow =
  typeof knowledgeEngineReasoningEvidence.$inferInsert;
