import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Respuestas del formulario breve de feedback (Alpha, P3-2 adelantado
 * a pedido del Founder). Tabla propia, no un evento genérico en
 * `events` — una opinión real con texto libre es dato de dominio, no
 * un log operacional (mismo criterio que separa `events` de
 * `conversation_messages`). Una persona puede enviar más de una
 * respuesta a lo largo del tiempo — el valor real está en la
 * tendencia, no en una sola foto (ver `docs/product/HUMAN_EXPERIENCE_DATASET_V1.md`).
 */
export const feedbackRemembersMeEnum = pgEnum("feedback_remembers_me", [
  "yes",
  "no",
  "unsure",
]);

/**
 * RESPONSE_READING_GUIDELINES_V1.md -- la señal real que ese documento
 * necesita para saber cuándo revisar transcripciones, en vez de
 * inventar reglas nuevas sin evidencia. Nullable/opcional, igual que
 * `comment`: la persona puede no tener una opinión sobre esto en
 * particular sin que eso bloquee el resto del formulario.
 */
export const feedbackResponseLengthEnum = pgEnum("feedback_response_length", [
  "too_long",
  "just_right",
  "too_short",
]);

export const feedbackResponses = pgTable(
  "feedback_responses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** 1 (nada útil) a 5 (muy útil). */
    helpfulness: integer("helpfulness").notNull(),
    remembersMe: feedbackRemembersMeEnum("remembers_me").notNull(),
    responseLength: feedbackResponseLengthEnum("response_length"),
    comment: text("comment"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("feedback_responses_user_id_idx").on(table.userId),
    index("feedback_responses_created_at_idx").on(table.createdAt),
  ],
);

export type FeedbackResponse = typeof feedbackResponses.$inferSelect;
export type NewFeedbackResponse = typeof feedbackResponses.$inferInsert;
