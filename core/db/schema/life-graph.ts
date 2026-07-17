import {
  type AnyPgColumn,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Aggregate root y frontera de tenencia del dominio (ADR-0011,
 * core/life/entities/life-graph.ts). `ownerPersonId` es nullable
 * únicamente a nivel de columna: LifeGraph y su Person dueño se
 * referencian mutuamente, así que life-graph-bootstrap.ts (Milestone 2)
 * crea primero este registro sin owner, luego el Person, y completa este
 * campo en la misma transacción — ningún LifeGraph queda visible fuera
 * de esa transacción con el campo vacío. El tipo de dominio
 * `LifeGraph.ownerPersonId` sigue siendo no-nulo.
 */
export const lifeGraphs = pgTable("life_graphs", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerPersonId: uuid("owner_person_id").references((): AnyPgColumn => persons.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Persona real, miembro de exactamente un LifeGraph (ADR-0011,
 * core/life/entities/person.ts). Distinta de la tabla `people` en
 * knowledge.ts, que sigue siendo un nodo del knowledge graph legado
 * escaneado por userId — migrarla a esta tabla es una decisión aparte,
 * fuera de alcance de este milestone.
 */
export const persons = pgTable(
  "persons",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references((): AnyPgColumn => lifeGraphs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("persons_life_graph_id_idx").on(table.lifeGraphId)],
);

export type LifeGraphRow = typeof lifeGraphs.$inferSelect;
export type NewLifeGraphRow = typeof lifeGraphs.$inferInsert;
export type PersonRow = typeof persons.$inferSelect;
export type NewPersonRow = typeof persons.$inferInsert;
