import { createEntityId } from "../../life/value-objects/entity-id";
import type { LifeGraphContext } from "../../life/life-graph-context";
import type { RealitySnapshot } from "../../reality/reality-snapshot";
import type { Context } from "../entities/context";
import { DeterministicContextFilterStrategy } from "../filtering/deterministic-context-filter-strategy";
import { DeterministicContextPrioritizationStrategy } from "../prioritization/deterministic-context-prioritization-strategy";
import { DeterministicContextScoringStrategy } from "../scoring/deterministic-context-scoring-strategy";
import type { ContextEngine, ContextEngineStages } from "./context-engine";

/**
 * Compone Filter → Score → Prioritize en el único punto de acceso que
 * el resto del dominio debería usar — mismo patrón que
 * `DefaultMemoryEngine` (`core/memory-engine/engine`) y
 * `DefaultKnowledgeEngine` (`core/knowledge-engine/engine`). Efímero a
 * propósito, igual que `assembleRealitySnapshot`: no persiste el
 * `Context` que produce (`ContextRepository` sigue sin
 * implementación, tal como su propio docblock ya anticipaba) —
 * calculado de nuevo en cada request, nunca cacheado entre ellos.
 */
export class DefaultContextEngine implements ContextEngine {
  constructor(private readonly stages: ContextEngineStages) {}

  async build(
    snapshot: RealitySnapshot,
    context: LifeGraphContext,
  ): Promise<Context> {
    const candidates = await this.stages.filter.filter(snapshot, context);
    const scored = await this.stages.score.score(candidates, context);
    const items = await this.stages.prioritize.prioritize(scored, context);

    return {
      id: createEntityId(crypto.randomUUID()),
      lifeGraphId: context.lifeGraphId,
      items,
      generatedAt: new Date(),
    };
  }
}

export function createContextEngine(): ContextEngine {
  const stages: ContextEngineStages = {
    filter: new DeterministicContextFilterStrategy(),
    score: new DeterministicContextScoringStrategy(),
    prioritize: new DeterministicContextPrioritizationStrategy(),
  };

  return new DefaultContextEngine(stages);
}
