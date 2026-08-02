import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../../../core/db/client";
import { events } from "../../../core/db/schema";
import type { ConversationStrategyType } from "../../../core/conversation-strategy-engine";
import { recordEvent } from "../../../core/observability/record-event";

/**
 * Cuántas filas crudas se leen para reconstruir el historial -- una
 * conversación activa puede escribir varias filas seguidas (un evento
 * por turno de LUZ), así que la ventana necesita margen por encima de
 * `RECENT_CONVERSATIONS_LIMIT` para de verdad alcanzar esa cantidad de
 * conversaciones *distintas*.
 */
const RECENT_SIGNALS_WINDOW = 40;
/**
 * Cuántas conversaciones distintas de historial se conservan --
 * de sobra para que `MAX_CONSECUTIVE_STRATEGY_REPEATS` (2, ver
 * `celebrate-strategy-rule.ts` y hermanas) siempre tenga contexto
 * real, mismo criterio que `RECENT_SIGNALS_LIMIT` en
 * `experience-signal-log.ts`.
 */
const RECENT_CONVERSATIONS_LIMIT = 10;

/**
 * Qué decidió mostrar LUZ en un turno -- la base de datos real detrás
 * del sistema de diversidad conversacional (redesign del pipeline
 * conversacional, Beta). `topContextItemKeys` son `${source}:${sourceId}`
 * (memorias/insights que ganaron el top del scoring ese turno, ver
 * `build-context.ts`) -- suficiente para que un turno futuro sepa "esto
 * ya se mostró" sin guardar el contenido completo otra vez.
 */
export interface ConversationSignal {
  conversationId: string;
  strategy: ConversationStrategyType;
  topContextItemKeys: string[];
}

function isConversationSignal(value: unknown): value is ConversationSignal {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.conversationId === "string" &&
    typeof candidate.strategy === "string" &&
    Array.isArray(candidate.topContextItemKeys) &&
    candidate.topContextItemKeys.every((key) => typeof key === "string")
  );
}

/**
 * Registra, una vez por turno de LUZ, qué ganó ese turno -- mismo
 * criterio de tolerancia a fallos que `recordExperienceCardShown`
 * (`recordEvent` ya nunca lanza).
 */
export async function recordConversationSignalShown(
  db: Database,
  userId: string,
  signal: ConversationSignal,
): Promise<void> {
  await recordEvent(db, {
    type: "conversation_signal_shown",
    userId,
    metadata: { ...signal },
  });
}

/**
 * El historial de señales, colapsado a una entrada por conversación
 * distinta -- la repetición que le importa a la persona es entre
 * conversaciones ("LUZ sigue abriendo con lo mismo"), no entre turnos
 * consecutivos de un mismo intercambio real. Como las filas ya vienen
 * ordenadas por `createdAt` descendente, quedarse con la primera
 * aparición de cada `conversationId` es quedarse con su turno más
 * reciente -- el resultado sigue ordenado de conversación más reciente
 * a más antigua, tal como `consecutiveStreak` espera.
 */
export async function getRecentConversationSignals(
  db: Database,
  userId: string,
  limit: number = RECENT_CONVERSATIONS_LIMIT,
): Promise<ConversationSignal[]> {
  const rows = await db
    .select({ metadata: events.metadata })
    .from(events)
    .where(and(eq(events.userId, userId), eq(events.type, "conversation_signal_shown")))
    .orderBy(desc(events.createdAt))
    .limit(RECENT_SIGNALS_WINDOW);

  const seenConversations = new Set<string>();
  const collapsed: ConversationSignal[] = [];
  for (const row of rows) {
    if (!isConversationSignal(row.metadata)) {
      continue;
    }
    if (seenConversations.has(row.metadata.conversationId)) {
      continue;
    }
    seenConversations.add(row.metadata.conversationId);
    collapsed.push(row.metadata);
    if (collapsed.length >= limit) {
      break;
    }
  }

  return collapsed;
}
