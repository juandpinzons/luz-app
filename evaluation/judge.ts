import { z } from "zod";
import type { RealitySnapshot } from "../core/reality";
import type { AIMessage } from "../ai";
import type { EvaluationProvider, JudgeScores } from "./types";

const SCORE_SCHEMA = z.object({
  score: z.number().min(1).max(10),
  justification: z.string(),
});

/**
 * Las 5 dimensiones cualitativas que pediste (Longitud queda fuera --
 * es heurística, no necesita juicio, ver `heuristics.ts`). Nombres de
 * campo en camelCase por convención de TypeScript, pero el contenido
 * (`personalizacion`, no `personalization`) se mantiene en español,
 * mismo idioma que el resto del prompt real de LUZ.
 */
export const RESPONSE_EVALUATION_SCHEMA = z.object({
  personalizacion: SCORE_SCHEMA,
  usoDeContexto: SCORE_SCHEMA,
  coherenciaConHistorial: SCORE_SCHEMA,
  referenciasLargoPlazo: SCORE_SCHEMA,
  naturalidad: SCORE_SCHEMA,
});

function describeKnownFacts(snapshot: RealitySnapshot): string {
  const lines: string[] = [];
  if (snapshot.memory.items.length > 0) {
    lines.push("Memorias reales disponibles:");
    for (const memory of snapshot.memory.items) lines.push(`- ${memory.content}`);
  }
  if (snapshot.concepts.items.length > 0) {
    lines.push("Temas de identidad ya conocidos:");
    for (const concept of snapshot.concepts.items) lines.push(`- ${concept.label}`);
  }
  const lifeItems = [
    ...snapshot.life.activeGoals,
    ...snapshot.life.activeProjects,
    ...snapshot.life.activeHabits,
  ];
  if (lifeItems.length > 0) {
    lines.push("Vida activa:");
    for (const item of lifeItems) lines.push(`- ${item.title}`);
  }
  return lines.length > 0 ? lines.join("\n") : "(ninguno -- el snapshot de esta variante no tenía nada de esto disponible)";
}

/**
 * Evaluación ciega y aislada a propósito: el juez nunca ve la otra
 * respuesta de la comparación, solo ESTA respuesta más los hechos que
 * el snapshot de ESTA variante realmente tenía disponibles. Evita el
 * sesgo de posición conocido de "LLM como juez" (preferir la primera o
 * la segunda opción mostrada en el mismo prompt) -- el costo es una
 * llamada más por respuesta evaluada, aceptado a propósito por
 * rigurosidad sobre ahorro.
 */
export async function judgeResponse(
  provider: EvaluationProvider,
  input: { response: string; userMessage: string; realitySnapshot: RealitySnapshot },
): Promise<JudgeScores> {
  const messages: AIMessage[] = [
    {
      role: "system",
      content: [
        "Eres un evaluador experto de experiencia de usuario para un asistente de IA personal.",
        "Vas a puntuar UNA respuesta real, de 1 (muy pobre) a 10 (excelente), en 5 dimensiones.",
        "Sé estricto: un 10 es raro y debe estar completamente justificado. No infles puntajes por cortesía.",
        "",
        "Dimensiones:",
        "- personalizacion: ¿la respuesta se siente escrita para ESTA persona específica, o serviría igual para cualquiera?",
        "- usoDeContexto: ¿aprovecha lo que ya se sabía de la persona (ver 'hechos disponibles' abajo), sin inventar nada que no esté ahí?",
        "- coherenciaConHistorial: ¿es consistente con lo que ya se sabe, sin contradicciones ni repeticiones de algo ya establecido?",
        "- referenciasLargoPlazo: ¿conecta con algo de más allá del mensaje actual (memoria, patrones, identidad), cuando había con qué hacerlo?",
        "- naturalidad: ¿suena como una persona real conversando, o como una plantilla / un informe?",
        "",
        "Cada puntaje necesita una justificación corta (1-2 frases), específica a esta respuesta -- nunca genérica.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Hechos disponibles para esta conversación (lo que el sistema ya sabía, antes de responder):`,
        describeKnownFacts(input.realitySnapshot),
        "",
        `Mensaje de la persona: "${input.userMessage}"`,
        "",
        `Respuesta a evaluar:\n"${input.response}"`,
      ].join("\n"),
    },
  ];

  return provider.generateStructured(messages, {
    name: "response_evaluation",
    schema: RESPONSE_EVALUATION_SCHEMA,
  });
}
