import type { ConversationCategory } from "../../../core/db/schema/conversations";

/**
 * La forma cruda que ve `computeConversationVariety` -- una fila real
 * de `conversations`, ya filtrada por quien la ensambla
 * (`assembleConversationalVariety`) para excluir `category: null`
 * (conversaciones cuya clasificación en segundo plano
 * -- `generate-title.ts` -- todavía no corrió, o falló). Nunca se
 * infiere ni se rellena una categoría aquí: ausencia real se
 * representa como ausencia, mismo criterio que el resto del repo.
 */
export interface ConversationVarietyEntry {
  readonly category: ConversationCategory;
  readonly occurredAt: Date;
}
