import type { EntityId } from "../life/value-objects/entity-id";
import type { CuriosityContextSnapshot } from "./curiosity-snapshot";
import type { ExternalSignalSnapshot } from "./external-signal-snapshot";
import type { InsightContextSnapshot } from "./insight-context-snapshot";
import type { KnowledgeGapsSnapshot } from "./knowledge-gaps-snapshot";
import type { LifeStateSnapshot } from "./life-state-snapshot";
import type { MemoryContextSnapshot } from "./memory-context-snapshot";
import type { ReasoningContextSnapshot } from "./reasoning-snapshot";

/**
 * El estado de realidad disponible para un engine en un momento dado
 * (ADR-0008 Reality Model, ADR-0013). Kernel compartido — vive junto a
 * `EntityId`/`LifeGraphContext`/`DomainEvent` (`core/life`), no dentro
 * de ningún engine. Ningún engine importa a otro para construir esto:
 * un futuro ensamblador de aplicación lee `core/life` y
 * `core/memory-engine` y traduce su estado a esta forma neutral —
 * ver ADR-0013 para el razonamiento completo.
 *
 * `capturedAt` existe porque esto es una lectura puntual, no una vista
 * en vivo: quien la consume no debe asumir que sigue vigente
 * indefinidamente.
 */
export interface RealitySnapshot {
  lifeGraphId: EntityId;
  capturedAt: Date;
  life: LifeStateSnapshot;
  memory: MemoryContextSnapshot;
  insights: InsightContextSnapshot;
  signals: ExternalSignalSnapshot;
  /** `core/knowledge-gaps` (Knowledge Engine V2) -- qué tan bien entiende LUZ cada área de vida ahora mismo. */
  knowledgeGaps: KnowledgeGapsSnapshot;
  /** `core/knowledge-engine/reasoning` -- conclusiones razonadas ya validadas, para que Conversation Strategy pueda apoyarse en comprensión real, no solo en contexto inmediato. */
  reasoning: ReasoningContextSnapshot;
  /** `core/curiosity-engine` -- la pregunta concreta que LUZ tiene pendiente ahora mismo, si hay una. */
  curiosity: CuriosityContextSnapshot;
}
