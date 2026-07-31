import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../../../core/db/client";
import { events } from "../../../core/db/schema";
import { recordEvent } from "../../../core/observability/record-event";
import type { ExperienceCard, RealityFingerprint } from "../domain/experience-state";

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
 *
 * `fingerprint` (adición "¿qué cambió?"): mismo evento, un campo más
 * en `metadata` -- nunca una segunda fila ni una segunda tabla, mismo
 * criterio que ya justifica reusar `events` en vez de crear
 * `experience_card_shown` como su propio dominio.
 */
export async function recordExperienceCardShown(
  db: Database,
  userId: string,
  card: Pick<ExperienceCard, "key" | "category">,
  fingerprint: RealityFingerprint,
): Promise<void> {
  await recordEvent(db, {
    type: "experience_card_shown",
    userId,
    metadata: { key: card.key, category: card.category, fingerprint },
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

function isRealityFingerprint(value: unknown): value is RealityFingerprint {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.memoriesStored === "number" &&
    typeof candidate.goalsCompleted === "number" &&
    typeof candidate.projectsCompleted === "number" &&
    typeof candidate.observationCount === "number" &&
    typeof candidate.recommendationCount === "number" &&
    typeof candidate.relationshipTotal === "number"
  );
}

/**
 * La huella de la visita más reciente (`RealityFingerprint`, ver
 * `services/detect-what-changed.ts`) -- `null` en la primera visita
 * real con historial, o si un evento previo se guardó antes de que
 * esta adición existiera (metadata sin `fingerprint`, degradación
 * segura en vez de romper). Consulta separada de `getRecentPrimaryKeys`
 * (misma tabla, mismo índice) para no cambiar el contrato de esa
 * función ya existente -- un `limit(1)` extra es barato frente al
 * riesgo de tocar una consulta que la rotación ya depende de que
 * siga funcionando igual.
 */
export async function getPreviousFingerprint(db: Database, userId: string): Promise<RealityFingerprint | null> {
  const [row] = await db
    .select({ metadata: events.metadata })
    .from(events)
    .where(and(eq(events.userId, userId), eq(events.type, "experience_card_shown")))
    .orderBy(desc(events.createdAt))
    .limit(1);

  const fingerprint = (row?.metadata as { fingerprint?: unknown } | undefined)?.fingerprint;
  return isRealityFingerprint(fingerprint) ? fingerprint : null;
}
