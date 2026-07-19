import { and, count, desc, eq, max } from "drizzle-orm";
import type { Database } from "../../../core/db/client";
import {
  conversationMessages,
  conversations,
  memories,
  users,
} from "../../../core/db/schema";
import type { UserContext } from "../../../core/identity/user-context";
import type { LifeGraphContext } from "../../../core/life/life-graph-context";

export interface RecentConversationSummary {
  id: string;
  startedAt: Date;
  lastMessageAt: Date | null;
  messageCount: number;
}

/**
 * Todo lo que el Dashboard necesita mostrar, ya calculado contra datos
 * reales (Sprint Alpha-1a: Dashboard). Ningún campo se inventa — un
 * conteo en 0 o una fecha en `null` significa exactamente eso, y es
 * responsabilidad de la UI ocultar la sección correspondiente, nunca
 * de este servicio rellenarla con un placeholder.
 */
export interface DashboardSummary {
  memberSince: Date;
  conversationsStarted: number;
  messagesSent: number;
  lastMessageAt: Date | null;
  recentConversations: RecentConversationSummary[];
  /** 0 tanto si de verdad no hay memorias como si `LifeGraphContext` no se resolvió — mismo resultado visual (la tarjeta se oculta). */
  memoriesStored: number;
}

/**
 * Cinco consultas independientes y acotadas por índice existente
 * (`user_id` en `conversations`/`conversation_messages`, `life_graph_id`
 * en `memories`) — nunca un `select *` ni una traída completa de
 * mensajes. `lifeGraphContext` es opcional porque el Dashboard ya
 * tolera que no se resuelva (mismo criterio que `send-message.ts` desde
 * Sprint B1): sin él, `memoriesStored` queda en 0 en vez de romper la
 * página.
 */
export async function buildDashboardSummary(
  db: Database,
  context: UserContext,
  lifeGraphContext: LifeGraphContext | null,
): Promise<DashboardSummary> {
  const [userRow] = await db
    .select({ createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, context.userId))
    .limit(1);

  const [conversationsRow] = await db
    .select({ value: count() })
    .from(conversations)
    .where(eq(conversations.userId, context.userId));

  const [messagesRow] = await db
    .select({ value: count(), lastMessageAt: max(conversationMessages.createdAt) })
    .from(conversationMessages)
    .where(eq(conversationMessages.userId, context.userId));

  const recentConversations = await db
    .select({
      id: conversations.id,
      startedAt: conversations.createdAt,
      lastMessageAt: max(conversationMessages.createdAt),
      messageCount: count(conversationMessages.id),
    })
    .from(conversations)
    .leftJoin(
      conversationMessages,
      eq(conversationMessages.conversationId, conversations.id),
    )
    .where(eq(conversations.userId, context.userId))
    .groupBy(conversations.id)
    .orderBy(desc(conversations.createdAt))
    .limit(5);

  let memoriesStored = 0;
  if (lifeGraphContext) {
    const [memoriesRow] = await db
      .select({ value: count() })
      .from(memories)
      .where(
        and(
          eq(memories.lifeGraphId, lifeGraphContext.lifeGraphId),
          eq(memories.status, "active"),
        ),
      );
    memoriesStored = memoriesRow?.value ?? 0;
  }

  return {
    memberSince: userRow?.createdAt ?? new Date(),
    conversationsStarted: conversationsRow?.value ?? 0,
    messagesSent: messagesRow?.value ?? 0,
    lastMessageAt: messagesRow?.lastMessageAt ?? null,
    recentConversations,
    memoriesStored,
  };
}
