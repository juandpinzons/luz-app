import { eq } from "drizzle-orm";
import { db } from "../core/db/client";
import { memories } from "../core/db/schema";
import { selectContextualMemories } from "../features/chat/services/select-contextual-memories";
import { DeterministicMemoryRankingStrategy } from "../core/memory-engine/ranking/deterministic-memory-ranking-strategy";
import { createEntityId, type EntityId } from "../core/life";
import type { Memory } from "../core/memory-engine";
import type { SmokeContext, SmokeFlow } from "./types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const rankingStrategy = new DeterministicMemoryRankingStrategy();

/**
 * Rank calculado con la estrategia real (`DeterministicMemoryRankingStrategy`),
 * nunca fijado a mano -- este test existe específicamente para probar
 * que P1-6 (categoría `financial_tracking`) y el ensanche de
 * agregación funcionan juntos con el mecanismo real, no con un score
 * inventado que solo demostraría lo que ya se asume.
 */
async function seedMemory(
  context: SmokeContext["lifeGraphContext"],
  content: string,
  daysAgo: number,
): Promise<EntityId> {
  const occurredAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
  const draft: Memory = {
    id: createEntityId(crypto.randomUUID()),
    lifeGraphId: context.lifeGraphId,
    type: "fact",
    content,
    source: "conversation",
    status: "active",
    occurredAt,
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
  const rank = await rankingStrategy.rank(context, draft);

  const [row] = await db
    .insert(memories)
    .values({
      lifeGraphId: context.lifeGraphId,
      type: "fact",
      content,
      source: "conversation",
      status: "active",
      rankScore: rank.score,
      rankedAt: rank.rankedAt,
      occurredAt,
    })
    .returning({ id: memories.id });
  return createEntityId(row!.id);
}

/**
 * Regresión real de la escalada War Room 2026-08-09 (P1-7/P1-8):
 * "cuánto he gastado en total" no comparte ningún token con ninguna
 * de las tres memorias de gasto reales de abajo -- sin el ensanche de
 * agregación, el límite normal (5) más el ranking por palabra
 * compartida las habría dejado fuera casi con certeza frente a
 * cualquier otra memoria de mayor rank_score sin relación. Corre
 * contra Postgres real, memorias reales insertadas para esta corrida
 * (nunca contra un `Memory[]` fabricado a mano) -- exactamente el tipo
 * de caso que un test puramente determinista no puede probar, porque
 * depende de `DeterministicMemoryRankingStrategy` real corriendo sobre
 * contenido real vía `MemoryEngine.retrieve()`.
 */
export const aggregationQueryFlow: SmokeFlow = {
  name: "aggregation-query",
  async run(ctx) {
    const context = ctx.lifeGraphContext;

    const expenseIds = await Promise.all([
      seedMemory(context, "Gasté 30.000 en Uber esta semana.", 3),
      seedMemory(context, "Pagué 55.000 en el mercado el martes.", 2),
      seedMemory(context, "Compré unos audífonos nuevos por 120.000.", 1),
    ]);
    // Ruido: mismo `type` ("fact", el default del clasificador), sin
    // ninguna señal financiera -- no debería colarse en el ensanche.
    const noiseId = await seedMemory(context, "El clima estuvo agradable hoy.", 1);

    try {
      // `limit: 2`, no 5 -- con solo 4 memorias sembradas para esta
      // corrida (cuenta fixture recién reseteada por el runner, sin
      // nada más en el pool), un límite de 5 habría dejado entrar las
      // 4 sin importar el ranking, sin probar nada real sobre exclusión.
      // En 2, el ruido queda fuera de la franja inicial por relevancia
      // (rank_score 19 pierde contra 49) -- si de todas formas aparece
      // en el resultado, tuvo que ser el paso de ensanche, que es
      // exactamente lo que este test verifica.
      const aggregationResult = await selectContextualMemories(
        db,
        context,
        "¿Cuánto he gastado en total esta semana?",
        2,
      );
      const aggregationIds = new Set(aggregationResult.map((m) => m.id));

      for (const id of expenseIds) {
        assert(
          aggregationIds.has(id),
          `una pregunta de agregación debería incluir la memoria de gasto ${id}, no se encontró entre ${aggregationResult.length} resultados`,
        );
      }
      assert(
        !aggregationIds.has(noiseId),
        "el ensanche de agregación no debería incluir una memoria sin señal financiera solo por compartir tipo",
      );
      assert(
        aggregationResult.length <= 15,
        `el ensanche de agregación debe seguir acotado, obtuvo ${aggregationResult.length}`,
      );

      // Guarda de regresión: una pregunta puntual, no de agregación,
      // nunca debe activar el ensanche -- el límite pedido (2) sigue
      // aplicando sin cambios, aunque haya más candidatas reales.
      const pointResult = await selectContextualMemories(
        db,
        context,
        "¿Qué compré ayer?",
        2,
      );
      assert(
        pointResult.length <= 2,
        `una pregunta puntual no debería ensancharse más allá del límite pedido, obtuvo ${pointResult.length}`,
      );
    } finally {
      for (const id of [...expenseIds, noiseId]) {
        await db.delete(memories).where(eq(memories.id, id));
      }
    }
  },
};
