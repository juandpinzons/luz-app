import type { EntityId } from "../../life/value-objects/entity-id";
import type { LoopOrigin } from "./loop-origin";
import type { LoopPriority } from "./loop-priority";
import type { LoopReason } from "./loop-reason";
import type { LoopState } from "./loop-state";

/**
 * El hecho concreto que originó un `ContinuityLoop` -- nunca inventado,
 * siempre trazable hasta un registro real de otro sistema.
 *
 * `sourceId` es deliberadamente `string`, no `EntityId` -- un loop
 * puede originarse fuera del Life Graph (un `ExternalMessageId` de
 * Gmail, un `ExternalEventId` de Calendar, ninguno de los dos es un
 * `EntityId`, ver `features/reality/domain/identifiers.ts`). Este
 * módulo nunca importa esos tipos de proveedor concretos -- mantenerlo
 * como string opaco es la frontera correcta (mismo principio que
 * `CalendarEvent.raw`/`EmailMessage.raw`: un escape hatch deliberado,
 * no una ausencia de tipado).
 */
export interface LoopTrigger {
  readonly origin: LoopOrigin;
  readonly reason: LoopReason;
  readonly sourceId: string;
  readonly detectedAt: Date;
  /** Descripción corta, ya legible, de qué pasó -- lista para mostrarse tal cual (mismo criterio que `LifeObservation.explanation`: nunca generada por IA, siempre plantilla + datos reales). */
  readonly summary: string;
}

/**
 * Qué tipo de hecho justifica mover un loop de estado -- cada valor
 * corresponde a un ejemplo explícito de la misión ("Closing Rules") Y
 * a exactamente una función determinista en `../resolution/`. Nunca un
 * motivo inventado sin una regla real detrás -- mismo criterio que
 * `LoopReason`.
 */
export const LOOP_EVIDENCE_KINDS = [
  /** Transición `open`/`follow_up` -> `waiting`: hay una fecha real de próximo seguimiento (`nextFollowUpAt`), no una espera sin justificación (ver `../scheduling/schedule-next-follow-up.ts`). */
  "follow_up_scheduled",
  /** Transición `waiting` -> `follow_up`: la fecha programada ya se cumplió -- el "reloj" de Continuity, nunca una decisión arbitraria. */
  "follow_up_due",
  /** `Goal.status`/`Project.status` transicionó a un estado terminal (completed/abandoned/cancelled). */
  "goal_or_project_status_changed",
  /** El `CalendarEvent` que originó el loop ya terminó (su hora de fin ya pasó). */
  "calendar_event_passed",
  /** El evento terminó Y existe una `Memory` posterior que sugiere que el desenlace ya se registró. */
  "calendar_event_outcome_captured",
  /** El mensaje que originó el loop ya no aparece en `EmailSnapshot.waitingReply` -- fue respondido o dejó de estar sin leer. */
  "email_replied",
  /** La `Relationship` relacionada se actualizó (notas, cercanía, tipo) después de que el loop se abrió. */
  "relationship_updated",
  /** La `Memory` que originó el loop pasó a `archived`/`forgotten`, o una `Memory` más nueva sobre el mismo asunto la reemplaza. */
  "memory_superseded",
  /** La `CuriosityQuestion` relacionada dejó de estar `pending`. */
  "curiosity_resolved",
  /** La persona respondió explícitamente al seguimiento (señal de un consumidor futuro de conversación, nunca inferido por este módulo). */
  "user_answered",
  /** La persona señaló explícitamente que este asunto ya no importa. */
  "user_explicit_abandon",
  /** El asunto se transformó en un registro concreto nuevo y rastreable (p. ej. `LifeCaptureService` creó un Goal real a partir de la intención que originó este loop). */
  "transformed_into_tracked_entity",
  /** Límite determinista de intentos de seguimiento o antigüedad máxima alcanzado -- el propio sistema, nunca la persona, decide dejar de rastrear. */
  "timeout_exceeded",
] as const;

export type LoopEvidenceKind = (typeof LOOP_EVIDENCE_KINDS)[number];

/**
 * Una pieza de evidencia real que justifica UNA transición de estado.
 * Nunca se descarta -- queda como su propio `LoopTransitionRecord` en
 * el historial persistido, append-only (`../repositories/`,
 * `ContinuityLoopRepository.getHistory`/`appendTransition`) -- mismo
 * principio que `BeliefHistoryEntry`/`belief_history`: el historial
 * completo vive SIEMPRE aparte del aggregate root (nunca embebido en
 * `ContinuityLoop`), se consulta bajo demanda, un loop es dueño
 * legítimo de su propia evolución y nunca se sobrescribe en silencio.
 */
