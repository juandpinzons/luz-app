import { and, desc, eq, isNotNull } from "drizzle-orm";
import type { Database } from "../../../core/db/client";
import { conversations } from "../../../core/db/schema";
import type { ConversationVarietySnapshot } from "../domain/conversation-variety-snapshot";
import { computeConversationVariety } from "../services/compute-conversation-variety";

/**
 * Tope de conversaciones consideradas -- más grande que la ventana de
 * mi propio mecanismo de diversidad turno-a-turno
 * (`conversation-signal-log.ts`, 10 conversaciones: tipo de estrategia
 * y memoria/insight puntual, escala de días), más chico que el tope
 * de `list-conversations.ts` (200, para una pantalla completa):
 * "¿ha dominado un área de vida entera el último mes de
 * conversaciones?" es una pregunta de escala más larga que la primera
 * y no necesita todo el historial de la segunda. Primera iteración,
 * explícitamente ajustable.
 */
const VARIETY_WINDOW_SIZE = 30;

/**
 * Único archivo de todo el módulo que toca `Database` -- la frontera
 * anti-corrupción, mismo rol que `assemble-identity-evolution.ts`/
 * `assembleRealitySnapshot` cumplen para sus propios módulos.
 *
 * `category IS NOT NULL` es real, no cosmético:
 * `conversations.category` queda `null` hasta que la clasificación en
 * segundo plano corre (`generate-title.ts`, primer intercambio,
 * puede fallar en silencio) -- sin este filtro, la ventana se
 * contaminaría con filas sin categoría real, o (peor) Postgres las
 * ordenaría de forma indefinida frente al resto. Mismo índice que ya
 * usa `list-conversations.ts` (`conversations_user_id_created_at_idx`).
 */
export async function assembleConversationalVariety(
  db: Database,
  userId: string,
  now: Date = new Date(),
): Promise<ConversationVarietySnapshot> {
  const rows = await db
    .select({
      category: conversations.category,
      createdAt: conversations.createdAt,
    })
    .from(conversations)
    .where(and(eq(conversations.userId, userId), isNotNull(conversations.category)))
    .orderBy(desc(conversations.createdAt))
    .limit(VARIETY_WINDOW_SIZE);

  // `isNotNull` ya lo garantiza en SQL -- este `flatMap` es solo para
  // que TypeScript (Drizzle no angosta tipos a partir del `WHERE`) vea
  // `category` como no-nulo sin recurrir a una aserción.
  const entries = rows.flatMap((row) =>
    row.category ? [{ category: row.category, occurredAt: row.createdAt }] : [],
  );

  return computeConversationVariety(entries, now);
}
