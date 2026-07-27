import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { lifeGraphs } from "./life-graph";
import type { LifeDomainType } from "../../life/value-objects/life-domain-type";

/**
 * `core/concept-graph` — conecta CONCEPTOS ("Disciplina", "Confianza",
 * "Liderazgo"), no solo eventos/memorias (eso ya lo hace
 * `memory_connections`) ni insights concretos sobre evidencia concreta
 * (eso ya lo hace `knowledge_engine_insight_relationships`). Un
 * `Concept` es la abstracción que varios insights/memorias distintos
 * pueden estar todos señalando ("ir al gym" + "terminar el proyecto a
 * tiempo" + "decir que no a un plan" pueden ser evidencia distinta del
 * mismo concepto "Disciplina"). Mismo patrón de nombres/escopado que
 * `knowledge-engine.ts`: todo `life_graph_id`, evidencia sin FK real
 * (neutral sobre su origen).
 */
export const concepts = pgTable(
  "concepts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references(() => lifeGraphs.id, { onDelete: "cascade" }),
    /** Etiqueta corta, ej. "Disciplina" — no una frase completa (eso es `Insight.description`). */
    label: text("label").notNull(),
    description: text("description"),
    domain: text("domain").$type<LifeDomainType>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("concepts_life_graph_id_idx").on(table.lifeGraphId),
    index("concepts_life_graph_id_label_idx").on(table.lifeGraphId, table.label),
  ],
);

export type ConceptRow = typeof concepts.$inferSelect;
export type NewConceptRow = typeof concepts.$inferInsert;

/**
 * Arista dirigida entre dos conceptos — "Gym → Disciplina" es distinto
 * de "Disciplina → Gym". `relationType` es texto libre (mismo criterio
 * que `LifeEdge.relationType`, `core/life/graph/life-edge.ts`): el
 * vocabulario de cómo un concepto lleva a otro ("lleva_a",
 * "fortalece", "es_parte_de", "requiere") crece con lo que la IA
 * proponga y LUZ valide, no debe forzarse a un enum cerrado desde el
 * día uno. Sin unicidad sobre el par — mismo criterio que
 * `memory_connections`/`knowledge_engine_insight_relationships`:
 * varias observaciones del mismo vínculo a través del tiempo son señal
 * de refuerzo, no ruido a deduplicar en el schema.
 */
export const conceptRelations = pgTable(
  "concept_relations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references(() => lifeGraphs.id, { onDelete: "cascade" }),
    fromConceptId: uuid("from_concept_id")
      .notNull()
      .references((): AnyPgColumn => concepts.id, { onDelete: "cascade" }),
    toConceptId: uuid("to_concept_id")
      .notNull()
      .references((): AnyPgColumn => concepts.id, { onDelete: "cascade" }),
    relationType: text("relation_type").notNull(),
    /** Fuerza percibida del vínculo, 0-100. */
    strength: integer("strength"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("concept_relations_life_graph_id_idx").on(table.lifeGraphId),
    index("concept_relations_from_concept_id_idx").on(table.fromConceptId),
    index("concept_relations_to_concept_id_idx").on(table.toConceptId),
    check(
      "concept_relations_strength_range",
      sql`${table.strength} IS NULL OR (${table.strength} >= 0 AND ${table.strength} <= 100)`,
    ),
  ],
);

export type ConceptRelationRow = typeof conceptRelations.$inferSelect;
export type NewConceptRelationRow = typeof conceptRelations.$inferInsert;

/**
 * Por qué LUZ cree que este concepto aplica a esta persona —
 * explicabilidad (Principio 3). `insightId` SÍ lleva FK real (el
 * concepto nace de un Insight ya validado, nunca directo de una
 * memoria cruda); `memoryId` viaja también, sin FK, para que la
 * evidencia final (lo que de verdad se le muestra al usuario al
 * expandir el nodo) no dependa de una segunda consulta a
 * `knowledge_engine_evidence`.
 */
export const conceptEvidence = pgTable(
  "concept_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references(() => lifeGraphs.id, { onDelete: "cascade" }),
    conceptId: uuid("concept_id")
      .notNull()
      .references((): AnyPgColumn => concepts.id, { onDelete: "cascade" }),
    insightId: uuid("insight_id"),
    memoryId: uuid("memory_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("concept_evidence_life_graph_id_idx").on(table.lifeGraphId),
    index("concept_evidence_concept_id_idx").on(table.conceptId),
  ],
);

export type ConceptEvidenceRow = typeof conceptEvidence.$inferSelect;
export type NewConceptEvidenceRow = typeof conceptEvidence.$inferInsert;
