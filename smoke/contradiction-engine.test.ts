import { db } from "../core/db/client";
import {
  DrizzleContradictionRepository,
  detectContradictions,
  type ContradictionCandidate,
  type ContradictionDetectionStrategy,
  type ProposedContradiction,
} from "../core/contradiction-engine";
import { createEntityId } from "../core/life";
import type { SmokeContext, SmokeFlow } from "./types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Estrategia de IA falsa -- mismo criterio que `FakeReasoningStrategy`
 * (`reasoning-engine.test.ts`): nunca depender de que un LLM real
 * clasifique algo de forma determinista. `callCount` prueba el
 * atajo real de `detectContradictions` (`against.length === 0` nunca
 * debe llamar a la estrategia).
 */
class FakeContradictionDetectionStrategy implements ContradictionDetectionStrategy {
  callCount = 0;

  constructor(private readonly response: ProposedContradiction[]) {}

  async detect(): Promise<ProposedContradiction[]> {
    this.callCount += 1;
    return this.response;
  }
}

export const contradictionEngineFlow: SmokeFlow = {
  name: "contradiction-engine",
  async run(ctx: SmokeContext) {
    const context = ctx.lifeGraphContext;
    const repository = new DrizzleContradictionRepository(db);

    const subject: ContradictionCandidate = {
      refType: "belief",
      refId: createEntityId(crypto.randomUUID()),
      text: "Smoke: quiere ahorrar para el viaje de fin de año",
    };
    const candidate: ContradictionCandidate = {
      refType: "goal",
      refId: createEntityId(crypto.randomUUID()),
      text: "Smoke: gastó el bono completo apenas lo recibió",
    };

    // Fixture 1: una propuesta con confianza suficiente (>=60) debe
    // persistirse tal cual -- kind, left/right y description reales,
    // nunca inventados por esta prueba.
    const acceptingStrategy = new FakeContradictionDetectionStrategy([
      { candidateIndex: 0, description: "Smoke: tensión entre ahorrar y gastar", confidence: 80 },
    ]);
    const created = await detectContradictions(
      repository,
      acceptingStrategy,
      context,
      subject,
      [candidate],
      "finances",
    );
    assert(created.length === 1, `se esperaba 1 contradicción persistida, se obtuvieron ${created.length}`);
    const contradiction = created[0];
    assert(contradiction.kind === "belief_goal", `kind incorrecto: ${contradiction.kind}`);
    assert(contradiction.left.refType === "belief" && contradiction.left.refId === subject.refId, "left no coincide con el subject");
    assert(contradiction.right.refType === "goal" && contradiction.right.refId === candidate.refId, "right no coincide con el candidate");
    assert(contradiction.description === "Smoke: tensión entre ahorrar y gastar", "description no coincide con la propuesta de la estrategia falsa");
    assert(contradiction.status === "open", `una contradicción recién detectada debe quedar 'open', fue '${contradiction.status}'`);

    // Fixture 2: confianza por debajo del umbral (60) -- nunca se
    // persiste, sin importar que la estrategia haya propuesto algo.
    const otherCandidate: ContradictionCandidate = {
      refType: "habit",
      refId: createEntityId(crypto.randomUUID()),
      text: "Smoke: hábito sin relación real",
    };
    const lowConfidenceStrategy = new FakeContradictionDetectionStrategy([
      { candidateIndex: 0, description: "Smoke: tensión débil", confidence: 40 },
    ]);
    const rejectedByConfidence = await detectContradictions(
      repository,
      lowConfidenceStrategy,
      context,
      subject,
      [otherCandidate],
      "finances",
    );
    assert(
      rejectedByConfidence.length === 0,
      `una propuesta con confianza 40 (<60) nunca debería persistirse, se obtuvieron ${rejectedByConfidence.length}`,
    );

    // Fixture 3: el mismo par (subject, candidate) de la Fixture 1 ya
    // tiene una contradicción 'open' -- detectar de nuevo sobre el
    // mismo par no debe crear un duplicado (pairAlreadyOpen).
    const dedupStrategy = new FakeContradictionDetectionStrategy([
      { candidateIndex: 0, description: "Smoke: misma tensión detectada otra vez", confidence: 90 },
    ]);
    const dedup = await detectContradictions(
      repository,
      dedupStrategy,
      context,
      subject,
      [candidate],
      "finances",
    );
    assert(
      dedup.length === 0,
      `un par ya abierto no debería producir una segunda contradicción, se obtuvieron ${dedup.length}`,
    );

    // Fixture 4: sin candidatos, `detectContradictions` debe volver
    // antes de invocar la estrategia -- ninguna llamada de IA
    // desperdiciada cuando no hay nada contra qué comparar.
    const unusedStrategy = new FakeContradictionDetectionStrategy([]);
    const emptyResult = await detectContradictions(
      repository,
      unusedStrategy,
      context,
      subject,
      [],
      "finances",
    );
    assert(emptyResult.length === 0, "sin candidatos, el resultado debe ser un arreglo vacío");
    assert(
      unusedStrategy.callCount === 0,
      `sin candidatos, la estrategia nunca debería llamarse, se llamó ${unusedStrategy.callCount} vez(ces)`,
    );
  },
};
