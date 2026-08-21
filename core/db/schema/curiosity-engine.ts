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
    /**
     * Cuántas veces `CuriosityStrategyRule` de verdad incluyó esta
     * pregunta como candidata en un turno -- un hecho que el sistema
     * puede confirmar (su propia acción), a diferencia de "se
     * verbalizó" (el LLM puede parafrasear o saltarla, ver docblock de
     * arriba sobre Principio 3). Al llegar a `MAX_CURIOSITY_OFFERS`
     * (`curiosity-strategy-rule.ts` / `send-message.ts`), la pregunta se
     * marca `dismissed` -- mismo estado que "superada por una más
     * reciente", solo que esta vez la supera el propio límite de
     * ofrecimientos.
     */
    timesOffered: integer("times_offered").notNull().default(0),
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
