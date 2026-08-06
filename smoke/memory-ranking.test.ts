import {
  DeterministicMemoryRankingStrategy,
  MIN_SCORE_WITH_UNDERSTANDING_SIGNAL,
} from "../core/memory-engine/ranking/deterministic-memory-ranking-strategy";
import { createEntityId } from "../core/life/value-objects/entity-id";
import type { LifeGraphContext } from "../core/life";
import type { Memory } from "../core/memory-engine/entities/memory";
import type { SmokeFlow } from "./types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const CONTEXT: LifeGraphContext = {
  lifeGraphId: createEntityId("00000000-0000-0000-0000-000000000001"),
  personId: createEntityId("00000000-0000-0000-0000-000000000002"),
};

function memoryWithContent(content: string): Memory {
  const now = new Date();
  return {
    id: createEntityId("00000000-0000-0000-0000-000000000003"),
    lifeGraphId: CONTEXT.lifeGraphId,
    type: "fact",
    content,
    source: "conversation",
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Pura, sin IO, sin DB -- mismo criterio que `knowledge-gaps.test.ts`.
 * Regresión directa del incidente 2026-08-06 (Founder): un dato
 * financiero puntual quedaba siempre bajo `MIN_SCORE_WITH_UNDERSTANDING_SIGNAL`
 * (piso estructural 15-19, caso real documentado en
 * `assemble-reality-snapshot.ts`: rank_score=19 para el gasto de agosto
 * 1) porque `UNDERSTANDING_SIGNALS` nunca tuvo categoría para esto, no
 * por un umbral mal calibrado -- ver el comentario en
 * `deterministic-memory-ranking-strategy.ts` junto a `financial_tracking`.
 */
export const memoryRankingFlow: SmokeFlow = {
  name: "memory-ranking",
  async run() {
    const strategy = new DeterministicMemoryRankingStrategy();

    const financial = await strategy.rank(
      CONTEXT,
      memoryWithContent("Gasté 30.000 en Uber y 55.000 en el mercado"),
    );
    assert(
      financial.score >= MIN_SCORE_WITH_UNDERSTANDING_SIGNAL,
      `un gasto reportado debería alcanzar señal de comprensión (>=${MIN_SCORE_WITH_UNDERSTANDING_SIGNAL}), obtuvo ${financial.score}`,
    );

    // Guarda de regresión: un hecho genérico sin ninguna señal real
    // sigue en el piso estructural -- esta prueba no debe volverse
    // trivial subiendo el score de todo.
    const generic = await strategy.rank(
      CONTEXT,
      memoryWithContent("El clima estuvo agradable hoy"),
    );
    assert(
      generic.score < MIN_SCORE_WITH_UNDERSTANDING_SIGNAL,
      `un hecho sin ninguna señal de comprensión debería quedar bajo el umbral, obtuvo ${generic.score}`,
    );
  },
};
