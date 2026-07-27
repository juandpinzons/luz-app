import {
  type AnyPgColumn,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { lifeGraphs } from "./life-graph";
import type { LifeDomainType } from "../../life/value-objects/life-domain-type";

/**
 * Persistencia real de `LifeDomain` (core/life/entities/life-domain.ts,
 * repositorio ya existente sin implementación Drizzle). Instancia por
 * `LifeGraph` de un área de vida (`LifeDomainType`) — separada del tag
 * `domain` que ya llevan `life_goals`/`life_projects`/`life_habits`/
 * `life_routines` (esa columna clasifica UNA entidad; esta tabla guarda
 * el estado agregado DEL área en sí: prioridad, notas). Fila creada de
 * forma perezosa (get-or-create), nunca backfillada de una vez para
 * los ocho dominios de todos los LifeGraph existentes — un dominio sin
 * fila todavía simplemente no ha sido priorizado/anotado, no significa
 * "no existe".
 */
export const lifeDomains = pgTable(
  "life_domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references((): AnyPgColumn => lifeGraphs.id, { onDelete: "cascade" }),
    type: text("type").notNull().$type<LifeDomainType>(),
    /** Prioridad relativa frente a las demás áreas de vida, 0-100. */
    priority: integer("priority"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("life_domains_life_graph_id_idx").on(table.lifeGraphId),
    /**
     * Una fila por (LifeGraph, tipo de dominio) — get-or-create depende
     * de esta unicidad (`onConflictDoUpdate` en el repositorio) para no
     * duplicar la instancia del área al primer priority/notes que
     * alguien le asigne.
     */
    uniqueIndex("life_domains_life_graph_id_type_idx").on(
      table.lifeGraphId,
      table.type,
    ),
  ],
);

export type LifeDomainRow = typeof lifeDomains.$inferSelect;
export type NewLifeDomainRow = typeof lifeDomains.$inferInsert;
