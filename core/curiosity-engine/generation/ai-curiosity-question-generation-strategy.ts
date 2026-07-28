import { z } from "zod";
import { getAIProvider } from "../../../ai";
import type {
  CuriosityQuestionGenerationInput,
  CuriosityQuestionGenerationStrategy,
  ProposedCuriosityQuestion,
} from "./curiosity-question-generation-strategy";

/**
 * `max` generoso a propósito: OpenAI recorta la generación estructurada
 * al tope exacto en vez de rechazarla (confirmado contra la API real --
 * con `max(200)` una pregunta se cortó a mitad de oración, con comillas
 * sin cerrar). La brevedad real la impone el prompt ("una sola
 * oración corta"), este límite es solo una red de seguridad, nunca el
 * mecanismo que decide dónde termina el texto.
 */
const MAX_LENGTH = 280;

const generationSchema = z.object({
  question: z.string().min(1).max(MAX_LENGTH),
  rationale: z.string().min(1).max(MAX_LENGTH),
});

const SYSTEM_PROMPT = `LUZ todavía entiende poco de un área de la vida de esta persona. Tu trabajo es escribir UNA pregunta concreta que LUZ podría hacer en una conversación futura para empezar a entenderla.

Reglas:
- Una sola oración corta, máximo ~25 palabras -- nunca una pregunta compuesta ni con varias partes.
- Nunca genérica ni de cuestionario ("¿cómo va tu trabajo?", "¿qué tal tu salud?"). Tiene que sentirse como algo que alguien que ya te conoce un poco preguntaría, no un formulario.
- Si hay algo ya sabido de la persona en otras áreas, puedes usarlo como puente natural hacia esta área nueva -- nunca forzado, solo si de verdad conecta.
- Tono cálido, curioso, sin presión y sin juzgar -- nunca una entrevista, nunca una lista de preguntas encadenadas (esto es UNA sola).
- Español natural, como hablaría una persona real, nunca en tercera persona ni con lenguaje clínico.
- rationale es una sola frase breve (máximo ~15 palabras), para uso interno de LUZ explicando por qué esta pregunta vale la pena -- nunca se le muestra a la persona.`;

/**
 * Única fuente de IA de `core/curiosity-engine` -- mismo patrón que
 * `AIBeliefConsolidationStrategy`/`AIConceptExtractionStrategy`: una
 * sola llamada acotada, nunca una conversación con el modelo.
 */
export class AICuriosityQuestionGenerationStrategy
  implements CuriosityQuestionGenerationStrategy
{
  async proposeQuestion(
    input: CuriosityQuestionGenerationInput,
  ): Promise<ProposedCuriosityQuestion | null> {
    const knownBlock =
      input.knownAboutPerson.length > 0
        ? `Lo que ya se sabe de esta persona, en otras áreas de su vida:\n${input.knownAboutPerson.map((item) => `- ${item}`).join("\n")}`
        : "Todavía no hay nada consolidado sobre esta persona en ninguna otra área.";

    const proposed = await getAIProvider().generateStructured(
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Área todavía poco entendida: ${input.domainLabel}.\n\n${knownBlock}`,
        },
      ],
      { name: "curiosity_question_generation", schema: generationSchema },
    );

    if (!proposed.question.trim()) {
      return null;
    }

    // Si el texto llegó exacto al tope del schema, es señal de que
    // OpenAI lo cortó a mitad de generación (confirmado contra la API
    // real, ver docblock del schema) -- una pregunta rota nunca se
    // ofrece, mejor ninguna que una incompleta.
    if (proposed.question.length >= MAX_LENGTH || proposed.rationale.length >= MAX_LENGTH) {
      return null;
    }

    return { question: proposed.question, rationale: proposed.rationale };
  }
}
