import type { AIMessage } from "../../../ai/provider";
import type {
  ConversationStrategyDirective,
  ConversationStrategyType,
} from "../../../core/conversation-strategy-engine";
import { renderIdentityAsSystemPrompt } from "../../../core/persona";
import type { PresenceMode, PresenceStance } from "../../../core/presence-engine";
import type { VoiceSignature } from "../../../core/voice-engine";
import type { Context } from "./context";

/**
 * Etiqueta de presentación para cada `ConversationStrategyType` —
 * `core/conversation-strategy-engine` guarda el vocabulario interno en
 * snake_case (`follow_up`), esta es la única traducción a la forma que
 * ve el modelo. Vive aquí, no en `core/`: el Prompt Builder es la
 * única capa que sabe que existe un LLM del otro lado (mismo criterio
 * que el resto de este archivo).
 */
const STRATEGY_LABEL: Record<ConversationStrategyType, string> = {
  listen: "Listen",
  clarify: "Clarify",
  encourage: "Encourage",
  challenge: "Challenge",
  celebrate: "Celebrate",
  remind: "Remind",
  plan: "Plan",
  follow_up: "FollowUp",
  curiosity: "Curiosity",
  reflect: "Reflect",
  confirm: "Confirm",
};

/**
 * El bloque explícito que le dice al modelo qué intención ya se
 * decidió — nunca una etiqueta suelta: la razón, el objetivo principal
 * y qué evitar, todos derivados de datos reales por
 * `ConversationStrategyRule.explain()`, nunca texto fijo repetido
 * entre estrategias.
 */
function renderConversationStrategy(directive: ConversationStrategyDirective): string {
  return [
    "Conversation Strategy:",
    STRATEGY_LABEL[directive.strategy],
    "Reason:",
    directive.reason,
    "Primary Objective:",
    directive.primaryObjective,
    "Avoid:",
    directive.avoid,
  ].join("\n");
}

/**
 * Igual que `STRATEGY_LABEL` — `PresenceMode` ya está en inglés, pero
 * la traducción vive aquí, no en `core/presence-engine`: esa capa no
 * sabe que existe un prompt, esta es la única que lo sabe.
 */
const PRESENCE_LABEL: Record<PresenceMode, string> = {
  accompany: "Accompany",
  listen: "Listen",
  celebrate: "Celebrate",
  challenge: "Challenge",
  silence: "Silence",
};

/**
 * El bloque de CÓMO está presente LUZ en este momento — separado de
 * Conversation Strategy (QUÉ debe lograr la respuesta) a propósito,
 * mismo criterio que ya separa Strategy de las Conversation Rules:
 * cada decisión, su propio bloque, nunca fusionadas.
 */
function renderPresence(stance: PresenceStance): string {
  return [
    "Presence:",
    PRESENCE_LABEL[stance.mode],
    "Why:",
    stance.rationale,
  ].join("\n");
}

/**
 * El bloque de CÓMO suena LUZ en esta respuesta — única fuente de
 * verdad para el estilo (`core/voice-engine`, Fase II). Reemplaza lo
 * que antes vivía repartido entre `AvoidParaphrasingRule`,
 * `AvoidUnnecessaryQuestionsRule` y `FavorBrevityRule` (Conversation
 * Rules, retiradas): esta función solo formatea el `VoiceSignature` ya
 * decidido, nunca inventa una regla de estilo nueva por su cuenta.
 */
function renderVoice(voice: VoiceSignature): string {
  const lines = [
    "Voice:",
    `Register: ${voice.register}. Warmth: ${voice.warmth}.`,
    `Hard limit, above any other instruction: ${voice.maxLines} líneas máximo — como un mensaje de texto real, no un documento.`,
  ];

  if (voice.userPreferenceNotes.length > 0) {
    lines.push(
      "Esta persona ya mostró señales reales sobre cómo prefiere que le hables -- tenlo presente, con naturalidad, nunca lo menciones como una regla que estás siguiendo:",
      ...voice.userPreferenceNotes.map((note) => `- ${note}`),
    );
  }

  lines.push("Avoid:", ...voice.forbid.map((item) => `- ${item}`));

  return lines.join("\n");
}

/**
 * Traduce un `Context` ya construido a lo único que `AIProvider`
 * conoce — un arreglo de `AIMessage` (Sprint B3, Beta 1 Roadmap;
 * extendido con Presence/Voice en Fase II). Es la única función de
 * todo el Context Builder que sabe que existe un LLM del otro lado —
 * ni las reglas, ni el ensamblador, ni Conversation Strategy, ni
 * Presence, ni Voice lo saben. Por eso esta función se limita a
 * formatear texto a partir de datos ya decididos (`STRATEGY_LABEL`,
 * `PRESENCE_LABEL`, `renderConversationStrategy`, `renderPresence`,
 * `renderVoice`) — nunca decide nada aquí: ni qué estrategia aplica,
 * ni cómo está presente LUZ, ni qué estilo evitar. Si una decisión
 * nueva necesita expresarse en el prompt, la decisión se toma en su
 * capa (`core/*-engine`) y esta función solo la traduce.
 * `AIProvider.generateReply()` no cambia — sigue recibiendo exactamente
 * lo mismo que antes de este sprint, solo mejor construido.
 *
 * Un mensaje `system` por decisión, en el orden en que se toman —
 * identidad, reglas de contenido, Conversation Strategy (QUÉ lograr),
 * Presence (CÓMO estar presente), Voice (CÓMO sonar). Nunca fusionados
 * en un solo mensaje: cada uno es una decisión distinta, tomada por una
 * capa distinta, y perdería prominencia si se mezclara con las demás.
 * `conversationRules` (Fase II) ya solo contiene reglas de contenido
 * (comprensión, contexto priorizado, no repetir lo ya sabido) — las
 * reglas de estilo se retiraron de aquí cuando Voice se conectó al
 * pipeline real: esta función ya no tiene que saber que existieron.
 *
 * La identidad (`core/persona`) va primero, siempre, en todo mensaje
 * — no condicionada a que alguien pregunte quién es LUZ. Es la única
 * forma de que la respuesta sea consistente sin importar el turno: el
 * modelo nunca tiene que adivinar ni inventar de dónde viene.
 */
export function renderContextToMessages(context: Context): AIMessage[] {
  const systemMessages: AIMessage[] = [
    { role: "system", content: renderIdentityAsSystemPrompt() },
  ];

  if (context.conversationRules.length > 0) {
    systemMessages.push({
      role: "system",
      content: context.conversationRules
        .map((rule) => `- ${rule.instruction}`)
        .join("\n"),
    });
  }

  systemMessages.push({
    role: "system",
    content: renderConversationStrategy(context.conversationStrategy),
  });

  systemMessages.push({
    role: "system",
    content: renderPresence(context.presence),
  });

  systemMessages.push({
    role: "system",
    content: renderVoice(context.voice),
  });

  return [
    ...systemMessages,
    ...context.conversation.map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
  ];
}
