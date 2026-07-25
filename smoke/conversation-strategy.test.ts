import { db } from "../core/db/client";
import { createContextEngine } from "../core/context-engine";
import {
  createConversationStrategyEngine,
  CONVERSATION_STRATEGY_TYPES,
  type ConversationStrategyType,
} from "../core/conversation-strategy-engine";
import { buildContext } from "../features/chat/context-builder";
import { createEntityId, type LifeGraphContext } from "../core/life";
import type { RealitySnapshot } from "../core/reality";
import type { SmokeContext, SmokeFlow } from "./types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const FIXTURE_LIFE_GRAPH: LifeGraphContext = {
  lifeGraphId: createEntityId("00000000-0000-0000-0000-0000000000f1"),
  personId: createEntityId("00000000-0000-0000-0000-0000000000f2"),
};

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function emptySnapshot(): RealitySnapshot {
  return {
    lifeGraphId: FIXTURE_LIFE_GRAPH.lifeGraphId,
    capturedAt: new Date(),
    life: { activeGoals: [], activeProjects: [], activeHabits: [] },
    memory: { items: [] },
    insights: { items: [] },
    signals: { signals: [] },
  };
}

/**
 * Corre el pipeline real Context Engine -> Conversation Strategy
 * Engine sobre un `RealitySnapshot` fabricado a mano -- nunca
 * contextItems fabricados a mano, para no duplicar (y arriesgar
 * desincronizar) la lógica real de `DeterministicContextFilterStrategy`/
 * `DeterministicContextScoringStrategy`/`DeterministicContextPrioritizationStrategy`.
 * Esto prueba la frontera exacta que este sprint agrega: Context
 * Engine ya decidido -> Conversation Strategy Engine decide cómo
 * conversar.
 */
async function selectStrategyFor(
  snapshot: RealitySnapshot,
  isFirstContact: boolean,
): Promise<ConversationStrategyType> {
  const engineContext = await createContextEngine().build(snapshot, FIXTURE_LIFE_GRAPH);
  const directive = createConversationStrategyEngine().select({
    realitySnapshot: snapshot,
    contextItems: engineContext.items,
    isFirstContact,
  });
  return directive.strategy;
}

