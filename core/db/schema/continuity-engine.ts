import { sql } from "drizzle-orm";
import { type AnyPgColumn, check, index, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { lifeGraphs } from "./life-graph";
import type { LoopEvidenceKind, LoopOutcomeKind, LoopRelatedEntity } from "../../continuity-engine/domain/continuity-loop";
import type { LoopOrigin } from "../../continuity-engine/domain/loop-origin";
import type { LoopPriority } from "../../continuity-engine/domain/loop-priority";
import type { LoopReason } from "../../continuity-engine/domain/loop-reason";
import type { LoopState } from "../../continuity-engine/domain/loop-state";

/**
 * `core/continuity-engine` -- un `ContinuityLoop` es un asunto real que
 * LUZ decidió mantener vivo hasta un desenlace real (misión "Continuity
 * System Foundation"). Ver `core/continuity-engine/README.md` para el
 * dominio completo.
 *
 * `origin`/`reason`/`state`/`priority` son `text().$type<X>()`, NUNCA
 * `pgEnum` -- mismo criterio ya adoptado por `calendar_connections`
 * (`calendar-connections.ts`, la tabla más reciente de este patrón, no
 * `belief_status`/`curiosity_question_status`, que son de una fase
 * anterior): la validación real vive en la capa de dominio
 * (`LOOP_STATES`/`LOOP_ALLOWED_TRANSITIONS`, etc.), nunca en una
 * constraint de Postgres. La misión describe este vocabulario de
 * estados como un EJEMPLO explícitamente adaptable ("Example:", no
 * "Exactly:") -- `pgEnum` exigiría una migración `ALTER TYPE` para
 * cualquier ajuste futuro; `text` no.
 *
 * Dos tablas, mismo patrón que `beliefs`/`belief_history`
 * (`belief-engine.ts`) -- el precedente estructural más cercano: un
 * aggregate que evoluciona con el tiempo necesita su propio historial
 * append-only, no una sola fila que se sobrescribe. `continuity_loops`
 * es el estado ACTUAL (una fila por loop); `continuity_loop_history`
 * es CADA transición real que ese loop tuvo, nunca reescrita.
 */
export const continuityLoops = pgTable(
  "continuity_loops",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references(() => lifeGraphs.id, { onDelete: "cascade" }),
    origin: text("origin").notNull().$type<LoopOrigin>(),
    reason: text("reason").notNull().$type<LoopReason>(),
    /** Puntero opaco al hecho real que originó este loop -- `EntityId` (Goal/Memory/...) o un id de proveedor externo (Gmail/Calendar) según `origin`. Nunca interpretado por este schema. */
    triggerSourceId: text("trigger_source_id").notNull(),
    triggerSummary: text("trigger_summary").notNull(),
    triggerDetectedAt: timestamp("trigger_detected_at", { withTimezone: true }).notNull(),
    title: text("title").notNull(),
    state: text("state").notNull().$type<LoopState>().default("open"),
    priority: text("priority").notNull().$type<LoopPriority>().default("medium"),
    /** `LoopRelatedEntity[]` -- referencias mínimas (kind/id/title) de vuelta a filas reales, mismo criterio que `users.metadata`: único lugar permitido para datos estructurados flexibles, nunca un sustituto de una tabla propia (aquí, un arreglo pequeño y acotado, no una colección que crece sin límite). */
    relatedEntities: jsonb("related_entities").notNull().$type<readonly LoopRelatedEntity[]>().default([]),
    nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
    followUpAttempts: integer("follow_up_attempts").notNull().default(0),
    /** Presente únicamente cuando `state` es terminal -- ver `LoopResolution` (dominio). Columnas planas en vez de un JSONB de resolución: cada una necesita su propio índice/consulta potencial (p. ej. reportar por `outcomeKind`), un JSONB anidado no lo permitiría sin expresiones adicionales. */
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    /** La evidencia que causó el cierre, duplicada aquí desde la última fila de `continuity_loop_history` a propósito -- "¿por qué está cerrado esto?" es una pregunta que cualquier consumidor de un loop resuelto hace casi siempre; exigir un join contra el historial completo solo para responderla sería pagar por el caso común para servir el raro (ver `getHistory` para la traza completa, que sí exige esa consulta aparte). */
    resolutionEvidenceKind: text("resolution_evidence_kind").$type<LoopEvidenceKind>(),
    resolutionEvidenceDescription: text("resolution_evidence_description"),
    resolutionEvidenceSourceId: text("resolution_evidence_source_id"),
    outcomeKind: text("outcome_kind").$type<LoopOutcomeKind>(),
    outcomeSummary: text("outcome_summary"),
    /**
     * Autorreferencia SIN `references()` a propósito -- mismo criterio
     * que `belief_evidence.insightId`/`memoryId`: integridad referencial
     * es responsabilidad del dominio (`transitionLoop` exige este campo
     * cuando `toState === "transformed"`), no de una constraint. Un
     * ciclo de FK autorreferenciado NOT NULL-safe añadiría complejidad
     * real (`AnyPgColumn`, orden de creación) para un campo que es
     * `NULL` en el 100% de las filas salvo el caso raro "transformed".
     */
    transformedIntoLoopId: uuid("transformed_into_loop_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("continuity_loops_life_graph_id_idx").on(table.lifeGraphId),
    /** `listByState` (`../repositories/drizzle-continuity-loop.repository.ts`) -- la consulta de "qué está abierto ahora mismo" que cualquier consumidor (Presence/Dashboard/Daily Reflection) hace en cada visita. */
    index("continuity_loops_life_graph_id_state_idx").on(table.lifeGraphId, table.state),
    /** `listDueForFollowUp` -- `WHERE life_graph_id=$1 AND next_follow_up_at <= now()`, la otra consulta caliente (el "reloj" de Continuity). */
    index("continuity_loops_life_graph_id_next_follow_up_idx").on(table.lifeGraphId, table.nextFollowUpAt),
    check("continuity_loops_follow_up_attempts_range", sql`${table.followUpAttempts} >= 0`),
  ],
);

export type ContinuityLoopRow = typeof continuityLoops.$inferSelect;
export type NewContinuityLoopRow = typeof continuityLoops.$inferInsert;

/**
 * Historial append-only de transiciones -- mismo rol que
 * `belief_history` para `beliefs`. `fromState` nulo únicamente en la
 * fila de creación (no había estado "antes").
 */
export const continuityLoopHistory = pgTable(
  "continuity_loop_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references(() => lifeGraphs.id, { onDelete: "cascade" }),
    loopId: uuid("loop_id")
      .notNull()
      .references((): AnyPgColumn => continuityLoops.id, { onDelete: "cascade" }),
    fromState: text("from_state").$type<LoopState>(),
    toState: text("to_state").notNull().$type<LoopState>(),
    evidenceKind: text("evidence_kind").notNull().$type<LoopEvidenceKind>(),
    evidenceDescription: text("evidence_description").notNull(),
    evidenceSourceId: text("evidence_source_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("continuity_loop_history_life_graph_id_idx").on(table.lifeGraphId),
    index("continuity_loop_history_loop_id_idx").on(table.loopId, table.occurredAt),
  ],
);

export type ContinuityLoopHistoryRow = typeof continuityLoopHistory.$inferSelect;
export type NewContinuityLoopHistoryRow = typeof continuityLoopHistory.$inferInsert;
