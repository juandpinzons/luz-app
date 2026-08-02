import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { lifeGraphs } from "./life-graph";

/**
 * Estado único de "ya visto/resuelto" para cualquier sugerencia puntual
 * que LUZ le muestra a una persona -- reemplaza mecanismos ad-hoc
 * separados (uno por tipo de sugerencia) por uno solo, genérico y
 * reutilizable (`docs/product/ALPHA_EXPERIENCE_V1_DESIGN.md` §5.3).
 * Primer uso real: no repetir un seguimiento de intención abierta ni un
 * reconocimiento de cierre ya mostrados (Conversation Strategy,
 * `reopen`/`acknowledge_closure`) -- pensado desde el inicio para que
 * usos futuros (Dashboard, Learning) reutilicen la misma tabla sin
 * diseño nuevo.
 */
export const seenPromptStatusEnum = pgEnum("seen_prompt_status", [
  "seen",
  "accepted",
  "edited",
  "dismissed",
]);

export const seenPrompts = pgTable(
  "seen_prompts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    lifeGraphId: uuid("life_graph_id")
      .notNull()
      .references(() => lifeGraphs.id, { onDelete: "cascade" }),
    /**
     * `subjectId` es deliberadamente un `uuid` sin `references()`: el
     * sujeto real cambia según `subjectType` (una Memory, un Goal, un
     * Project...) -- una FK fija apuntaría siempre a la tabla
     * equivocada para alguno de los casos. La integridad real la
     * garantiza quien escribe cada fila (capa de aplicación), nunca
     * Postgres aquí.
     */
    subjectType: text("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    status: seenPromptStatusEnum("status").notNull().default("seen"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (table) => [
    index("seen_prompts_life_graph_id_idx").on(table.lifeGraphId),
    /**
     * Única por (lifeGraphId, subjectType, subjectId) -- a lo sumo un
     * estado por sujeto; "marcar visto" es upsert, nunca inserta una
     * segunda fila para lo mismo.
     */
    uniqueIndex("seen_prompts_subject_idx").on(
      table.lifeGraphId,
      table.subjectType,
      table.subjectId,
    ),
  ],
);

export type SeenPromptRow = typeof seenPrompts.$inferSelect;
export type NewSeenPromptRow = typeof seenPrompts.$inferInsert;