export const conversationStrategyFlow: SmokeFlow = {
  name: "conversation-strategy",
  async run(ctx: SmokeContext) {
    // A) Una condición de activación real por estrategia -- fixtures
    // afinados para que gane exactamente la estrategia esperada,
    // dado el orden de prioridad real de `CONVERSATION_STRATEGY_RULES`.

    const challengeSnapshot: RealitySnapshot = {
      ...emptySnapshot(),
      insights: {
        items: [
          {
            id: createEntityId("insight-pattern-1"),
            description:
              "Pospone repetidamente hablar con su jefe sobre el ascenso, aunque dice que lo necesita.",
            type: "pattern",
          },
        ],
      },
      life: {
        activeGoals: [{ id: createEntityId("goal-1"), title: "Pedir el ascenso" }],
        activeProjects: [],
        activeHabits: [],
      },
    };
    assert(
      (await selectStrategyFor(challengeSnapshot, false)) === "challenge",
      "un insight de tipo 'pattern' + un goal activo debería producir 'challenge'",
    );

    const encourageSnapshot: RealitySnapshot = {
      ...emptySnapshot(),
      insights: {
        items: [
          {
            id: createEntityId("insight-risk-1"),
            description: "Riesgo de aislamiento: ha dejado de ver a sus amigos últimamente.",
            type: "risk",
          },
        ],
      },
    };
    assert(
      (await selectStrategyFor(encourageSnapshot, false)) === "encourage",
      "un insight de tipo 'risk' debería producir 'encourage'",
    );

    const planByDeadlineSnapshot: RealitySnapshot = {
      ...emptySnapshot(),
      life: {
        activeGoals: [
          { id: createEntityId("goal-2"), title: "Entregar el proyecto final", dueDate: daysFromNow(5) },
        ],
        activeProjects: [],
        activeHabits: [],
      },
    };
    assert(
      (await selectStrategyFor(planByDeadlineSnapshot, false)) === "plan",
      "un goal activo con dueDate a 5 días debería producir 'plan'",
    );

    const planByRecommendationSnapshot: RealitySnapshot = {
      ...emptySnapshot(),
      insights: {
        items: [
          {
            id: createEntityId("insight-recommendation-1"),
            description: "Se recomienda dividir el objetivo en pasos semanales.",
            type: "recommendation",
          },
        ],
      },
    };
    assert(
      (await selectStrategyFor(planByRecommendationSnapshot, false)) === "plan",
      "un insight de tipo 'recommendation' también debería producir 'plan'",
    );

    const remindSnapshot: RealitySnapshot = {
      ...emptySnapshot(),
      life: {
        activeGoals: [{ id: createEntityId("goal-3"), title: "Aprender francés" }],
        activeProjects: [],
        activeHabits: [],
      },
    };
    assert(
      (await selectStrategyFor(remindSnapshot, false)) === "remind",
      "un goal activo sin fecha y sin memoria reciente debería producir 'remind'",
    );

    const followUpSnapshot: RealitySnapshot = {
      ...emptySnapshot(),
      memory: {
        items: [
          {
            id: createEntityId("memory-stale-1"),
            content: "Mencionó que estaba probando una rutina de ejercicio nueva.",
            occurredAt: hoursAgo(5 * 24),
          },
        ],
      },
    };
    assert(
      (await selectStrategyFor(followUpSnapshot, false)) === "follow_up",
      "una memoria relevante de hace 5 días, sin contacto previo marcado como primer contacto, debería producir 'follow_up'",
    );

    const celebrateSnapshot: RealitySnapshot = {
      ...emptySnapshot(),
      memory: {
        items: [
          {
            id: createEntityId("memory-fresh-1"),
            content: "Terminó de leer el libro que llevaba meses queriendo terminar.",
            occurredAt: hoursAgo(2),
          },
        ],
      },
    };
    assert(
      (await selectStrategyFor(celebrateSnapshot, false)) === "celebrate",
      "una memoria muy reciente (2h) como único item relevante debería producir 'celebrate'",
    );

    const clarifySnapshot: RealitySnapshot = {
      ...emptySnapshot(),
      memory: {
        items: [
          { id: createEntityId("memory-tie-1"), content: "Le preocupa el trabajo.", occurredAt: hoursAgo(60) },
          { id: createEntityId("memory-tie-2"), content: "Le preocupa la familia.", occurredAt: hoursAgo(60) },
          { id: createEntityId("memory-tie-3"), content: "Le preocupa la salud.", occurredAt: hoursAgo(60) },
          { id: createEntityId("memory-tie-4"), content: "Le preocupa el dinero.", occurredAt: hoursAgo(60) },
        ],
      },
    };
    assert(
      (await selectStrategyFor(clarifySnapshot, false)) === "clarify",
      "varias memorias con relevancia casi empatada (sin ganador claro) deberían producir 'clarify'",
    );

    assert(
      (await selectStrategyFor(emptySnapshot(), true)) === "listen",
      "primer contacto, sin ninguna señal, debería producir 'listen'",
    );
    assert(
      (await selectStrategyFor(emptySnapshot(), false)) === "listen",
      "conversación en curso sin ninguna señal estructural también debería producir 'listen' (catch-all)",
    );

    // B) La prueba explícita que pide el sprint: dos "usuarios" con el
    // mismo mensaje entrante reciben una estrategia distinta cuando su
    // contexto real es distinto -- el contexto decide, no el texto.
    const userAStrategy = await selectStrategyFor(challengeSnapshot, false);
    const userBStrategy = await selectStrategyFor(emptySnapshot(), true);
    assert(
      userAStrategy !== userBStrategy,
      `dos usuarios con el mismo mensaje deberían poder recibir estrategias distintas según su contexto -- ambos dieron '${userAStrategy}'`,
    );

    // C) Integración real end-to-end: buildContext() contra la cuenta
    // fixture real -- prueba que el pipeline completo (Reality
    // Snapshot real desde la DB -> Context Engine -> Conversation
    // Strategy Engine) corre sin fabricar nada a mano. Deliberadamente
    // NO asume que la cuenta esté vacía: `resetTestAccount` solo se
    // llama una vez por corrida completa (`smoke/runner.ts`), y
    // `dashboardFlow` siembra un Goal real + `firstMessageFlow` una
    // memoria real en esa misma cuenta compartida antes de que este
    // flujo corra -- este mismo archivo debe seguir pasando corrido
    // solo (`--flow conversation-strategy`, sin esos dos) o como parte
    // de la suite completa (types.ts: "un flujo puede correr solo... o
    // como parte de la suite completa sin cambiar de comportamiento"),
    // así que solo se verifican invariantes válidas en cualquiera de
    // los dos casos, nunca una estrategia específica.
    const realBuiltContext = await buildContext(db, ctx.lifeGraphContext, [
      { role: "user", content: "Hola, quiero empezar a organizar mejor mi semana." },
    ]);
    const strategy = realBuiltContext.conversationStrategy;
    assert(
      CONVERSATION_STRATEGY_TYPES.includes(strategy.strategy),
      `buildContext() produjo una estrategia fuera del vocabulario válido: '${strategy.strategy}'`,
    );
    assert(strategy.reason.length > 0, "conversationStrategy.reason no debería quedar vacío");
    assert(
      strategy.primaryObjective.length > 0,
      "conversationStrategy.primaryObjective no debería quedar vacío",
    );
    assert(strategy.avoid.length > 0, "conversationStrategy.avoid no debería quedar vacío");
  },
};
