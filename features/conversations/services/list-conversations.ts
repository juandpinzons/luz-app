import { and, asc, count, desc, eq, ilike, inArray, max } from "drizzle-orm";
import type { Database } from "../../../core/db/client";
import { conversationMessages, conversations } from "../../../core/db/schema";
import type { ConversationCategory } from "../../../core/db/schema/conversations";
import type { UserContext } from "../../../core/identity/user-context";

const PREVIEW_MAX_LENGTH = 80;
/**
 * Auditoría de Experiencia V1 (hallazgo H7): esta consulta no tenía
 * ningún límite -- alguien con meses de uso diario podría, en teoría,
 * traer cientos de filas en una sola carga de `/conversations`. Un
 * número de página no es la forma correcta de resolverlo ahora que la
 * página agrupa por categoría (partiría un grupo de forma arbitraria a
 * mitad de página) -- eso queda para un diseño propio. Esto es solo la
 * red de seguridad de escala: un tope generoso que hoy no le cambia
 * nada a ningún usuario real (el más activo de Alpha está lejísimos de
 * esta cifra), pero evita que la consulta crezca sin límite con el
 * tiempo. `firstMessages` se acota a las mismas conversaciones ya
 * traídas por `stats` -- nunca escanea el historial completo de
 * mensajes del usuario para armar el preview de conversaciones que ni
 * siquiera se van a mostrar.
 */
const CONVERSATION_LIST_LIMIT = 200;

export interface ConversationListItem {
  id: string;
  createdAt: Date;
  lastMessageAt: Date;
  messageCount: number;
  previewText: string;
  /** `null` hasta que el título automático corre (primer intercambio) o si falló — ver `generate-title.ts`. `previewText` sigue siendo el respaldo. */
  title: string | null;
  /** `null` en la misma ventana que `title` -- se clasifica en la misma llamada de IA, nunca por separado. */
  category: ConversationCategory | null;
}

export interface ListConversationsOptions {
  /** Busca por contenido de cualquier mensaje (incluye el primero, el del preview). */
  searchTerm?: string;
}

function truncate(text: string, maxLength: number): string {
  const trimmed = text.trim();
  return trimmed.length <= maxLength
    ? trimmed
    : `${trimmed.slice(0, maxLength).trimEnd()}…`;
}

/** Escapa los comodines de ILIKE (`%`, `_`, `\`) para que la búsqueda trate el término como texto literal. */
function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Subconsulta (nunca un `await` propio — se embebe con `inArray` en las
 * dos consultas de abajo, así que buscar no agrega una tercera consulta):
 * ids de conversación con al menos un mensaje que matchea el término,
 * acotado al usuario. Se construye dos veces (una por cada uso) porque
 * un query builder de Drizzle no es seguro de reutilizar entre dos
 * consultas distintas.
 */
function matchingConversationIdsSubquery(
  db: Database,
  userId: string,
  searchTerm: string,
) {
  return db
    .select({ id: conversationMessages.conversationId })
    .from(conversationMessages)
    .where(
      and(
        eq(conversationMessages.userId, userId),
        ilike(
          conversationMessages.content,
          `%${escapeLikePattern(searchTerm)}%`,
        ),
      ),
    );
}

/**
 * Historial de conversaciones (Sprint Alpha-1b) — solo las del usuario
 * autenticado, ordenadas por última actividad real (el mensaje más
 * reciente, no `conversations.updatedAt`: esa columna nunca se toca
 * después de crear la fila, `send-message.ts` no la actualiza).
 *
 * Dos consultas, ambas acotadas por índice existente
 * (`conversation_messages_user_id_idx`,
 * `conversation_messages_conversation_id_idx`): una agregada para
 * conteo/última actividad, y un `selectDistinctOn` para el primer
 * mensaje de cada conversación (el preview) — nunca traer el historial
 * completo solo para mostrar una lista.
 *
 * Excluye conversaciones sin ningún mensaje: no hay nada real que
 * previsualizar ni que abrir en el detalle, y `sendMessage` siempre
 * crea la conversación junto con su primer mensaje, así que en la
 * práctica no debería ocurrir — se filtra de todas formas en vez de
 * mostrar una tarjeta vacía.
 *
 * `options.searchTerm` (Sprint Alpha-1c): busca por contenido de
 * cualquier mensaje de la conversación — el preview es simplemente el
 * primer mensaje, así que ya queda cubierto por esta misma búsqueda,
 * sin una condición separada. Sin término, `conversationsFilter`/
 * `messagesFilter` quedan como el `eq` simple de siempre — nunca se
 * ejecuta lógica de búsqueda de más. Con término, el filtro es una
 * subconsulta embebida (`inArray`), nunca una tercera consulta ni un
 * loop por conversación.
 */
export async function listConversations(
  db: Database,
  context: UserContext,
  options: ListConversationsOptions = {},
): Promise<ConversationListItem[]> {
  const searchTerm = options.searchTerm?.trim();

  const conversationsFilter = searchTerm
    ? and(
        eq(conversations.userId, context.userId),
        inArray(
          conversations.id,
          matchingConversationIdsSubquery(db, context.userId, searchTerm),
        ),
      )
    : eq(conversations.userId, context.userId);

  const messagesFilter = searchTerm
    ? and(
        eq(conversationMessages.userId, context.userId),
        inArray(
          conversationMessages.conversationId,
          matchingConversationIdsSubquery(db, context.userId, searchTerm),
        ),
      )
    : eq(conversationMessages.userId, context.userId);

  const stats = await db
    .select({
      id: conversations.id,
      createdAt: conversations.createdAt,
      title: conversations.title,
      category: conversations.category,
      lastMessageAt: max(conversationMessages.createdAt),
      messageCount: count(conversationMessages.id),
    })
    .from(conversations)
    .innerJoin(
      conversationMessages,
      eq(conversationMessages.conversationId, conversations.id),
    )
    .where(conversationsFilter)
    .groupBy(conversations.id)
    .orderBy(desc(max(conversationMessages.createdAt)))
    .limit(CONVERSATION_LIST_LIMIT);

  const conversationIds = stats.map((row) => row.id);

  const firstMessages = conversationIds.length === 0
    ? []
    : await db
        .selectDistinctOn([conversationMessages.conversationId], {
          conversationId: conversationMessages.conversationId,
          content: conversationMessages.content,
        })
        .from(conversationMessages)
        .where(
          and(messagesFilter, inArray(conversationMessages.conversationId, conversationIds)),
        )
        .orderBy(
          conversationMessages.conversationId,
          asc(conversationMessages.createdAt),
        );

  const previewByConversationId = new Map(
    firstMessages.map((message) => [message.conversationId, message.content]),
  );

  return stats.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    title: row.title,
    category: row.category,
    // `innerJoin` + `groupBy` garantiza al menos un mensaje por fila, así que
    // el máximo nunca es null aquí — el tipo de `max()` sigue siendo nullable.
    lastMessageAt: row.lastMessageAt ?? row.createdAt,
    messageCount: row.messageCount,
    previewText: truncate(
      previewByConversationId.get(row.id) ?? "",
      PREVIEW_MAX_LENGTH,
    ),
  }));
}
