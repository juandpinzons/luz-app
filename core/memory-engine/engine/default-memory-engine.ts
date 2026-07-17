import type { Database } from "../../db/client";
import type { LifeGraphContext } from "../../life/life-graph-context";
import type { EntityId } from "../../life/value-objects/entity-id";
import { DeterministicMemoryClassifier } from "../classification/deterministic-memory-classifier";
import type { Memory } from "../entities/memory";
import { DefaultArchiveStage } from "../lifecycle/default-archive-stage";
import { DefaultCaptureStage } from "../lifecycle/default-capture-stage";
import type { MemoryCaptureInput } from "../lifecycle/capture-stage";
import { DefaultConnectStage } from "../lifecycle/default-connect-stage";
import { DefaultForgetStage } from "../lifecycle/default-forget-stage";
import { DeterministicMemoryRankingStrategy } from "../ranking/deterministic-memory-ranking-strategy";
import { DrizzleMemoryRepository } from "../repositories/drizzle-memory.repository";
import type { MemoryRepository } from "../repositories/memory.repository";
import type { MemoryQuery } from "../retrieval/memory-query";
import { StructuredMemoryRetrievalStrategy } from "../retrieval/structured-memory-retrieval-strategy";
import type { MemoryEngine, MemoryEngineStages } from "./memory-engine";

/**
 * Compone las siete etapas ya reales (PR-010 a PR-016) en el único
 * punto de acceso que el resto del dominio debería usar — nunca
 * `MemoryRepository` directamente, igual que `KnowledgeEngine`
 * (core/knowledge/knowledge-engine.ts). Solo orquesta: cada decisión
 * de negocio (qué tipo asignar, cuánto vale una memoria, con qué se
 * conecta) vive en su propia etapa/estrategia, no aquí.
 *
 * `repository` es una dependencia adicional a `MemoryEngineStages`, no
 * parte de ese tipo: `MemoryRankingStrategy.rank()` es, a propósito,
 * una estrategia pura sin capacidad de persistencia (ver
 * ranking/memory-ranking-strategy.ts). Alguien tiene que guardar el
 * `MemoryRank` que produce — ese alguien es este orquestador
 * (lifecycle orchestration), no la estrategia ni el repositorio
 * mismos.
 *
 * `stages.classify` no se invoca directamente aquí: `DefaultCaptureStage`
 * ya lo recibió como su propia dependencia (ver factory más abajo) y
 * lo usa internamente cuando `input.type` viene vacío. Sigue siendo
 * parte de `MemoryEngineStages` porque el tipo lo exige, no porque este
 * orquestador lo llame dos veces.
 */
export class DefaultMemoryEngine implements MemoryEngine {
  constructor(
    private readonly stages: MemoryEngineStages,
    private readonly repository: MemoryRepository,
  ) {}

  /**
   * Capture → Rank → Connect, en ese orden (MEMORY_ENGINE_SPEC.md).
   * Rank y Connect no son endpoints públicos de `MemoryEngine` —
   * ocurren aquí, dentro de `capture`, porque no existe otro punto de
   * entrada que los dispare.
   */
  async capture(
    context: LifeGraphContext,
    input: MemoryCaptureInput,
  ): Promise<Memory> {
    const captured = await this.stages.capture.capture(context, input);
    const rank = await this.stages.rank.rank(context, captured);

    const ranked = await this.repository.save(context, {
      ...captured,
      rank,
      updatedAt: new Date(),
    });

    await this.stages.connect.connect(context, ranked.id);

    return ranked;
  }

  async retrieve(
    context: LifeGraphContext,
    query: MemoryQuery,
  ): Promise<Memory[]> {
    return this.stages.retrieve.retrieve(context, query);
  }

  async archive(
    context: LifeGraphContext,
    memoryId: EntityId,
  ): Promise<Memory> {
    return this.stages.archive.archive(context, memoryId);
  }

  async forget(context: LifeGraphContext, memoryId: EntityId): Promise<void> {
    return this.stages.forget.forget(context, memoryId);
  }
}

export function createMemoryEngine(db: Database): MemoryEngine {
  const repository = new DrizzleMemoryRepository(db);
  const classifier = new DeterministicMemoryClassifier();

  const stages: MemoryEngineStages = {
    capture: new DefaultCaptureStage(repository, classifier),
    classify: classifier,
    rank: new DeterministicMemoryRankingStrategy(),
    connect: new DefaultConnectStage(repository),
    retrieve: new StructuredMemoryRetrievalStrategy(db),
    archive: new DefaultArchiveStage(repository),
    forget: new DefaultForgetStage(repository),
  };

  return new DefaultMemoryEngine(stages, repository);
}
