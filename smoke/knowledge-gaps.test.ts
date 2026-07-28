import {
  computeDomainCoverage,
  rankKnowledgeGaps,
  type DomainCoverageSignals,
} from "../core/knowledge-gaps";
import { LIFE_DOMAIN_TYPES } from "../core/life";
import type { SmokeFlow } from "./types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const EMPTY: DomainCoverageSignals = {
  goalsCount: 0,
  projectsCount: 0,
  habitsCount: 0,
  beliefsCount: 0,
  conceptsCount: 0,
};

/**
 * Pura, sin IO, sin DB -- mismo criterio que `predictive-engine.test.ts`.
 * `computeDomainCoverage`/`rankKnowledgeGaps` son el mecanismo real de
 * disparo de Curiosity Engine (`CuriosityStrategyRule`,
 * `generateCuriosityQuestion`), nunca antes ejercitados directamente:
 * `curiosity-engine.test.ts` recibe `DomainCoverage` ya calculado a
 * mano, no pasa por estas dos funciones.
 */
export const knowledgeGapsFlow: SmokeFlow = {
  name: "knowledge-gaps",
  async run() {
    // Sin ninguna señal, cobertura real es 0 -- la ausencia se
    // representa como ausencia, nunca un piso artificial.
    assert(computeDomainCoverage(EMPTY) === 0, `sin señales, la cobertura debería ser 0, fue ${computeDomainCoverage(EMPTY)}`);

    // Pesos exactos documentados: goals=15, projects=10, habits=10,
    // beliefs=20, concepts=10 -- un cambio accidental en cualquiera de
    // estos números movería el umbral real de Curiosity Engine
    // (CURIOSITY_GAP_THRESHOLD=25) sin que nadie lo decidiera a
    // propósito.
    assert(computeDomainCoverage({ ...EMPTY, goalsCount: 1 }) === 15, "peso de goalsCount incorrecto");
    assert(computeDomainCoverage({ ...EMPTY, projectsCount: 1 }) === 10, "peso de projectsCount incorrecto");
    assert(computeDomainCoverage({ ...EMPTY, habitsCount: 1 }) === 10, "peso de habitsCount incorrecto");
    assert(computeDomainCoverage({ ...EMPTY, beliefsCount: 1 }) === 20, "peso de beliefsCount incorrecto");
    assert(computeDomainCoverage({ ...EMPTY, conceptsCount: 1 }) === 10, "peso de conceptsCount incorrecto");

    // Suma real de varias señales combinadas -- nunca solo la señal más
    // fuerte, todas contribuyen.
    const combined = computeDomainCoverage({
      goalsCount: 1,
      projectsCount: 1,
      habitsCount: 0,
      beliefsCount: 1,
      conceptsCount: 0,
    });
    assert(combined === 45, `15+10+20=45 esperado, fue ${combined}`);

    // Tope real en 100 -- suficiente evidencia acumulada no debe
    // producir un puntaje que exceda la escala 0-100 que el resto del
    // sistema asume (CuriosityStrategyRule, Identity Model).
    const overloaded = computeDomainCoverage({
      goalsCount: 5,
      projectsCount: 5,
      habitsCount: 5,
      beliefsCount: 5,
      conceptsCount: 5,
    });
    assert(overloaded === 100, `la cobertura nunca debería exceder 100, fue ${overloaded}`);

    // rankKnowledgeGaps: una fila por cada uno de los 8 LifeDomainType
    // reales, sin importar cuáles tengan señal -- un dominio ausente
    // de `signalsByDomain` cuenta como cobertura 0, nunca se omite de
    // la lista.
    const ranked = rankKnowledgeGaps({
      career: { ...EMPTY, goalsCount: 2 }, // 30
      health: { ...EMPTY, beliefsCount: 1 }, // 20
      // el resto de los 8 dominios queda sin señal -- deben aparecer con coverageScore 0.
    });
    assert(ranked.length === LIFE_DOMAIN_TYPES.length, `se esperaban ${LIFE_DOMAIN_TYPES.length} filas (una por dominio), se obtuvieron ${ranked.length}`);

    // Orden ascendente por cobertura -- el menos entendido primero,
    // convención que CuriosityStrategyRule/Identity Model asumen sin
    // volver a ordenar.
    for (let i = 1; i < ranked.length; i += 1) {
      assert(
        ranked[i]!.coverageScore >= ranked[i - 1]!.coverageScore,
        `rankKnowledgeGaps debe devolver orden ascendente por coverageScore, falló entre las posiciones ${i - 1} y ${i}`,
      );
    }

    const career = ranked.find((r) => r.domain === "career");
    const health = ranked.find((r) => r.domain === "health");
    const untouchedDomain = ranked.find((r) => r.domain === "leisure");
    assert(career?.coverageScore === 30, `career debería tener coverageScore 30, fue ${career?.coverageScore}`);
    assert(health?.coverageScore === 20, `health debería tener coverageScore 20, fue ${health?.coverageScore}`);
    assert(
      untouchedDomain?.coverageScore === 0,
      `un dominio sin ninguna señal debería tener coverageScore 0 (ausencia real, nunca omitido), fue ${untouchedDomain?.coverageScore}`,
    );
  },
};
