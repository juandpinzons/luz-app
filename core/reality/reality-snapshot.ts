import type { EntityId } from "../life/value-objects/entity-id";
import type { CommunicationPreferenceSnapshot } from "./communication-preference-snapshot";
import type { ContradictionContextSnapshot } from "./contradiction-snapshot";
import type { CuriosityContextSnapshot } from "./curiosity-snapshot";
import type { ClosureSnapshot } from "./closure-snapshot";
import type { ConceptSnapshot } from "./concept-snapshot";
import type { ExternalSignalSnapshot } from "./external-signal-snapshot";
import type { FadingBeliefSnapshot } from "./fading-belief-snapshot";
import type { GrowingBeliefSnapshot } from "./growing-belief-snapshot";
import type { ReopenCandidateSnapshot } from "./reopen-candidate-snapshot";
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
  /** `core/contradiction-engine` -- una tensión real ya detectada entre lo que la persona dijo y lo que sigue creyendo o persiguiendo, si hay una abierta. */
  contradictions: ContradictionContextSnapshot;
  /** `core/belief-engine` (`category: "communication_style"`) -- cómo prefiere esta persona que LUZ le hable, si ya hay señal real. */
  communicationStyle: CommunicationPreferenceSnapshot;
  /** `core/belief-engine` -- una hipótesis sobre la persona todavía en formación (confianza 30-54), candidata a confirmarse de forma orgánica, si hay una. */
  growingBeliefs: GrowingBeliefSnapshot;
  /** `core/belief-engine` -- la creencia que más recientemente dejó de sostenerse (`expired`/`retracted`), si hay una. La respuesta concreta a "qué ya dejó de definir a esta persona". */
  fadingBeliefs: FadingBeliefSnapshot;
  /** `core/memory-engine` (`type: "intention"`) filtrado por `seen_prompts` -- una intención sin resolver que retomar al reabrir una conversación, si hay una. */
  reopenCandidates: ReopenCandidateSnapshot;
  /** `core/life` (Goal/Project `status: "completed"`, recientes) filtrado por `seen_prompts` -- un cierre real todavía sin reconocer, si hay uno. */
  closures: ClosureSnapshot;
  /** `core/concept-graph` -- temas/rasgos que ya aparecen de forma recurrente en la vida de esta persona (identidad de fondo, `METADATA_INVENTORY_V1.md`). */
  concepts: ConceptSnapshot;
}
