import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  index,
} from "drizzle-orm/pg-core";
import { lifeGraphs } from "./life-graph";
import type { LifeDomainType } from "../../life/value-objects/life-domain-type";

/**
 * `core/contradiction-engine` -- una tensión detectada entre dos
 * elementos ya conocidos de la persona (dos Beliefs, un Belief y un
 * Goal, un Goal y un Habit...). Polimórfico sobre ambos extremos
 * (`leftRefType`/`leftRefId`, `rightRefType`/`rightRefId`), sin FK real
 * -- mismo criterio que `entity_relations` (`core/db/schema/relations.ts`):
 * los dos extremos pueden ser de dominios distintos (`core/life`,
 * `core/knowledge-engine`, `core/belief-engine`), un FK real acoplaría
 * esta tabla a un solo tipo de origen. Nunca es para juzgar (ver
 * docblock de `detect-contradictions.ts`) -- es para entender mejor,
 * `status` sigue ese espíritu: `resolved`/`dismissed` con
 * `resolutionNote`, nunca un simple booleano "resuelto sí/no".
 */
export const contradictionStatusEnum = pgEnum("contradiction_status", [
  "open",
  "acknowledged",
  "resolved",
  "dismissed",
]);

export const contradictions = pgTable(
  "contradictions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references(() => lifeGraphs.id, { onDelete: "cascade" }),
    /** Texto libre, ej. "belief_belief", "goal_habit" -- mismo criterio que `relation_type` en otras tablas. */
    kind: text("kind").notNull(),
    leftRefType: text("left_ref_type").notNull(),
    leftRefId: uuid("left_ref_id").notNull(),
    rightRefType: text("right_ref_type").notNull(),
    rightRefId: uuid("right_ref_id").notNull(),
    description: text("description").notNull(),
    domain: text("domain").$type<LifeDomainType>(),
    status: contradictionStatusEnum("status").notNull().default("open"),
    resolutionNote: text("resolution_note"),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("contradictions_life_graph_id_idx").on(table.lifeGraphId),
    index("contradictions_life_graph_id_status_idx").on(
      table.lifeGraphId,
      table.status,
    ),
    index("contradictions_left_ref_idx").on(table.leftRefType, table.leftRefId),
    index("contradictions_right_ref_idx").on(table.rightRefType, table.rightRefId),
  ],
);

export type ContradictionRow = typeof contradictions.$inferSelect;
export type NewContradictionRow = typeof contradictions.$inferInsert;
