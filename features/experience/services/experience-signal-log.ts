import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../../../core/db/client";
import { events } from "../../../core/db/schema";
import { recordEvent } from "../../../core/observability/record-event";
import type { ExperienceCard } from "../domain/experience-state";

/**
 * ~2 semanas de historial -- de sobra para que `MAX_CONSECUTIVE_DAYS`
 * (2, en `apply-rotation.ts`) siempre tenga contexto real, sin traer
 * la tabla completa de eventos de esta persona en cada carga de Home.
 */
const RECENT_SIGNALS_LIMIT = 14;

/**
 * Registra qué tarjeta ganó `primary` hoy -- el único escrito nuevo de
 * toda la misión "Experience Intelligence V1". Reusa `recordEvent`
 * (ya tolerante a fallos: un error al guardar esto nunca debe tumbar
 * la carga de Home) en vez de reimplementar el mismo `try/catch` +
 * logging que esa función ya resuelve.
 */
export async function recordExperienceCardShown(
  db: Database,
  userId: string,
  card: Pick<ExperienceCard, "key" | "category">,
): Promise<void> {
  await recordEvent(db, {
    type: "experience_card_shown",
    userId,
    metadata: { key: card.key, category: card.category },
  });
}

function isRecordWithKey(value: unknown): value is { key: string } {
  return typeof value === "object" && value !== null && typeof (value as { key?: unknown }).key === "string";
}

/**
 * Las últimas `RECENT_SIGNALS_LIMIT` tarjetas primarias mostradas a
 * esta persona, más reciente primero -- lo único que `apply-rotation.ts`
 * necesita para calcular la racha de cada candidata. Mismo índice
 * compuesto que ya usa `reserveRateLimitSlot`
 * (`events_user_type_created_at_idx`, `features/chat/services/check-rate-limit.ts`),
 * misma tabla, ninguna consulta nueva sin índice.
 */
export async function getRecentPrimaryKeys(db: Database, userId: string): Promise<string[]> {
  const rows = await db
    .select({ metadata: events.metadata })
    .from(events)
    .where(and(eq(events.userId, userId), eq(events.type, "experience_card_shown")))
    .orderBy(desc(events.createdAt))
    .limit(RECENT_SIGNALS_LIMIT);

  return rows
    .map((row) => row.metadata)
    .filter(isRecordWithKey)
    .map((metadata) => metadata.key);
}
