import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../../core/db/client";
import { events } from "../../core/db/schema/events";

/**
 * Encuesta puntual del Founder -- un solo día, sábado 22 de agosto de
 * 2026. Constantes hardcodeadas a propósito: construir un mecanismo
 * general de "encuestas programables" para un pedido de un solo día
 * sería sobre-ingeniería; si esto se repite, ESE es el momento de
 * generalizar, no antes. `surveyId` vive en `metadata` del evento
 * genérico `"survey_response"` (`core/db/schema/events.ts`) -- una
 * encuesta futura reutiliza ese mismo tipo con otro `surveyId`, nunca
 * exige una migración nueva por cada una.
 */
export const FOUNDER_SURVEY_ID = "founder_2026_08_22";
const FOUNDER_SURVEY_DATE = "2026-08-22";

/** Mismo criterio de zona horaria que `build-morning-brief.ts`/`get-live-calendar-context.ts` -- LUZ es un producto pensado para Colombia, "hoy" se calcula en su hora real, nunca en UTC del servidor. */
const PERSON_TIME_ZONE = "America/Bogota";
const ISO_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", { timeZone: PERSON_TIME_ZONE });

export function isFounderSurveyDay(now: Date): boolean {
  return ISO_DATE_FORMAT.format(now) === FOUNDER_SURVEY_DATE;
}

export const FOUNDER_SURVEY_CONCEPTS = [
  "Escucha activa",
  "Acompañamiento",
  "Presencia sin presión",
  "Orientación",
  "Conexión humana",
] as const;

export type FounderSurveyConcept = (typeof FOUNDER_SURVEY_CONCEPTS)[number];

/**
 * `metadata->>'surveyId'` filtrado en JSONB, mismo patrón que
 * `alreadySent` en `core/push-notifications/send-push-notification.ts`
 * -- reutiliza `events_user_type_created_at_idx` (userId+type primero),
 * nunca un índice GIN nuevo para un volumen de un solo día.
 */
export async function hasRespondedToFounderSurvey(db: Database, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: events.id })
    .from(events)
    .where(
      and(
        eq(events.userId, userId),
        eq(events.type, "survey_response"),
        sql`${events.metadata}->>'surveyId' = ${FOUNDER_SURVEY_ID}`,
      ),
    )
    .limit(1);

  return row !== undefined;
}
