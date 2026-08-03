import { createContextEngine } from "../core/context-engine";
import { createConversationStrategyEngine } from "../core/conversation-strategy-engine";
import { createPresenceEngine } from "../core/presence-engine";
import { createVoiceEngine } from "../core/voice-engine";
import { CONVERSATION_RULES } from "../features/chat/context-builder/conversation-rules";
import { renderContextToMessages } from "../features/chat/context-builder/render-context";
import { FIXTURE_LIFE_GRAPH_ID, FIXTURE_PERSON_ID } from "./fixtures/baseline-reality-snapshot";
import { scoreHeuristics } from "./heuristics";
import { judgeResponse } from "./judge";
import type {
  Context,
  Experiment,
  ExperimentResult,
  ExperimentVariant,
  EvaluationProvider,
  RepetitionResult,
  VariantResult,
} from "./types";

/**
 * Reconstruye exactamente lo que `features/chat/context-builder/build-context.ts`
 * hace en producción -- Context Engine -> Conversation Strategy ->
 * Presence -> Voice -> Conversation Rules -- pero a partir de un
 * `RealitySnapshot` ya dado (el de este experimento) en vez de
 * ensamblarlo con `assembleRealitySnapshot` (que exige `db` real). No
 * es una reimplementación con lógica propia: cada motor que se llama
 * aquí es el mismo objeto real que usa el chat en producción
 * (`createContextEngine`/`createConversationStrategyEngine`/
 * `createPresenceEngine`/`createVoiceEngine`/`CONVERSATION_RULES`) --
 * lo único sintético es el snapshot de entrada y las cuatro señales
 * que en producción vienen de consultas separadas (`recentStrategyTypes`,
 * `fatiguedDomain`, `reconnectionContext`, `variety`), fijadas a "sin
 * historial previo" para que el experimento sea reproducible en vez de
 * depender de qué haya en una base de datos real ese día.
 *
 * `createContextEngine()` sin argumentos: mismo comportamiento
 * documentado en el propio motor -- sin `db`, el bono de importancia y
 * la alineación de identidad simplemente no aportan nada, nunca falla.
 */
async function buildExperimentContext(experiment: Experiment, variant: ExperimentVariant): Promise<Context> {
  const lifeGraphContext = { lifeGraphId: FIXTURE_LIFE_GRAPH_ID, personId: FIXTURE_PERSON_ID };
  const realitySnapshot = variant.buildSnapshot(experiment.baseline);
  const conversation = [
    ...(experiment.priorTurns ?? []),
    { role: "user" as const, content: experiment.userMessage },
  ];
  const isFirstContact = experiment.isFirstContact ?? false;

  const engineContext = await createContextEngine().build(realitySnapshot, lifeGraphContext);
  const contextItems = engineContext.items;

  const conversationStrategy = createConversationStrategyEngine().select({
    realitySnapshot,
    contextItems,
    isFirstContact,
    recentStrategyTypes: [],
    fatiguedDomain: null,
  });

  const presence = createPresenceEngine().decide(conversationStrategy);
  const voice = createVoiceEngine().speak(presence, realitySnapshot.communicationStyle);

  const ruleInput = {
    conversation,
    contextItems,
    reconnectionContext: null,
    variety: null,
    realitySnapshot,
  };
  const conversationRules = CONVERSATION_RULES.filter((rule) => rule.applies(ruleInput)).map((rule) => ({
    ruleId: rule.id,
    instruction: rule.directive(ruleInput),
  }));

  return {
    conversation,
    memories: realitySnapshot.memory.items,
    realitySnapshot,
    contextItems,
    conversationStrategy,
    presence,
    voice,
    conversationRules,
    responseIntent: isFirstContact ? "first_contact" : "continue_conversation",
  };
}

export interface RunExperimentOptions {
  provider: EvaluationProvider;
  repetitions: number;
  dryRun: boolean;
  /** `false` desactiva el juez de IA (una llamada real menos por repetición) -- las heurísticas siguen corriendo siempre, son gratis. */
  useJudge: boolean;
}

export async function runExperiment(
  experiment: Experiment,
  options: RunExperimentOptions,
): Promise<ExperimentResult> {
  const variantResults: VariantResult[] = [];

  for (const variant of experiment.variants) {
    const context = await buildExperimentContext(experiment, variant);
    const messages = renderContextToMessages(context);
    const systemPromptPreview = messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n\n---\n\n");

    const repetitions: RepetitionResult[] = [];
    for (let i = 0; i < options.repetitions; i++) {
      const start = Date.now();
      const response = await options.provider.generateReply(messages);
      const durationMs = Date.now() - start;

      const heuristics = scoreHeuristics(response, context);
      const judge = options.useJudge
        ? await judgeResponse(options.provider, {
            response,
            userMessage: experiment.userMessage,
            realitySnapshot: context.realitySnapshot,
          })
        : null;

      repetitions.push({ repetitionIndex: i, response, durationMs, heuristics, judge });
    }

    variantResults.push({ variant, systemPromptPreview, repetitions });
  }

  return {
    experiment,
    provider: options.provider.name,
    dryRun: options.dryRun,
    variantResults,
    runAt: new Date(),
  };
}