export interface LoopEvidence {
  readonly kind: LoopEvidenceKind;
  readonly observedAt: Date;
  readonly description: string;
  /** Puntero opaco a lo que produjo esta evidencia (un id de Memory/Goal/evento/mensaje...) -- mismo criterio que `LoopTrigger.sourceId`, ausente cuando la evidencia es puramente del sistema (p. ej. `timeout_exceeded`). */
  readonly sourceId?: string;
}

export const LOOP_OUTCOME_KINDS = ["positive", "negative", "neutral", "unknown"] as const;
export type LoopOutcomeKind = (typeof LOOP_OUTCOME_KINDS)[number];

/**
 * El desenlace real de un loop -- solo tiene sentido cuando
 * `state === "resolved"`. `"unknown"` es un valor real, no un
 * placeholder: un loop puede resolverse con evidencia de que el asunto
 * terminó sin que LUZ pueda determinar si salió bien o mal (p. ej. una
 * reunión pasó y hay una memoria posterior, pero su contenido no
 * permite clasificar el tono) -- mejor "unknown" honesto que inventar
 * "neutral".
 */
export interface LoopOutcome {
  readonly kind: LoopOutcomeKind;
  readonly summary: string;
  readonly capturedAt: Date;
}

/**
 * Metadatos de cierre -- presente ÚNICAMENTE cuando `state` es uno de
 * los cuatro terminales (`isTerminalLoopState`, `./loop-state.ts`).
 * Consolida "cómo terminó" en un solo lugar en vez de esparcir columnas
 * opcionales por todo `ContinuityLoop`.
 */
export interface LoopResolution {
  readonly state: LoopState;
  readonly resolvedAt: Date;
  readonly evidence: LoopEvidence;
  /** Solo presente cuando `state === "resolved"` -- ver `LoopOutcome`. */
  readonly outcome?: LoopOutcome;
  /** Solo presente cuando `state === "transformed"` -- el loop nuevo que continúa este asunto. */
  readonly transformedIntoLoopId?: EntityId;
}

export const LOOP_RELATED_ENTITY_KINDS = [
  "goal",
  "project",
  "habit",
  "relationship",
  "person",
  "domain",
  "memory",
  "calendar_event",
  "email_message",
  "curiosity_question",
  "conversation",
  "belief",
] as const;

export type LoopRelatedEntityKind = (typeof LOOP_RELATED_ENTITY_KINDS)[number];

/**
 * Referencia mínima de vuelta a una fila real -- mismo criterio que
 * `ObservationEntityRef`/`DashboardEntityReference`
 * (`features/dashboard/services/build-life-observations.ts`): nunca un
 * objeto completo duplicado, solo lo necesario para que un consumidor
 * enlace de vuelta sin una consulta adicional. `id` es `string` (no
 * `EntityId`) por la misma razón que `LoopTrigger.sourceId`: algunos
 * `kind` (calendar_event/email_message) no son entidades del Life
 * Graph.
 */
export interface LoopRelatedEntity {
  readonly kind: LoopRelatedEntityKind;
  readonly id: string;
  readonly title: string;
}

/**
 * Aggregate root de Continuity System -- un asunto real que LUZ
 * decidió mantener vivo hasta un desenlace real, sin importar de qué
 * sistema salió. Ver `../README.md` para el ciclo de vida completo.
 */
export interface ContinuityLoop {
  readonly id: EntityId;
  readonly lifeGraphId: EntityId;
  readonly trigger: LoopTrigger;
  /** Título corto, humano, listo para mostrarse -- derivado de `trigger.summary` al crear, nunca regenerado por IA. */
  readonly title: string;
  readonly state: LoopState;
  readonly priority: LoopPriority;
  /** Presente únicamente en estados terminales -- ver `isTerminalLoopState`. */
  readonly resolution?: LoopResolution;
  /** Cuándo debería este loop volver a aparecer en algún consumidor -- `undefined` cuando el loop ya está en `follow_up` (elegible ahora mismo) o es terminal (ya no aplica). Ver `../scheduling/schedule-next-follow-up.ts`. */
  readonly nextFollowUpAt?: Date;
  /** Cuántas veces este loop ya pasó por `follow_up` sin resolverse -- alimenta el backoff de `scheduleNextFollowUp` (nunca spam) y el umbral de `timeout_exceeded`. */
  readonly followUpAttempts: number;
  readonly relatedEntities: readonly LoopRelatedEntity[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Una fila del historial persistido -- la forma que
 * `ContinuityLoopRepository.appendTransition`/`getHistory`
 * (`../repositories/`) mueve. `fromState` es `undefined` únicamente en
 * el registro de creación (no había estado "antes").
 */
export interface LoopTransitionRecord {
  readonly id: EntityId;
  readonly loopId: EntityId;
  readonly lifeGraphId: EntityId;
  readonly fromState?: LoopState;
  readonly toState: LoopState;
  readonly evidence: LoopEvidence;
  readonly occurredAt: Date;
}
