import { DrizzleContradictionRepository } from "../../../contradiction-engine";
import type { Database } from "../../../db/client";
import type { EntityId } from "../../../life/value-objects/entity-id";
import type { PipelineContext } from "../../pipeline-context";
import { DrizzleInsightRepository } from "../../repositories/drizzle-insight.repository";
import type { InsightRepository } from "../../repositories/insight.repository";
import { DefaultReasoningCorrelateStage } from "../correlation/default-reasoning-correlate-stage";
import type { ReasoningCorrelateStage } from "../correlation/reasoning-correlate-stage";
import type { ReasoningConclusion } from "../entities/reasoning-conclusion";
import { DefaultReasoningGatherStage } from "../gathering/default-reasoning-gather-stage";
import type { ReasoningEvidenceWindow } from "../gathering/reasoning-evidence-window";
import type { ReasoningGatherStage } from "../gathering/reasoning-gather-stage";
import { AIReasoningStrategy } from "../inference/ai-reasoning-strategy";
import type { ReasoningStrategy } from "../inference/reasoning-strategy";
import { DefaultReasoningPersistStage } from "../persistence/default-reasoning-persist-stage";
import type { ReasoningPersistStage } from "../persistence/reasoning-persist-stage";
import { DrizzleReasoningRepository } from "../repositories/drizzle-reasoning.repository";
import {
  DeterministicReasoningValidationStrategy,
  MIN_CLUSTER_SIZE,
} from "../validation/deterministic-reasoning-validation-strategy";
import type { ReasoningValidationStrategy } from "../validation/reasoning-validation-strategy";
import type { ReasoningEngine } from "./reasoning-engine";

export interface ReasoningEngineStages {
  gather: ReasoningGatherStage;
  correlate: ReasoningCorrelateStage;
  reason: ReasoningStrategy;
  validate: ReasoningValidationStrategy;
  persist: ReasoningPersistStage;
  /** Resuelve evidencia (memorias) por insight -- compartida entre la etapa Reason (texto) y Persist (ids), una sola consulta por insight. */
  insightRepository: InsightRepository;
}

/**
 * Orquesta Gather→Correlate→(Reason→Validate por cluster)→Persist,
 * siempre en ese orden -- mismo patrón que `DefaultKnowledgeEngine`:
 * compone estrategias inyectadas, nunca decide lógica de negocio por
 * sí misma. Un cluster por debajo de `MIN_CLUSTER_SIZE` ni siquiera
 * llega a pedirle algo a la IA -- `ReasoningValidationStrategy` lo
 * rechazaría de todas formas por evidencia insuficiente (mismo
 * criterio que `AIInsightGenerationStrategy` con
 * `relatedMemories.length === 0`).
 */
export class DefaultReasoningEngine implements ReasoningEngine {
  constructor(private readonly stages: ReasoningEngineStages) {}

  async run(
    window: ReasoningEvidenceWindow,
    pipelineContext: PipelineContext,
    memoryContentById: Map<EntityId, string>,
  ): Promise<ReasoningConclusion[]> {
    const insights = await this.stages.gather.gather(window, pipelineContext);
    const clusters = await this.stages.correlate.correlate(insights, pipelineContext);

    const conclusions: ReasoningConclusion[] = [];

    for (const cluster of clusters) {
      if (cluster.insights.length < MIN_CLUSTER_SIZE) {
        continue;
      }

      const evidenceMemoryIdsByInsightId = new Map<EntityId, EntityId[]>();
      const evidenceTextByInsightId = new Map<EntityId, string[]>();

      for (const insight of cluster.insights) {
        const evidence = await this.stages.insightRepository.getEvidence(
          pipelineContext,
          insight.id,
        );
        const memoryIds = evidence.map((item) => item.memoryId);
        evidenceMemoryIdsByInsightId.set(insight.id, memoryIds);
        evidenceTextByInsightId.set(
          insight.id,
          memoryIds
            .map((memoryId) => memoryContentById.get(memoryId))
            .filter((text): text is string => text !== undefined),
        );
      }

      const proposed = await this.stages.reason.propose(cluster, evidenceTextByInsightId);
      const validated = await this.stages.validate.validate(
        cluster,
        proposed,
        pipelineContext,
      );

      if (!validated) {
        continue;
      }

      const saved = await this.stages.persist.persist(
        validated,
        evidenceMemoryIdsByInsightId,
        pipelineContext,
      );
      conclusions.push(saved);
    }

    return conclusions;
  }
}

/**
 * Cierra el ciclo del Reasoning Engine -- submódulo de
 * `core/knowledge-engine` (instrucción explícita: razonar sobre
 * conocimiento ya validado, no un motor nuevo separado). Reutiliza
 * `DrizzleInsightRepository`/`DrizzleContradictionRepository` ya
 * existentes, nunca reimplementa su acceso a datos.
 */
export function createReasoningEngine(db: Database): ReasoningEngine {
  const insightRepository = new DrizzleInsightRepository(db);
  const reasoningRepository = new DrizzleReasoningRepository(db);
  const contradictionRepository = new DrizzleContradictionRepository(db);

  return new DefaultReasoningEngine({
    gather: new DefaultReasoningGatherStage(insightRepository),
    correlate: new DefaultReasoningCorrelateStage(insightRepository),
    reason: new AIReasoningStrategy(),
    validate: new DeterministicReasoningValidationStrategy(contradictionRepository),
    persist: new DefaultReasoningPersistStage(reasoningRepository),
    insightRepository,
  });
}
