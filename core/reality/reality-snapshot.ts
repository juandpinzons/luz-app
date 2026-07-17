import type { EntityId } from "../life/value-objects/entity-id";
import type { ExternalSignalSnapshot } from "./external-signal-snapshot";
import type { LifeStateSnapshot } from "./life-state-snapshot";
import type { MemoryContextSnapshot } from "./memory-context-snapshot";

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
  signals: ExternalSignalSnapshot;
}
