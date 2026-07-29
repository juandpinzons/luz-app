import {
  DrizzleBeliefRepository,
  consolidateBeliefFromInsight,
  type BeliefConsolidationStrategy,
  type ProposedBeliefStatement,
} from "../core/belief-engine";
import { db } from "../core/db/client";
import { createEntityId } from "../core/life";
import type { Insight } from "../core/knowledge-engine/entities/insight";
import type { SmokeContext, SmokeFlow } from "./types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/** Estrategia de IA falsa -- mismo criterio que el resto de `smoke/`. */
class FakeBeliefConsolidationStrategy implements BeliefConsolidationStrategy {
  callCount = 0;

  constructor(private readonly response: ProposedBeliefStatement | null) {}

  async proposeStatement(): Promise<ProposedBeliefStatement | null> {
    this.callCount += 1;
    return this.response;
  }
}

function buildInsight(type: Insight["type"], description: string): Insight {
  const now = new Date();
  return {
    id: createEntityId(crypto.randomUUID()),
    lifeGraphId: createEntityId(crypto.randomUUID()),
    type,
    description,
    confidence: { score: 80, assignedAt: now },
    status: "validated",
    createdAt: now,
    updatedAt: now,
    validatedAt: now,
  };
}

export const beliefEngineFlow: SmokeFlow = {
  name: "belief-engine",
  async run(ctx: SmokeContext) {
    const context = ctx.lifeGraphContext;
    const repository = new DrizzleBeliefRepository(db);
    const evidence = [{ id: createEntityId(crypto.randomUUID()), content: "Smoke: memoria de evidencia" }];

    // Fixture 1: tipo de insight no elegible ("risk" es situacional,
    // nunca describe un rasgo duradero) -- nunca debe llamar a la IA.
    const riskInsight = buildInsight("risk", "Smoke: riesgo puntual, no un rasgo");
    const unusedStrategy = new FakeBeliefConsolidationStrategy({
      statement: "Smoke: no debería usarse",
      domain: "health",
      confidence: 90,
    });
    const ineligible = await consolidateBeliefFromInsight(
      repository,
      unusedStrategy,
      context,
      riskInsight,
      evidence,
    );
    assert(ineligible === null, "un insight tipo 'risk' nunca debería consolidar una creencia");
    assert(unusedStrategy.callCount === 0, "un tipo no elegible nunca debería llamar a la estrategia");

    // Fixture 2: sin memorias de evidencia -- mismo criterio, gate
    // antes de gastar una llamada de IA.
    const factInsight = buildInsight("fact", "Smoke: hecho sin evidencia adjunta");
    const noEvidenceResult = await consolidateBeliefFromInsight(
      repository,
      unusedStrategy,
      context,
      factInsight,
      [],
    );
    assert(noEvidenceResult === null, "sin memorias de evidencia, nunca debería consolidar nada");

    // Fixture 3: confianza propuesta por debajo del umbral (55) --
    // nunca se persiste.
    const lowConfidenceStrategy = new FakeBeliefConsolidationStrategy({
      statement: "Smoke: afirmación débil",
      domain: "health",
      confidence: 30,
    });
    const belowThreshold = await consolidateBeliefFromInsight(
      repository,
      lowConfidenceStrategy,
      context,
      factInsight,
      evidence,
    );
    assert(belowThreshold === null, "una propuesta con confianza 30 (<55) nunca debería persistirse");

    // Fixture 4: propuesta válida, sin creencia previa que coincida --
    // debe crear una nueva, con status 'active' y confianza tal cual
    // la propuso la estrategia. Texto único por corrida (nunca un
    // literal fijo): este flujo puede correr solo (`--flow belief-engine`)
    // varias veces sin que `resetTestAccount` limpie entre medio (solo
    // se llama al inicio de una corrida de la suite completa) -- un
    // texto fijo colisionaría con una creencia real dejada por una
    // corrida standalone anterior y esta fixture "reforzaría" en vez de
    // "crear", un falso negativo silencioso.
    const statement = `Smoke ${crypto.randomUUID()}: es una persona muy disciplinada con su salud`;
    const creatingStrategy = new FakeBeliefConsolidationStrategy({
      statement,
      domain: "health",
      confidence: 70,
    });
    const created = await consolidateBeliefFromInsight(
      repository,
      creatingStrategy,
      context,
      factInsight,
      evidence,
    );
    assert(created !== null, "una propuesta válida sin creencia previa debería crear una nueva");
    assert(created.action === "created", `action incorrecta: ${created?.action}`);
    assert(created.belief.status === "active", `status incorrecto: ${created?.belief.status}`);
    assert(created.belief.confidence.score === 70, `confianza incorrecta: ${created?.belief.confidence.score}`);
    assert(
      created.belief.category === "life_domain",
      `sin category propuesto explícitamente, debe recaer en 'life_domain' por defecto, fue '${created?.belief.category}'`,
    );

    const historyAfterCreate = await repository.getHistory(context, created.belief.id);
    assert(historyAfterCreate.length === 1, `se esperaba 1 entrada de historial tras crear, hubo ${historyAfterCreate.length}`);
    assert(historyAfterCreate[0]?.previousConfidence === undefined, "una creencia recién creada no debería tener previousConfidence");

    // Fixture 5: un segundo insight sobre la MISMA afirmación (mismo
    // texto, `titlesLikelyMatch` la reconoce) debe reforzar la
    // creencia existente, nunca duplicarla -- confianza promediada +
    // bono de refuerzo, historial con previousConfidence real.
    const reinforcingStrategy = new FakeBeliefConsolidationStrategy({
      statement,
      domain: "health",
      confidence: 80,
    });
    const patternInsight = buildInsight("pattern", "Smoke: segundo insight, mismo rasgo");
    const reinforced = await consolidateBeliefFromInsight(
      repository,
      reinforcingStrategy,
      context,
      patternInsight,
      evidence,
    );
    assert(reinforced !== null, "una segunda propuesta sobre la misma afirmación debería reforzar, no fallar");
    assert(reinforced.action === "reinforced", `action incorrecta: ${reinforced?.action}`);
    assert(
      reinforced.belief.id === created.belief.id,
      "reforzar debe actualizar la MISMA fila, nunca crear una creencia duplicada",
    );
    // (70 + 80) / 2 = 75, + bono de refuerzo (8) = 83.
    assert(
      reinforced.belief.confidence.score === 83,
      `confianza reforzada incorrecta: ${reinforced?.belief.confidence.score} (se esperaba 83)`,
    );

    const historyAfterReinforce = await repository.getHistory(context, created.belief.id);
    assert(
      historyAfterReinforce.length === 2,
      `se esperaban 2 entradas de historial tras reforzar, hubo ${historyAfterReinforce.length}`,
    );
    const reinforceEntry = historyAfterReinforce.find((entry) => entry.previousConfidence === 70);
    assert(reinforceEntry !== undefined, "el historial debe registrar previousConfidence=70 (la confianza antes del refuerzo)");
    assert(reinforceEntry?.newConfidence === 83, `newConfidence incorrecto en el historial: ${reinforceEntry?.newConfidence}`);

    // Fixture 6 (Fast User Understanding): una propuesta con
    // category: "communication_style" debe persistirse con esa
    // categoría y sin domain -- y, más importante, un texto IDÉNTICO
    // propuesto después con category "life_domain" (default) NUNCA
    // debe fusionarse con ella solo porque el texto coincide
    // (findMatchingBelief exige category igual, no solo texto/domain
    // -- el bug real que este cambio previene: una preferencia de
    // comunicación fusionándose por accidente con una creencia de área
    // de vida no relacionada).
    const styleStatement = `Smoke ${crypto.randomUUID()}: prefiere respuestas cortas y directas, sin rodeos`;
    const styleStrategy = new FakeBeliefConsolidationStrategy({
      statement: styleStatement,
      category: "communication_style",
      confidence: 75,
    });
    const styleInsight = buildInsight("preference", "Smoke: pidió respuestas más cortas explícitamente");
    const styleResult = await consolidateBeliefFromInsight(
      repository,
      styleStrategy,
      context,
      styleInsight,
      evidence,
    );
    assert(styleResult !== null, "una propuesta de estilo de comunicación válida debería persistirse");
    assert(
      styleResult.belief.category === "communication_style",
      `category incorrecta: ${styleResult?.belief.category}`,
    );
    assert(styleResult.belief.domain === undefined, "una creencia de estilo de comunicación nunca debería tener domain");

    const crossCategoryStrategy = new FakeBeliefConsolidationStrategy({
      statement: styleStatement, // mismo texto exacto a propósito
      category: "life_domain",
      confidence: 75,
    });
    const crossCategoryInsight = buildInsight("preference", "Smoke: insight distinto, mismo texto de creencia");
    const crossCategoryResult = await consolidateBeliefFromInsight(
      repository,
      crossCategoryStrategy,
      context,
      crossCategoryInsight,
      evidence,
    );
    assert(crossCategoryResult !== null, "la segunda propuesta también debería persistirse (como creación nueva)");
    assert(
      crossCategoryResult.action === "created",
      `un texto idéntico pero con category distinta NUNCA debe fusionarse (findMatchingBelief debe exigir category igual) -- se esperaba 'created', fue '${crossCategoryResult?.action}'`,
    );
    assert(
      crossCategoryResult.belief.id !== styleResult.belief.id,
      "las dos creencias deben ser filas distintas -- una de comunicación, una de vida, nunca la misma",
    );
  },
};
