import type { LifeGraphContext } from "../../life/life-graph-context";
import { createEntityId } from "../../life/value-objects/entity-id";
import type { MemoryClassifier } from "../classification/memory-classifier";
import type { Memory } from "../entities/memory";
import type { MemoryRepository } from "../repositories/memory.repository";
import type { CaptureStage, MemoryCaptureInput } from "./capture-stage";

/**
 * Orquesta Capture: pide el tipo al clasificador solo si `input.type`
 * viene vacío, y siempre delega la persistencia en `MemoryRepository`
 * — no construye SQL ni conoce Drizzle directamente, por eso no lleva
 * el prefijo `Drizzle*` como los repositorios (PR-009).
 *
 * Toda memoria nace `status: "active"` y sin `rank`: rankear es la
 * etapa siguiente del lifecycle (MEMORY_ENGINE_SPEC.md: Capture →
 * Rank → Connect...), no algo que Capture decida por adelantado.
 * `occurredAt` se deja tal cual venga en `input` — nunca se sustituye
 * por `now()`: cuándo ocurrió algo en la vida de la persona y cuándo
 * el sistema lo capturó son cosas distintas.
 */
export class DefaultCaptureStage implements CaptureStage {
  constructor(
    private readonly repository: MemoryRepository,
    private readonly classifier: MemoryClassifier,
  ) {}

  async capture(
    context: LifeGraphContext,
    input: MemoryCaptureInput,
  ): Promise<Memory> {
    const type =
      input.type ?? (await this.classifier.classify(context, input.content));
    const now = new Date();

    const memory: Memory = {
      id: createEntityId(crypto.randomUUID()),
      lifeGraphId: context.lifeGraphId,
      personId: input.personId,
      type,
      content: input.content,
      source: input.source,
      sourceId: input.sourceId,
      status: "active",
      occurredAt: input.occurredAt,
      createdAt: now,
      updatedAt: now,
    };

    return this.repository.save(context, memory);
  }
}
