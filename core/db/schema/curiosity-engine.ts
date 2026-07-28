import { sql } from "drizzle-orm";
import { check, index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { lifeGraphs } from "./life-graph";
import type { LifeDomainType } from "../../life/value-objects/life-domain-type";

/**
 * `core/curiosity-engine` -- una `CuriosityQuestion` es una pregunta
 * concreta que LUZ querría hacer sobre un área de vida todavía poco
 * entendida (`core/knowledge-gaps`), generada por
 * `AICuriosityQuestionGenerationStrategy` y ofrecida a la conversación
 * vía `CuriosityStrategyRule`. A lo sumo una `pending` por LifeGraph a
 * la vez -- no un backlog que crece, una sola curiosidad activa
 * (`curiosity_questions_life_graph_id_pending_idx` respalda esa
 * consulta, la integridad real la impone `generateCuriosityQuestion`,
 * no una constraint -- mismo criterio que "Belief" para su propio
 * ciclo de vida).
 */
export const curiosityQuestionStatusEnum = pgEnum("curiosity_question_status", [
  "pending",
  "resolved",
  "dismissed",
]);

export const curiosityQuestions = pgTable(
  "curiosity_questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references(() => lifeGraphs.id, { onDelete: "cascade" }),
    domain: text("domain").notNull().$type<LifeDomainType>(),
    question: text("question").notNull(),
    rationale: text("rationale").notNull(),
    status: curiosityQuestionStatusEnum("status").notNull().default("pending"),
    coverageScoreAtCreation: integer("coverage_score_at_creation").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => [
    index("curiosity_questions_life_graph_id_idx").on(table.lifeGraphId),
    index("curiosity_questions_life_graph_id_status_idx").on(table.lifeGraphId, table.status),
    check(
      "curiosity_questions_coverage_score_range",
      sql`${table.coverageScoreAtCreation} >= 0 AND ${table.coverageScoreAtCreation} <= 100`,
    ),
  ],
);

export type CuriosityQuestionRow = typeof curiosityQuestions.$inferSelect;
export type NewCuriosityQuestionRow = typeof curiosityQuestions.$inferInsert;
