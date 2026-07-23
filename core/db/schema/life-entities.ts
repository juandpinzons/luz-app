import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { lifeGraphs, persons } from "./life-graph";
import type {
  GoalStatus,
  LifeDomainType,
  ProjectStatus,
  RelationshipType,
  RoutineFrequency,
} from "../../life";

/**
 * Persistencia real de Goal/Project/Habit/Routine/Relationship
 * (core/life/entities/*.ts, DOMAIN_MODEL_V1.md — Accepted). Antes de
 * esto, `core/life` tenía las cinco entidades bien modeladas pero sin
 * ninguna tabla — `assemble-reality-snapshot.ts` hardcodeaba
 * `activeGoals`/`activeProjects`/`activeHabits` como arreglos vacíos.
 *
 * Prefijo `life_` en las cinco tablas (mismo criterio que ya usa
 * `life_graphs`, no `persons`): `goals`/`projects`/`habits` ya existen
 * como nombres de tabla reales en `knowledge.ts` (el Knowledge Graph
 * legado, escopado por `userId`, con cero consumidores — confirmado
 * antes de este cambio) — no se tocan ni se retiran aquí, eso es la
 * Fase C de ADR-0014, explícitamente no autorizada todavía. El prefijo
 * evita la colisión sin asumir esa decisión, y se aplica también a
 * `routines`/`relationships` (que no colisionan) para que las cinco
 * tablas de este módulo queden agrupadas de forma consistente.
 *
 * Los enums de dominio (`GoalStatus`, `ProjectStatus`, etc.) son
 * uniones de string en TypeScript, no tipos de Postgres — se usa
 * `text().$type<X>()` en vez de `pgEnum`, igual que el resto de
 * `life-graph.ts` (que no tiene ningún precedente de columna enum; la
 * única tabla del repo que usa `pgEnum` es la del Knowledge Engine
 * legado). La validación real de estos valores vive en la capa de
 * dominio, no en una constraint de la base de datos.
 */

export const lifeGoals = pgTable(
  "life_goals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references((): AnyPgColumn => lifeGraphs.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").notNull().$type<GoalStatus>().default("active"),
    domain: text("domain").$type<LifeDomainType>(),
    targetDate: timestamp("target_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("life_goals_life_graph_id_idx").on(table.lifeGraphId)],
);

export const lifeProjects = pgTable(
  "life_projects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references((): AnyPgColumn => lifeGraphs.id, { onDelete: "cascade" }),
    /** Objetivo al que este proyecto contribuye, si aplica. */
    goalId: uuid("goal_id").references((): AnyPgColumn => lifeGoals.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status")
      .notNull()
      .$type<ProjectStatus>()
      .default("planning"),
    domain: text("domain").$type<LifeDomainType>(),
    startDate: timestamp("start_date", { withTimezone: true }),
    dueDate: timestamp("due_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("life_projects_life_graph_id_idx").on(table.lifeGraphId),
    index("life_projects_goal_id_idx").on(table.goalId),
  ],
);

export const lifeHabits = pgTable(
  "life_habits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references((): AnyPgColumn => lifeGraphs.id, { onDelete: "cascade" }),
    goalId: uuid("goal_id").references((): AnyPgColumn => lifeGoals.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    description: text("description"),
    domain: text("domain").$type<LifeDomainType>(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("life_habits_life_graph_id_idx").on(table.lifeGraphId),
    index("life_habits_goal_id_idx").on(table.goalId),
  ],
);

export const lifeRoutines = pgTable(
  "life_routines",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references((): AnyPgColumn => lifeGraphs.id, { onDelete: "cascade" }),
    /** Poblado si la persona confirma que la rutina detectada corresponde a un hábito ya declarado. */
    habitId: uuid("habit_id").references((): AnyPgColumn => lifeHabits.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    frequency: text("frequency").notNull().$type<RoutineFrequency>(),
    domain: text("domain").$type<LifeDomainType>(),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("life_routines_life_graph_id_idx").on(table.lifeGraphId),
    index("life_routines_habit_id_idx").on(table.habitId),
  ],
);

export const lifeRelationships = pgTable(
  "life_relationships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references((): AnyPgColumn => lifeGraphs.id, { onDelete: "cascade" }),
    fromPersonId: uuid("from_person_id")
      .notNull()
      .references((): AnyPgColumn => persons.id, { onDelete: "cascade" }),
    toPersonId: uuid("to_person_id")
      .notNull()
      .references((): AnyPgColumn => persons.id, { onDelete: "cascade" }),
    type: text("type").notNull().$type<RelationshipType>(),
    /** Cercanía percibida, 0-100. */
    closeness: integer("closeness"),
    since: timestamp("since", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("life_relationships_life_graph_id_idx").on(table.lifeGraphId),
    index("life_relationships_from_to_idx").on(
      table.fromPersonId,
      table.toPersonId,
    ),
  ],
);

export type GoalRow = typeof lifeGoals.$inferSelect;
export type NewGoalRow = typeof lifeGoals.$inferInsert;
export type ProjectRow = typeof lifeProjects.$inferSelect;
export type NewProjectRow = typeof lifeProjects.$inferInsert;
export type HabitRow = typeof lifeHabits.$inferSelect;
export type NewHabitRow = typeof lifeHabits.$inferInsert;
export type RoutineRow = typeof lifeRoutines.$inferSelect;
export type NewRoutineRow = typeof lifeRoutines.$inferInsert;
export type RelationshipRow = typeof lifeRelationships.$inferSelect;
export type NewRelationshipRow = typeof lifeRelationships.$inferInsert;
