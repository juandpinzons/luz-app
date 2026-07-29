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
import type { LifeDomainType } from "../../life/value-objects/life-domain-type";
import type { BeliefCategory } from "../../belief-engine/entities/belief";

/**
 * `core/belief-engine` — un `Belief` es una creencia sobre la persona
 * ("Juan es muy curioso"), consolidada a partir de uno o más
 * `Insight`s ya validados que apuntan repetidamente en la misma
 * dirección. Distinto de `Insight`: un Insight interpreta UNA pieza de
 * evidencia ("qué significa esto"); un Belief es la síntesis que
 * persiste y evoluciona a través de VARIOS insights a lo largo del
 * tiempo ("qué tan cierto sigue siendo esto, hoy, sumando todo lo que
 * sabemos"). Principio 4 (conocimiento probabilístico): `status`
 * cierra el ciclo de vida completo -- activo, expirado (se debilitó
 * hasta perder soporte) o retractado (una contradicción lo invalidó).
 * Si se está fortaleciendo o debilitando AHORA se deriva de
 * `belief_history` (comparar las últimas dos filas), nunca se cachea
 * como columna aparte -- una sola fuente de verdad para esa tendencia.
 */
export const beliefStatusEnum = pgEnum("belief_status", [
  "active",
  "expired",
  "retracted",
]);

export const beliefs = pgTable(
  "beliefs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references(() => lifeGraphs.id, { onDelete: "cascade" }),
    /**
     * A quién describe esta creencia -- casi siempre `context.personId`
     * (la persona dueña del LifeGraph), pero como texto neutral (no FK a
     * `persons`) para no cerrar la puerta a creencias sobre otras
     * personas del grafo (ej. relaciones) en una fase futura.
     */
    subjectPersonId: uuid("subject_person_id").notNull(),
    statement: text("statement").notNull(),
    domain: text("domain").$type<LifeDomainType>(),
    /**
     * Mismo criterio de tipado que `domain` (texto app-level, no un
     * pgEnum) -- default `'life_domain'` para que cada fila ya
     * existente (todas creencias sobre un área de vida, el único caso
     * hasta esta migración) se reclasifique correctamente sin
     * intervención manual, nunca `NULL` a partir de aquí en adelante.
     */
    category: text("category").$type<BeliefCategory>().notNull().default("life_domain"),
    status: beliefStatusEnum("status").notNull().default("active"),
    confidenceScore: integer("confidence_score").notNull(),
    confidenceAssignedAt: timestamp("confidence_assigned_at", {
      withTimezone: true,
    }).notNull(),
    firstObservedAt: timestamp("first_observed_at", { withTimezone: true }).notNull(),
    lastReinforcedAt: timestamp("last_reinforced_at", {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("beliefs_life_graph_id_idx").on(table.lifeGraphId),
    index("beliefs_life_graph_id_status_idx").on(table.lifeGraphId, table.status),
    check(
      "beliefs_confidence_score_range",
      sql`${table.confidenceScore} >= 0 AND ${table.confidenceScore} <= 100`,
    ),
  ],
);

export type BeliefRow = typeof beliefs.$inferSelect;
export type NewBeliefRow = typeof beliefs.$inferInsert;

/**
 * Evidencia de un Belief. `insightId` sin FK a propósito -- mismo
 * criterio que `knowledge_engine_evidence.memoryId`: hoy todo Belief
 * nace de un Insight, pero fijar la referencia a nivel de base de
 * datos asumiría que esa será para siempre la única fuente (una futura
 * corroboración directa desde un Connector, sin Insight de por medio,
 * no debería requerir una migración). Integridad referencial es
 * responsabilidad del código de dominio, mismo criterio ya establecido
 * en `entity-type.ts`.
 */
export const beliefEvidence = pgTable(
  "belief_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references(() => lifeGraphs.id, { onDelete: "cascade" }),
    beliefId: uuid("belief_id")
      .notNull()
      .references((): AnyPgColumn => beliefs.id, { onDelete: "cascade" }),
    insightId: uuid("insight_id"),
    memoryId: uuid("memory_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("belief_evidence_life_graph_id_idx").on(table.lifeGraphId),
    index("belief_evidence_belief_id_idx").on(table.beliefId),
  ],
);

export type BeliefEvidenceRow = typeof beliefEvidence.$inferSelect;
export type NewBeliefEvidenceRow = typeof beliefEvidence.$inferInsert;

/**
 * Historial append-only de cambios de confianza -- el "historial de
 * cambios" que el Belief Engine exige explícitamente (a diferencia de
 * `RealitySnapshot`, que el Principio 6 prohíbe convertir en log: un
 * Belief SÍ es el dueño legítimo de su propia evolución, no un cache
 * derivado). `previousConfidence` nulo únicamente en la primera fila
 * (el momento en que el Belief se crea, no hay "antes").
 */
export const beliefHistory = pgTable(
  "belief_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references(() => lifeGraphs.id, { onDelete: "cascade" }),
    beliefId: uuid("belief_id")
      .notNull()
      .references((): AnyPgColumn => beliefs.id, { onDelete: "cascade" }),
    previousConfidence: integer("previous_confidence"),
    newConfidence: integer("new_confidence").notNull(),
    changeReason: text("change_reason").notNull(),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("belief_history_life_graph_id_idx").on(table.lifeGraphId),
    index("belief_history_belief_id_idx").on(table.beliefId),
    check(
      "belief_history_new_confidence_range",
      sql`${table.newConfidence} >= 0 AND ${table.newConfidence} <= 100`,
    ),
  ],
);

export type BeliefHistoryRow = typeof beliefHistory.$inferSelect;
export type NewBeliefHistoryRow = typeof beliefHistory.$inferInsert;
