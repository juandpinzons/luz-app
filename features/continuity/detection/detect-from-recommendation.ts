import type { DetectedLoopCandidate, LoopRelatedEntity } from "../../../core/continuity-engine";
import type { DashboardEntityReference, FollowUpRecommendation } from "../../dashboard/services/build-follow-up-recommendations";

const ELIGIBLE_PRIORITIES: ReadonlySet<string> = new Set(["high", "critical"]);

/**
 * `DashboardEntityReference` (`= ObservationEntityRef`) es una unión
 * discriminada: la variante `"domain"` no tiene `id` (tiene `domain:
 * LifeDomainType` en su lugar) -- el propio `LifeDomainType` (p. ej.
 * `"health"`) es el identificador más honesto disponible para ese
 * caso, nunca un id inventado.
 */
function toLoopRelatedEntity(entity: DashboardEntityReference): LoopRelatedEntity {
  if (entity.kind === "domain") {
    return { kind: "domain", id: entity.domain, title: entity.title };
  }
  return { kind: entity.kind, id: entity.id, title: entity.title };
}

/**
 * Regla de apertura determinista para `FollowUpRecommendation`
 * (`features/dashboard/`) -- misión: "Important moments disappear
 * after they are shown" es exactamente el problema que esta regla
 * cierra. Dashboard ya calcula una recomendación completa
 * (`priority`/`explanation`/`evidence`/`relatedEntities`) en CADA
 * carga, sin memoria de si ya se mostró antes -- Continuity la vuelve
 * un loop rastreado para que no desaparezca la próxima vez que
 * Dashboard recalcule y esta recomendación ya no aparezca en el top-N.
 *
 * Solo `priority` `high`/`critical` -- `low`/`medium` son señales
 * reales pero no lo bastante urgentes para justificar seguimiento
 * persistente (siguen disponibles en Dashboard normalmente). Nunca
 * `CELEBRATE_PROGRESS`/`NO_ACTION` -- esos tipos no tienen nada que
 * "seguir", `suggestedAction.kind` para ambos es `acknowledge`, sin
 * destino real (ver `entity-link.ts`).
 *
 * `priority` se reutiliza TAL CUAL (misión: "consume existing public
 * contracts whenever possible") -- `RecommendationPriority` y
 * `LoopPriority` son la misma unión de valores por diseño (ver
 * `core/continuity-engine/domain/loop-priority.ts`).
 */
export function detectFromRecommendation(
  recommendation: FollowUpRecommendation,
  now: Date = new Date(),
): DetectedLoopCandidate | null {
  if (recommendation.type === "CELEBRATE_PROGRESS" || recommendation.type === "NO_ACTION") return null;
  if (!ELIGIBLE_PRIORITIES.has(recommendation.priority)) return null;

  return {
    trigger: {
      origin: "recommendation",
      reason: "recommendation_pending",
      sourceId: recommendation.id,
      detectedAt: now,
      summary: recommendation.explanation,
    },
    title: recommendation.title,
    priority: recommendation.priority,
    relatedEntities: recommendation.relatedEntities.map(toLoopRelatedEntity),
  };
}
