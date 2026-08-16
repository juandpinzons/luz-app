import { db } from "../../../core/db/client";
import { feedbackResponses } from "../../../core/db/schema";
import type { UserContext } from "../../../core/identity/user-context";
import { describeError } from "../../../core/observability/describe-error";
import { logger } from "../../../core/observability/logger";
import { encryptContentOrNull } from "../../../core/security/content-cipher";
import type { SubmitFeedbackRequest, SubmitFeedbackResponse } from "../types";

/**
 * Persiste una respuesta real del formulario breve de feedback
 * (Alpha). Una persona puede enviar más de una — cada fila es un
 * punto en el tiempo, la tendencia es la señal, no una sola
 * respuesta.
 *
 * Auditoría de producción 2026-08-02: 4 inserts reales fallaron entre
 * el 2026-07-27 y el 2026-07-28 (dos personas reales, una perdió un
 * testimonio genuino tras 3 intentos) -- la única razón visible en
 * `events.message` era el texto genérico de `postgres-js`
 * ("Failed query: ...") porque `app/api/feedback/route.ts` (el borde
 * de la API, mismo patrón narrow en todas las rutas -- ver
 * `app/api/chat/route.ts`) solo captura `error.message`, nunca
 * `code`/`detail` reales de Postgres. Sin reproducir contra el código
 * y schema actuales (local, real), así que la causa original sigue sin
 * confirmarse -- pero si vuelve a pasar, ahora sí quedará diagnosticable
 * aquí, en la capa que sabe que esto es una operación de DB (mismo
 * criterio que `background.morning_brief.failed` en
 * `build-morning-brief.ts`), no en el borde genérico de la ruta.
 */
export async function submitFeedback(
  context: UserContext,
  input: SubmitFeedbackRequest,
): Promise<SubmitFeedbackResponse> {
  let created: { id: string } | undefined;
  try {
    [created] = await db
      .insert(feedbackResponses)
      .values({
        userId: context.userId,
        helpfulness: input.helpfulness,
        remembersMe: input.remembersMe,
        responseLength: input.responseLength ?? null,
        comment: encryptContentOrNull(
          input.comment && input.comment.length > 0 ? input.comment : null,
        ),
      })
      .returning({ id: feedbackResponses.id });
  } catch (error) {
    logger.log({
      event: "feedback.insert_failed",
      severity: "error",
      userId: context.userId,
      ...describeError(error),
    });
    throw error;
  }

  if (!created) {
    throw new Error("No se pudo guardar el feedback.");
  }

  logger.log({
    event: "feedback.submitted",
    userId: context.userId,
    helpfulness: input.helpfulness,
    remembersMe: input.remembersMe,
    responseLength: input.responseLength ?? "sin_opinion",
    hasComment: Boolean(input.comment && input.comment.length > 0),
  });

  return { id: created.id };
}
