import { and, asc, count, desc, eq, inArray, max } from "drizzle-orm";
import type { Database } from "../../../core/db/client";
import { conversationMessages, conversations } from "../../../core/db/schema";
import type { ConversationCategory } from "../../../core/db/schema/conversations";
import type { UserContext } from "../../../core/identity/user-context";
import { decryptContent } from "../../../core/security/content-cipher";

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

/**
 * `content` está cifrado (ADR-0024) -- un `ILIKE` a nivel SQL sobre la
 * columna ya no puede encontrar nada (compara contra ciphertext, no
 * contra el texto real). Esta es la tercera consulta que el docblock
 * de `listConversations` decía evitar; ya no es evitable manteniendo
 * la búsqueda funcionando de verdad: trae los mensajes del usuario
 * (acotado por `conversation_messages_user_id_idx`, nunca global),
 * descifra, y filtra en memoria. Costo aceptado a propósito -- mismo
 * criterio que la nota de `CONVERSATION_LIST_LIMIT` sobre no
 * optimizar para un volumen que ningún usuario real tiene todavía;
 * revisar si esto deja de ser cierto.
 */
async function findMatchingConversationIds(
  db: Database,
  userId: string,
  searchTerm: string,
): Promise<string[]> {
  const rows = await db
    .select({
      conversationId: conversationMessages.conversationId,
      content: conversationMessages.content,
    })
    .from(conversationMessages)
    .where(eq(conversationMessages.userId, userId));

  const needle = searchTerm.toLowerCase();
  const matching = new Set<string>();
  for (const row of rows) {
    if (decryptContent(row.content).toLowerCase().includes(needle)) {
      matching.add(row.conversationId);
    }
  }

  return [...matching];
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

  const matchingConversationIds = searchTerm
    ? await findMatchingConversationIds(db, context.userId, searchTerm)
    : null;

  const conversationsFilter = searchTerm
    ? and(
        eq(conversations.userId, context.userId),
        inArray(conversations.id, matchingConversationIds ?? []),
      )
    : eq(conversations.userId, context.userId);

  const messagesFilter = searchTerm
    ? and(
        eq(conversationMessages.userId, context.userId),
        inArray(conversationMessages.conversationId, matchingConversationIds ?? []),
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
    firstMessages.map((message) => [message.conversationId, decryptContent(message.content)]),
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
