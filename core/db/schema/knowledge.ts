import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Nodos tipados del Knowledge Graph Personal. Son la forma en que se
 * materializa la "memoria estructurada": hechos permanentes del usuario
 * como proyectos, objetivos, hábitos y personas, cada uno en su propia
 * tabla (nunca Entity-Attribute-Value). `metadata` es JSONB únicamente
 * para atributos flexibles que no ameritan columna propia.
 */
export const projects = pgTable(
  "projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("projects_user_id_idx").on(table.userId)],
);

export const goals = pgTable(
  "goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    targetDate: timestamp("target_date", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("goals_user_id_idx").on(table.userId)],
);

export const habits = pgTable(
  "habits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    frequency: text("frequency"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("habits_user_id_idx").on(table.userId)],
);

export const people = pgTable(
  "people",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    relationship: text("relationship"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("people_user_id_idx").on(table.userId)],
);

export const insightTypeEnum = pgEnum("insight_type", [
  "pattern",
  "preference",
  "fact",
  "risk",
  "recommendation",
]);

export const insightStatusEnum = pgEnum("insight_status", [
  "proposed",
  "validated",
  "rejected",
]);

/**
 * Conocimiento derivado. El LLM nunca escribe aquí directamente: solo el
 * Knowledge Engine, después de la etapa explícita de Validate
 * (ver core/knowledge/pipeline), persiste una fila con su nivel de
 * confianza. La evidencia que sustenta cada insight vive en la tabla
 * `evidence` (relations.ts), nunca embebida como texto libre.
 */
export const insights = pgTable(
  "insights",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: insightTypeEnum("type").notNull(),
    description: text("description").notNull(),
    confidence: integer("confidence").notNull(),
    status: insightStatusEnum("status").notNull().default("proposed"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
  },
  (table) => [
    check(
      "insights_confidence_range",
      sql`${table.confidence} >= 0 AND ${table.confidence} <= 100`,
    ),
    index("insights_user_id_idx").on(table.userId),
    index("insights_status_idx").on(table.status),
  ],
);

export type InsightType = (typeof insightTypeEnum.enumValues)[number];
export type InsightStatus = (typeof insightStatusEnum.enumValues)[number];

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
export type Habit = typeof habits.$inferSelect;
export type NewHabit = typeof habits.$inferInsert;
export type Person = typeof people.$inferSelect;
export type NewPerson = typeof people.$inferInsert;
export type Insight = typeof insights.$inferSelect;
export type NewInsight = typeof insights.$inferInsert;
