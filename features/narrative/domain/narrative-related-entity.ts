import type { LoopRelatedEntity, LoopRelatedEntityKind } from "../../../core/continuity-engine";

/**
 * Narrative reusa `LoopRelatedEntity` tal cual como su propio
 * vocabulario de "referencia a una fila real" -- mismo criterio que todo
 * el resto de este módulo (`Never duplicate Memory`, `A narrative never
 * stores data. It references existing entities.`). Su unión de `kind`
 * (goal/project/habit/relationship/person/domain/memory/calendar_event/
 * email_message/curiosity_question/conversation/belief) ya cubre a
 * `DashboardEntityReference`/`ObservationEntityRef`
 * (`features/dashboard/`) como subconjunto, así que un solo tipo basta
 * para threads (siempre respaldados por un `ContinuityLoop`, que ya
 * expone `relatedEntities: LoopRelatedEntity[]`) y para moments (que
 * pueden referenciar una entidad del Life Graph, un evento de calendario
 * o un mensaje de correo -- ninguno de los tres necesita una forma
 * distinta).
 */
export type NarrativeRelatedEntity = LoopRelatedEntity;
export type NarrativeRelatedEntityKind = LoopRelatedEntityKind;
