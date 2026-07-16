import type { LifeGraphContext } from "../../life/life-graph-context";
import type { EntityId } from "../../life/value-objects/entity-id";
import type { ArchiveStage } from "../lifecycle/archive-stage";
import type { CaptureStage, MemoryCaptureInput } from "../lifecycle/capture-stage";
import type { ConnectStage } from "../lifecycle/connect-stage";
import type { ForgetStage } from "../lifecycle/forget-stage";
import type { MemoryClassifier } from "../classification/memory-classifier";
import type { MemoryRankingStrategy } from "../ranking/memory-ranking-strategy";
import type { MemoryQuery } from "../retrieval/memory-query";
import type { MemoryRetrievalStrategy } from "../retrieval/memory-retrieval-strategy";
import type { Memory } from "../entities/memory";

/**
 * Las dependencias que una implementación de `MemoryEngine` compone.
 * Solo el tipo — a diferencia de `KnowledgeEngineStages`
 * (`core/knowledge/knowledge-engine.ts`), no hay ninguna clase que las
 * orqueste todavía: eso es lógica de negocio, fuera de alcance de
 * Milestone 3.
 */
export interface MemoryEngineStages {
  capture: CaptureStage;
  classify: MemoryClassifier;
  rank: MemoryRankingStrategy;
  connect: ConnectStage;
  retrieve: MemoryRetrievalStrategy;
  archive: ArchiveStage;
  forget: ForgetStage;
}

/**
 * Único punto de acceso al Memory Engine que vería el resto del
 * dominio (Knowledge, Context, features) — nunca `MemoryRepository`
 * directamente, igual que `MemoryEngine` en el `core/memory` actual.
 * Contrato únicamente: sin implementación.
 */
export interface MemoryEngine {
  capture(context: LifeGraphContext, input: MemoryCaptureInput): Promise<Memory>;
  retrieve(context: LifeGraphContext, query: MemoryQuery): Promise<Memory[]>;
  archive(context: LifeGraphContext, memoryId: EntityId): Promise<Memory>;
  forget(context: LifeGraphContext, memoryId: EntityId): Promise<void>;
}
