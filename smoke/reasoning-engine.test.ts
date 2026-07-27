import { db } from "../core/db/client";
import { DrizzleContradictionRepository } from "../core/contradiction-engine";
import { createEntityId, type EntityId } from "../core/life";
import {
  DefaultReasoningCorrelateStage,
  DefaultReasoningGatherStage,
  DefaultReasoningPersistStage,
  DeterministicReasoningValidationStrategy,
  DrizzleInsightRepository,
  DrizzleReasoningRepository,
  DefaultReasoningEngine,
  type ProposedReasoning,
  type ReasoningStrategy,
} from "../core/knowledge-engine";
import type { Context } from "../core/context-engine";
import type { Insight } from "../core/knowledge-engine/entities/insight";
import type { SmokeContext, SmokeFlow } from "./types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Estrategia de IA falsa -- inyectada en vez de `AIReasoningStrategy`
 * real, mismo criterio que el resto de este archivo (nunca depender de
 * que un LLM real clasifique algo de forma determinista, regla del
 * Founder: cada corrida debe ser repetible). Prueba la columna
 * vertebral determinista completa (Gather→Correlate→Validate→Persist)
 * sin gastar una llamada real de IA.
 */
class FakeReasoningStrategy implements ReasoningStrategy {
  constructor(private readonly response: ProposedReasoning | null) {}

  async propose(): Promise<ProposedReasoning | null> {
    return this.response;
  }
}

async function seedValidatedInsight(
  context: SmokeContext["lifeGraphContext"],
  description: string,
  now: Date,
): Promise<Insight> {
  const repository = new DrizzleInsightRepository(db);
  return repository.save(context, {
    id: createEntityId(crypto.randomUUID()),
    lifeGraphId: context.lifeGraphId,
    type: "pattern",
    description,
    confidence: { score: 80, assignedAt: now },
    status: "validated",
    createdAt: now,
    updatedAt: now,
    validatedAt: now,
  });
}

function toContextItem(insight: Insight, relevanceScore: number) {
  return {
    sourceId: insight.id,
    source: "insight" as const,
    label: insight.description,
    relevanceScore,
  };
}

export const reasoningEngineFlow: SmokeFlow = {
  name: "reasoning-engine",
  async run(ctx: SmokeContext) {
    const context = ctx.lifeGraphContext;
    const now = new Date();
    const insightRepository = new DrizzleInsightRepository(db);
    const reasoningRepository = new DrizzleReasoningRepository(db);
    const contradictionRepository = new DrizzleContradictionRepository(db);

    // Fixture 1: dos insights correlacionados (evidencia compartida) --
    // debería producir exactamente una conclusión persistida.
    const insightA = await seedValidatedInsight(
      context,
      "Smoke: trabaja hasta tarde con frecuencia entre semana",
      now,
    );
    const insightB = await seedValidatedInsight(
      context,
      "Smoke: reporta dormir poco entre semana",
      now,
    );

    await insightRepository.saveRelationship(context, {
      id: createEntityId(crypto.randomUUID()),
      lifeGraphId: context.lifeGraphId,
      fromInsightId: insightA.id,
      toInsightId: insightB.id,
      relationType: "shared_evidence",
      strength: 100,
      createdAt: now,
    });

    const memoryA = createEntityId(crypto.randomUUID());
    const memoryB = createEntityId(crypto.randomUUID());
    await insightRepository.saveEvidence(context, {
      id: createEntityId(crypto.randomUUID()),
      lifeGraphId: context.lifeGraphId,
      insightId: insightA.id,
      memoryId: memoryA,
      createdAt: now,
    });
    await insightRepository.saveEvidence(context, {
      id: createEntityId(crypto.randomUUID()),
      lifeGraphId: context.lifeGraphId,
      insightId: insightB.id,
      memoryId: memoryB,
      createdAt: now,
    });

    const memoryContentById = new Map<EntityId, string>([
      [memoryA, "Anoche me quedé trabajando hasta la 1am otra vez."],
      [memoryB, "Llevo toda la semana durmiendo como 5 horas."],
    ]);

    const twoInsightContext: Context = {
      id: createEntityId(crypto.randomUUID()),
      lifeGraphId: context.lifeGraphId,
      generatedAt: now,
      items: [toContextItem(insightA, 90), toContextItem(insightB, 85)],
    };

    const fakeStrategy = new FakeReasoningStrategy({
      conclusion: "Smoke: el ritmo de trabajo actual parece estar afectando su descanso.",
      confidence: 75,
      contradictingInsightIds: [],
      uncertaintyNotes: ["Basado en una sola semana de evidencia."],
    });

    const engine = new DefaultReasoningEngine({
      gather: new DefaultReasoningGatherStage(insightRepository),
      correlate: new DefaultReasoningCorrelateStage(insightRepository),
      reason: fakeStrategy,
      validate: new DeterministicReasoningValidationStrategy(contradictionRepository),
      persist: new DefaultReasoningPersistStage(reasoningRepository),
      insightRepository,
    });

    const conclusions = await engine.run(
      twoInsightContext,
      { ...context, memoryId: memoryA },
      memoryContentById,
    );

    assert(
      conclusions.length === 1,
      `se esperaba 1 conclusión persistida, se obtuvieron ${conclusions.length}`,
    );
    const conclusion = conclusions[0];
    assert(
      conclusion.statement.startsWith("Smoke:"),
      "la conclusión persistida no coincide con la propuesta de la estrategia falsa",
    );
    assert(
      conclusion.confidence.score === 75,
      `confianza persistida incorrecta: ${conclusion.confidence.score}`,
    );
    assert(conclusion.status === "validated", "una conclusión persistida debe quedar validated");
    assert(
      conclusion.uncertaintyNotes.length === 2,
      `se esperaban 2 notas de incertidumbre (1 de la IA + 1 determinista por tamaño mínimo de cluster), se obtuvieron ${conclusion.uncertaintyNotes.length}`,
    );

    const evidence = await reasoningRepository.getEvidence(context, conclusion.id);
    const supportingInsights = evidence.filter(
      (item) => item.ref.role === "supporting" && item.ref.refType === "insight",
    );
    const supportingMemories = evidence.filter(
      (item) => item.ref.role === "supporting" && item.ref.refType === "memory",
    );
    assert(
      supportingInsights.length === 2,
      `se esperaban 2 insights de apoyo persistidos, se obtuvieron ${supportingInsights.length}`,
    );
    assert(
      supportingMemories.length === 2,
      `se esperaban 2 memorias de apoyo persistidas, se obtuvieron ${supportingMemories.length}`,
    );

    // Fixture 2: un solo insight, sin relación -- evidencia
    // insuficiente, Validate debe rechazar sin llegar a persistir nada
    // (nunca una conclusión inventada de una sola pieza de evidencia).
    const insightC = await seedValidatedInsight(
      context,
      "Smoke: insight aislado sin relaciones",
      now,
    );
    const soloContext: Context = {
      id: createEntityId(crypto.randomUUID()),
      lifeGraphId: context.lifeGraphId,
      generatedAt: now,
      items: [toContextItem(insightC, 90)],
    };

    const rejectingConclusions = await engine.run(
      soloContext,
      { ...context, memoryId: memoryA },
      memoryContentById,
    );
    assert(
      rejectingConclusions.length === 0,
      `un cluster de un solo insight nunca debería producir una conclusión, se obtuvieron ${rejectingConclusions.length}`,
    );
  },
};
