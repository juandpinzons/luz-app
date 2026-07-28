import { DeterministicImportanceScoringStrategy } from "../core/importance-engine";
import type { SmokeFlow } from "./types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Pura, sin IO, sin DB -- mismo criterio que `predictive-engine.test.ts`/
 * `knowledge-gaps.test.ts`. Alimenta directamente
 * `DeterministicContextScoringStrategy.importanceBonus` -- ya
 * verificado en una auditoría anterior que está conectado al chat real
 * en los 3 call sites de producción (`build-context.ts`,
 * `enrich-knowledge-graph.ts`, `build-morning-brief.ts`). Un error en
 * esta fórmula desordenaría silenciosamente qué contenido llega al
 * prompt del LLM.
 */
export const importanceEngineFlow: SmokeFlow = {
  name: "importance-engine",
  async run() {
    const strategy = new DeterministicImportanceScoringStrategy();

    // Sin ninguna señal, score real es 0 -- nunca un piso artificial.
    const empty = strategy.compute({ evidenceCount: 0 });
    assert(empty.score === 0, `sin señales, el score debería ser 0, fue ${empty.score}`);

    // evidenceCount: 12 por unidad, tope en 60 (documentado) -- 5
    // piezas de evidencia ya alcanzan el tope, una sexta no debería
    // sumar más.
    const fourEvidence = strategy.compute({ evidenceCount: 4 });
    assert(fourEvidence.score === 48, `4 evidencias * 12 = 48 esperado, fue ${fourEvidence.score}`);
    const fiveEvidence = strategy.compute({ evidenceCount: 5 });
    assert(fiveEvidence.score === 60, `5 evidencias debería alcanzar el tope de 60, fue ${fiveEvidence.score}`);
    const tenEvidence = strategy.compute({ evidenceCount: 10 });
    assert(tenEvidence.score === 60, `por encima del tope, el score de evidencia nunca debería exceder 60, fue ${tenEvidence.score}`);

    // confidence: redondeado a confidence * 0.2 -- solo cuenta si está
    // definido (una entidad sin confianza propia, ej. un Concept, no
    // debería sumar nada por este término).
    const withConfidence = strategy.compute({ evidenceCount: 0, confidence: 80 });
    assert(withConfidence.score === 16, `confianza 80 * 0.2 = 16 esperado, fue ${withConfidence.score}`);
    const withoutConfidence = strategy.compute({ evidenceCount: 0 });
    assert(withoutConfidence.score === 0, "sin confidence definido, el término no debería aportar nada");
    assert(
      !withoutConfidence.reason.includes("confianza"),
      "el reason nunca debería mencionar confianza si la señal no vino definida",
    );

    // connectionCount: 5 por unidad, tope en 15 (3 conexiones ya
    // alcanzan el tope).
    const twoConnections = strategy.compute({ evidenceCount: 0, connectionCount: 2 });
    assert(twoConnections.score === 10, `2 conexiones * 5 = 10 esperado, fue ${twoConnections.score}`);
    const fiveConnections = strategy.compute({ evidenceCount: 0, connectionCount: 5 });
    assert(fiveConnections.score === 15, `por encima del tope, connectionCount nunca debería exceder 15, fue ${fiveConnections.score}`);

    // recencyDays: decae linealmente de 10 (hoy) a 0 (60+ días) --
    // límites reales de la ventana.
    const today = strategy.compute({ evidenceCount: 0, recencyDays: 0 });
    assert(today.score === 10, `actividad hoy (recencyDays=0) debería sumar el máximo (10), fue ${today.score}`);
    const atWindowEdge = strategy.compute({ evidenceCount: 0, recencyDays: 60 });
    assert(atWindowEdge.score === 0, `en el borde de la ventana (60 días), recency no debería sumar nada, fue ${atWindowEdge.score}`);
    const beyondWindow = strategy.compute({ evidenceCount: 0, recencyDays: 120 });
    assert(beyondWindow.score === 0, `más allá de la ventana, recency nunca debería sumar ni volverse negativo, fue ${beyondWindow.score}`);

    // involvedInOpenContradiction: bono fijo de +5, nunca una
    // penalización -- una tensión viva merece atención, no castigo
    // (docblock de ImportanceSignals).
    const contradicting = strategy.compute({ evidenceCount: 0, involvedInOpenContradiction: true });
    assert(contradicting.score === 5, `contradicción abierta debería sumar +5, fue ${contradicting.score}`);

    // Todas las señales combinadas, sin exceder el tope global de 100.
    const maxed = strategy.compute({
      evidenceCount: 10,
      confidence: 100,
      connectionCount: 10,
      recencyDays: 0,
      involvedInOpenContradiction: true,
    });
    // 60 (evidencia, tope) + 20 (confianza 100*0.2) + 15 (conexiones, tope) + 10 (recency hoy) + 5 (contradicción) = 110 -> tope 100.
    assert(maxed.score === 100, `la suma de todas las señales al máximo (110 en teoría) debe recortarse a 100, fue ${maxed.score}`);
  },
};
