import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Eventos operacionales (Sprint de Observabilidad, Alpha) — únicamente
 * lo que ninguna tabla de dominio ya captura. `conversations` y
 * `conversation_messages` ya son el registro de uso real; esta tabla
 * no los duplica. Solo dos tipos hoy: login y error inesperado — el
 * catálogo crece agregando valores al enum, nunca con una columna
 * `metadata` de propósito genérico como sustituto de modelado real.
 */
export const eventTypeEnum = pgEnum("event_type", [
  "auth_sign_in",
  "error",
  "message_attempted",
  "message_sent",
  /**
   * Misión "Experience Intelligence V1" -- una fila por cada vez que
   * Home decide cuál `ExperienceCard` mostrar como primaria.
   * `metadata.key`/`metadata.category` (ver `features/experience/`)
   * es lo único que la rotación necesita leer de vuelta: qué tarjeta
   * exacta ganó, ordenado por `createdAt`, filtrado por
   * `events_user_type_created_at_idx` (mismo índice que ya usa
   * `reserveRateLimitSlot`). Ninguna tabla nueva: es exactamente el
   * tipo de "señal operacional que ninguna tabla de dominio ya
   * captura" que esta tabla ya existe para modelar.
   */
  "experience_card_shown",
  /**
   * Redesign del pipeline conversacional (Beta) -- una fila por cada
   * turno de LUZ, registrando qué decidió mostrar (Conversation
   * Strategy ganadora, qué memorias/insights ganaron el top del
   * scoring, qué dominio de curiosidad se preguntó). Es la base de
   * datos real detrás del sistema de diversidad conversacional: sin
   * esto, nada sabe qué ya se dijo/preguntó/celebró en conversaciones
   * anteriores. Mismo criterio que `experience_card_shown`: una fila
   * por evento, leída de vuelta por `userId`+`type`+`createdAt`, nunca
   * una columna `metadata` genérica sustituyendo modelado real en otra
   * tabla -- este SÍ es exactamente el tipo de señal operacional que
   * esta tabla existe para modelar.
   */
  "conversation_signal_shown",
  /**
   * War Room 13-ago-2026 (terremoto de Cali) -- una fila cada vez que
   * `detectCrisisSignal` (`features/chat/services/detect-crisis-signal.ts`)
   * encuentra lenguaje explícito de crisis/autolesión en un mensaje del
   * usuario. Nunca lleva el texto del mensaje en `metadata` (mismo
   * criterio de privacidad que `recordQuery`/Memory Engine en todo el
   * dominio) -- solo que ocurrió, para quién y cuándo, suficiente para
   * que un operador humano pueda hacer seguimiento real sin que esta
   * tabla se vuelva un registro de contenido sensible.
   */
  "crisis_signal_detected",
  /**
   * Auditoría de seguridad, 2026-08-14 -- una fila cada vez que
   * `sanitizeExternalText` (`calendar-signals.ts`) de verdad modifica
   * el título/ubicación de un evento (encontró un salto de línea o
   * tuvo que acotar el largo), la señal más simple de un intento real
   * de inyección de prompt vía una invitación de calendario. Nunca
   * lleva el texto original en `metadata` -- mismo criterio de
   * privacidad que `crisis_signal_detected`: suficiente para que un
   * operador note un patrón, no un registro de contenido.
   */
  "calendar_signal_sanitized",
  /**
   * Auditoría de seguridad, 2026-08-14 -- una fila por cada llamada
   * real a un `AIProvider` desde el camino de chat (`send-message.ts`),
   * éxito o falla. `metadata.outcome` ("success"/"timeout"/
   * "rate_limited"/"server_error"/"error") + duración + tokens (cuando
   * el proveedor los expone) + tamaño del mensaje de entrada -- la base
   * de datos real detrás de p95/timeouts/429/500/costo del tablero de
   * salud diario. Nunca el contenido del mensaje.
   */
  "ai_call_completed",
  /**
   * Auditoría de privacidad, 2026-08-17 -- una fila cada vez que una
   * persona confirma el consentimiento explícito antes del flujo
   * manual de wearable (`/garmin`, `POST /api/wearable/consent`). El
   * registro real y consultable vive en `wearable_consents`
   * (`core/db/schema/wearable.ts`); este evento es solo la traza
   * operacional de que ocurrió, mismo criterio que el resto de esta
   * tabla.
   */
  "wearable_consent_given",
  /**
   * Misión "integrar YouTube", 2026-08-17 -- mismo criterio exacto que
   * `calendar_signal_sanitized`: una fila cada vez que
   * `sanitizeExternalText` (`features/chat/services/youtube-signals.ts`)
   * de verdad modifica el título de un video (encontró un salto de
   * línea o tuvo que acotar el largo) -- la señal más simple de un
   * intento real de inyección de prompt vía el título de un video de
   * un tercero. Nunca lleva el texto original en `metadata`.
   */
  "youtube_signal_sanitized",
  /**
   * Misión "shell nativo iOS", 2026-08-18 -- una fila por cada intento
   * real de envío de push (`core/push-notifications/send-push-notification.ts`),
   * éxito o falla. `metadata.triggerType`/`metadata.sourceId` es la
   * base del dedupe de "¿ya se le avisó a esta persona de esto?"
   * (reutiliza `events_user_type_created_at_idx`, sin tabla nueva),
   * mismo patrón que `experience_card_shown`. Nunca el título/cuerpo
   * real de la notificación.
   */
  "push_notification_sent",
  /**
   * Encuesta puntual del Founder, 2026-08-22 (sábado, un solo día) --
   * una fila por respuesta real. `metadata.surveyId` distingue de qué
   * encuesta se trata (ej. `"founder_2026_08_22"`) para que una
   * encuesta futura reutilice este mismo tipo en vez de exigir una
   * migración nueva por cada una -- `metadata.rating`
   * (1-5)/`metadata.concepts` (arreglo de los conceptos elegidos) son
   * específicos de ESTA encuesta, no un contrato fijo para todas.
   * `features/survey/founder-survey-2026-08-22.ts` es quien decide qué
   * `surveyId` usar y cuándo mostrarla -- este tipo solo es el
   * contenedor genérico de "alguien respondió una encuesta".
   */
  "survey_response",
]);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    type: eventTypeEnum("type").notNull(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    route: text("route"),
    message: text("message"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("events_type_idx").on(table.type),
    index("events_created_at_idx").on(table.createdAt),
    /**
     * `reserveRateLimitSlot` (`features/chat/services/check-rate-limit.ts`)
     * filtra exactamente por estas tres columnas en CADA mensaje enviado
     * -- sin este índice compuesto, esa consulta hace Seq Scan sobre toda
     * la tabla (confirmado con EXPLAIN ANALYZE, auditoría Staff Engineer
     * 2026-07-28: barato hoy con pocas filas, pero `events` no tiene
     * retención/poda y crece sin límite -- ese Seq Scan corre dentro de
     * la transacción que sostiene el advisory lock por usuario, así que
     * su costo se vuelve latencia real en el camino crítico de cada
     * mensaje a medida que la tabla crece).
     */
    index("events_user_type_created_at_idx").on(
      table.userId,
      table.type,
      table.createdAt,
    ),
  ],
);

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
