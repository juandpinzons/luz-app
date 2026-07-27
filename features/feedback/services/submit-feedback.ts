import { db } from "../../../core/db/client";
import { feedbackResponses } from "../../../core/db/schema";
import type { UserContext } from "../../../core/identity/user-context";
import { logger } from "../../../core/observability/logger";
import type { SubmitFeedbackRequest, SubmitFeedbackResponse } from "../types";

/**
 * Persiste una respuesta real del formulario breve de feedback
 * (Alpha). Una persona puede enviar más de una — cada fila es un
 * punto en el tiempo, la tendencia es la señal, no una sola
 * respuesta.
 */
export async function submitFeedback(
  context: UserContext,
  input: SubmitFeedbackRequest,
): Promise<SubmitFeedbackResponse> {
  const [created] = await db
    .insert(feedbackResponses)
    .values({
      userId: context.userId,
      helpfulness: input.helpfulness,
      remembersMe: input.remembersMe,
      comment: input.comment && input.comment.length > 0 ? input.comment : null,
    })
    .returning({ id: feedbackResponses.id });

  if (!created) {
    throw new Error("No se pudo guardar el feedback.");
  }

  logger.log({
    event: "feedback.submitted",
    userId: context.userId,
    helpfulness: input.helpfulness,
    remembersMe: input.remembersMe,
    hasComment: Boolean(input.comment && input.comment.length > 0),
  });

  return { id: created.id };
}
