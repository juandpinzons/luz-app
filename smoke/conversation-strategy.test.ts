import { db } from "../core/db/client";
import { createContextEngine } from "../core/context-engine";
import {
  createConversationStrategyEngine,
  CONVERSATION_STRATEGY_TYPES,
  type ConversationStrategyType,
} from "../core/conversation-strategy-engine";
import { buildContext } from "../features/chat/context-builder";
import { createEntityId, type LifeGraphContext } from "../core/life";
import { rankKnowledgeGaps } from "../core/knowledge-gaps";
import { PRESENCE_MODES } from "../core/presence-engine";
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
    knowledgeGaps: { domains: [] },
    reasoning: { items: [] },
    curiosity: { pendingQuestion: null },
    contradictions: { items: [] },
    communicationStyle: { items: [] },
    growingBeliefs: { items: [] },
    fadingBeliefs: { items: [] },
    reopenCandidates: { items: [] },
    closures: { items: [] },
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
    // Fixtures de este archivo prueban una condición de activación
    // aislada por estrategia -- nunca el cooldown de diversidad, que
    // tiene sus propios escenarios en `diversity` más abajo. `[]`
    // = sin historial, mismo criterio que "primera conversación real".
    recentStrategyTypes: [],
    // Mismo criterio: sin Conversational Variety en juego en estos
    // escenarios aislados, `null` = "ningún dominio fatigado".
    fatiguedDomain: null,
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

    const contradictionSnapshot: RealitySnapshot = {
      ...emptySnapshot(),
      contradictions: {
        items: [
          {
            id: createEntityId("contradiction-1"),
            description:
              "Dice que quiere ahorrar para el viaje, pero acaba de gastar el bono completo en otra cosa.",
            domain: "finances",
          },
        ],
      },
    };
    assert(
      (await selectStrategyFor(contradictionSnapshot, false)) === "challenge",
      "una contradicción abierta debería producir 'challenge' por sí sola, sin necesitar un insight de tipo 'pattern'",
    );
    assert(
      (await selectStrategyFor(contradictionSnapshot, true)) !== "challenge",
      "'challenge' por contradicción nunca debería ganar en el primer contacto de una conversación nueva",
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

    const curiositySnapshot: RealitySnapshot = {
      ...emptySnapshot(),
      life: {
        activeGoals: [
          { id: createEntityId("goal-curiosity-1"), title: "Crecer profesionalmente", domain: "career" },
        ],
        activeProjects: [],
        activeHabits: [],
      },
      // Mismo cálculo que haría `assembleRealitySnapshot` a partir del
      // goal de arriba -- nunca números fabricados a mano, mismo
      // criterio que el resto de este archivo (no duplicar lógica real).
      knowledgeGaps: { domains: rankKnowledgeGaps({ career: { goalsCount: 1, projectsCount: 0, habitsCount: 0, beliefsCount: 0, conceptsCount: 0 } }) },
      memory: {
        items: [
          {
            id: createEntityId("memory-curiosity-1"),
            content: "Mencionó que quiere avanzar en su carrera este año.",
            // Ni fresca (Celebrate exige <=48h) ni vieja (FollowUp exige >3
            // días) -- la única ventana donde Remind no puede ganar (exige
            // cero memorias) y ninguna otra postura de mayor prioridad
            // aplica tampoco.
            occurredAt: hoursAgo(60),
          },
        ],
      },
    };
    assert(
      (await selectStrategyFor(curiositySnapshot, false)) === "curiosity",
      "un dominio de vida (health) sin ningún goal/project/habit clasificado ahí, con otro dominio (career) ya cubierto, debería producir 'curiosity'",
    );

    const confirmSnapshot: RealitySnapshot = {
      ...emptySnapshot(),
      growingBeliefs: {
        items: [
          {
            id: createEntityId("growing-belief-1"),
            statement: "Le está dedicando gran parte de su energía a un proyecto nuevo",
            confidence: 42,
          },
        ],
      },
    };
    assert(
      (await selectStrategyFor(confirmSnapshot, false)) === "confirm",
      "una hipótesis en formación (growingBeliefs) debería producir 'confirm'",
    );
    assert(
      (await selectStrategyFor(confirmSnapshot, true)) !== "confirm",
      "'confirm' nunca debería ganar en el primer contacto, sin importar qué hipótesis existan",
    );

    const releaseSnapshot: RealitySnapshot = {
      ...emptySnapshot(),
      fadingBeliefs: {
        items: [
          {
            statement: "Está definido por un trabajo que ya dejó",
            domain: "career",
            confidence: 40,
          },
        ],
      },
    };
    assert(
      (await selectStrategyFor(releaseSnapshot, false)) === "release",
      "una dimensión/tema deemphasized (fadingBeliefs, vía Identity Evolution) debería producir 'release'",
    );
    assert(
      (await selectStrategyFor(releaseSnapshot, true)) !== "release",
      "'release' nunca debería ganar en el primer contacto, sin importar qué creencias se hayan soltado",
    );

    const reopenSnapshot: RealitySnapshot = {
      ...emptySnapshot(),
      reopenCandidates: {
        items: [
          {
            id: createEntityId("reopen-candidate-1"),
            statement: "Iba a hablar con su jefe sobre el cambio de puesto",
          },
        ],
      },
    };
    assert(
      (await selectStrategyFor(reopenSnapshot, true)) === "reopen",
      "una intención sin resolver (reopenCandidates) al reabrir (isFirstContact) debería producir 'reopen'",
    );
    assert(
      (await selectStrategyFor(reopenSnapshot, false)) !== "reopen",
      "'reopen' nunca debería ganar a mitad de una conversación en curso, solo al reabrir",
    );

    const acknowledgeClosureSnapshot: RealitySnapshot = {
      ...emptySnapshot(),
      closures: {
        items: [
          { id: createEntityId("closure-1"), title: "Maratón", kind: "goal" },
        ],
      },
    };
    assert(
      (await selectStrategyFor(acknowledgeClosureSnapshot, false)) === "acknowledge_closure",
      "un cierre real sin reconocer (closures) debería producir 'acknowledge_closure'",
    );
    assert(
      (await selectStrategyFor(acknowledgeClosureSnapshot, true)) !== "acknowledge_closure",
      "'acknowledge_closure' nunca debería ganar en el primer contacto",
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

    const reflectSnapshot: RealitySnapshot = {
      ...emptySnapshot(),
      reasoning: {
        items: [
          {
            id: createEntityId("reasoning-1"),
            statement:
              "El ritmo de trabajo actual parece estar afectando su descanso.",
            confidenceScore: 82,
          },
        ],
      },
    };
    assert(
      (await selectStrategyFor(reflectSnapshot, false)) === "reflect",
      "una conclusión de razonamiento ya validada debería producir 'reflect'",
    );
    assert(
      (await selectStrategyFor(reflectSnapshot, true)) !== "reflect",
      "'reflect' nunca debería ganar en el primer contacto, sin importar qué conclusiones existan",
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

    // E) Diversidad conversacional (redesign del pipeline
    // conversacional, Beta): las mismas condiciones de arriba, pero con
    // esa postura ya ganada las últimas `MAX_CONSECUTIVE_STRATEGY_REPEATS`
    // conversaciones seguidas -- debe suprimirse, nunca repetirse una
    // tercera vez, y `Listen` debe nombrar la restricción, no caer en
    // el genérico "nada domina".
    const celebrateEngineContext = await createContextEngine().build(
      celebrateSnapshot,
      FIXTURE_LIFE_GRAPH,
    );
    const suppressedCelebrate = createConversationStrategyEngine().select({
      realitySnapshot: celebrateSnapshot,
      contextItems: celebrateEngineContext.items,
      isFirstContact: false,
      recentStrategyTypes: ["celebrate", "celebrate"],
      fatiguedDomain: null,
    });
    assert(
      suppressedCelebrate.strategy === "listen",
      `'celebrate' en cooldown (2 seguidas) debería suprimirse a 'listen', dio '${suppressedCelebrate.strategy}'`,
    );
    assert(
      suppressedCelebrate.reason.includes("celebrate"),
      "'listen' por cooldown debería nombrar explícitamente qué postura se suprimió, no un motivo genérico",
    );

    // Con una sola repetición previa (no dos seguidas todavía),
    // 'celebrate' debe seguir pudiendo ganar -- el cooldown exige la
    // racha completa, nunca dispara con una sola coincidencia.
    const singleRepeatCelebrate = createConversationStrategyEngine().select({
      realitySnapshot: celebrateSnapshot,
      contextItems: celebrateEngineContext.items,
      isFirstContact: false,
      recentStrategyTypes: ["celebrate"],
      fatiguedDomain: null,
    });
    assert(
      singleRepeatCelebrate.strategy === "celebrate",
      `'celebrate' con una sola repetición previa (racha incompleta) debería seguir ganando, dio '${singleRepeatCelebrate.strategy}'`,
    );

    // El caso concreto que motivó este mecanismo: la MISMA pregunta de
    // curiosidad pendiente no debería poder ganar el turno semana tras
    // semana -- ver `curiosity-strategy-rule.ts`.
    const curiosityEngineContext = await createContextEngine().build(
      curiositySnapshot,
      FIXTURE_LIFE_GRAPH,
    );
    const suppressedCuriosity = createConversationStrategyEngine().select({
      realitySnapshot: curiositySnapshot,
      contextItems: curiosityEngineContext.items,
      isFirstContact: false,
      recentStrategyTypes: ["curiosity", "curiosity"],
      fatiguedDomain: null,
    });
    assert(
      suppressedCuriosity.strategy !== "curiosity",
      "'curiosity' en cooldown (2 seguidas, misma pregunta pendiente) debería suprimirse -- este es exactamente el caso que motivó el sistema de diversidad",
    );

    // F) Conversational Variety V1: si el dominio menos cubierto
    // ('health', ver arriba) es también el que ha dominado las
    // conversaciones recientes, Curiosity no debería insistir en él --
    // debe seguir de largo hacia el siguiente dominio sin cobertura
    // ('finances', el próximo en LIFE_DOMAIN_TYPES sin ningún goal/
    // project/habit/belief/concept).
    const varietyAdjustedCuriosity = createConversationStrategyEngine().select({
      realitySnapshot: curiositySnapshot,
      contextItems: curiosityEngineContext.items,
      isFirstContact: false,
      recentStrategyTypes: [],
      fatiguedDomain: "health",
    });
    assert(
      varietyAdjustedCuriosity.strategy === "curiosity",
      `con 'health' fatigado todavía debería ganar 'curiosity' sobre otro dominio sin cobertura, dio '${varietyAdjustedCuriosity.strategy}'`,
    );
    assert(
      !varietyAdjustedCuriosity.reason.includes("salud"),
      `Curiosity no debería seguir apuntando a 'health' ('sus finanzas') cuando está fatigado -- reason fue: '${varietyAdjustedCuriosity.reason}'`,
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
    const realBuiltContext = await buildContext(
      db,
      ctx.lifeGraphContext,
      [{ role: "user", content: "Hola, quiero empezar a organizar mejor mi semana." }],
      ctx.userId,
    );
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

    // D) Presence/Voice (Fase II): mismo pipeline real, un paso más --
    // buildContext() ya corre PresenceEngine.decide() y VoiceEngine.speak()
    // sobre la estrategia de arriba, no fabricados aparte.
    const { presence, voice } = realBuiltContext;
    assert(
      PRESENCE_MODES.includes(presence.mode),
      `buildContext() produjo un PresenceMode fuera del vocabulario válido: '${presence.mode}'`,
    );
    assert(presence.rationale.length > 0, "presence.rationale no debería quedar vacío");
    assert(
      presence.mode !== "silence",
      "el chat nunca pasa allowSilence -- 'silence' no debería ser alcanzable desde buildContext()",
    );
    assert(voice.maxLines > 0, "voice.maxLines debería ser un límite positivo");
    assert(voice.forbid.length > 0, "voice.forbid no debería quedar vacío");
  },
};
