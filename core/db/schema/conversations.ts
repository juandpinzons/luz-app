import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";
import type { LifeDomainType } from "../../life";

export const messageRoleEnum = pgEnum("message_role", [
  "user",
  "assistant",
  "system",
]);

/**
 * Identidad de una conversación (Alpha Experience, "conversaciones con
 * identidad, no fechas") -- reutiliza `LifeDomainType` (el mismo
 * vocabulario que ya agrupa Goal/Project/Habit en `/life`), nunca una
 * segunda taxonomía paralela: una conversación sobre finanzas y un
 * Goal de finanzas deben leerse con la misma palabra en todo el
 * producto. `"general"` es el único valor que no viene de
 * `core/life` -- para lo que de verdad no encaja en ningún área de
 * vida (small talk, preguntas sobre quién es LUZ, etc.). `text().
 * $type<X>()`, no `pgEnum`: mismo criterio que `life-entities.ts` --
 * la validación real vive en la capa de dominio (`generate-title.ts`
 * decide el valor), nunca en una constraint de Postgres.
 */
export type ConversationCategory = LifeDomainType | "general";

/** Historial de chat. No debe confundirse con el diario (ver journal.ts). */
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title"),
    /** `null` hasta que el primer intercambio clasifica la conversación (ver `generate-title.ts`) -- mismo criterio de "ausencia real" que el resto del dominio. */
    category: text("category").$type<ConversationCategory>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("conversations_user_id_idx").on(table.userId),
    /**
     * Index Optimization (auditoría de las 45 tablas reales, evidencia en
     * docs/adr, no "por si acaso"): `getLatestConversation`
     * (`features/chat/services/get-latest-conversation.ts`) hace
     * exactamente `WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1` --
     * sin esta columna en el índice, Postgres ordena TODAS las
     * conversaciones del usuario antes de tomar la primera. Medido contra
     * un usuario sintético con 300 conversaciones: cost 34.85→0.59,
     * 0.146ms→0.033ms, el nodo `Sort` desaparece del plan por completo.
     */
    index("conversations_user_id_created_at_idx").on(table.userId, table.createdAt.desc()),
  ],
);

export const conversationMessages = pgTable(
  "conversation_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    // Ownership directo (Sprint 7): permite autorizar sin tener que unir
    // contra `conversations` en cada acceso, y deja cada entidad
    // consistente con el resto del dominio (todo pertenece a un usuario).
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: messageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("conversation_messages_conversation_id_idx").on(
      table.conversationId,
    ),
    index("conversation_messages_user_id_idx").on(table.userId),
    /**
     * Index Optimization: la consulta más caliente de todo el repo --
     * `send-message.ts` trae el historial reciente
     * (`WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 60`) en
     * CADA mensaje enviado, sin `created_at` en el índice existente
     * Postgres debe traer TODA la conversación y ordenarla antes de
     * recortar. Medido con una conversación sintética de 3000 mensajes
     * (una charla diaria de casi un año, el caso real que este producto
     * busca): cost 894.90→57.20, 0.559ms→0.098ms, `Sort` reemplazado por
     * `Index Scan Backward` que se detiene en el límite. Mismo índice
     * sirve `get-conversation-detail.ts` (orden ascendente) sin costo
     * adicional -- ninguna prueba mostró regresión ahí.
     */
    index("conversation_messages_conversation_id_created_at_idx").on(
      table.conversationId,
      table.createdAt,
    ),
  ],
);

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type ConversationMessage = typeof conversationMessages.$inferSelect;
export type NewConversationMessage = typeof conversationMessages.$inferInsert;
