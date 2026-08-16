import { z } from "zod";
import { getAIProvider } from "../../../ai";
import type { PipelineContext } from "../pipeline-context";
import type { RelatedItem } from "../relationships/insight-relationship-strategy";
import type { GeneratedInsight, InsightGenerationStrategy } from "./insight-generation-strategy";

/**
 * `max` generoso a propósito -- mismo hallazgo que
 * `AICuriosityQuestionGenerationStrategy` (confirmado contra la API
 * real): la salida estructurada de OpenAI recorta la cadena al tope
 * exacto del schema en vez de rechazarla, así que un tope ajustado
 * puede cortar una frase a mitad de camino. Este número ya no es el
 * límite real que se espera alcanzar -- es el punto donde `proposeOne`
 * sospecha que el texto llegó cortado y lo descarta.
 */
const DESCRIPTION_MAX_CHARS = 380;

const generationSchema = z.object({
  found: z.boolean(),
  description: z.string().min(1).max(DESCRIPTION_MAX_CHARS).nullable(),
  confidence: z.number().min(0).max(100).nullable(),
});

/**
 * Investigación real 2026-08-15 (queja directa de producto, /memories):
 * "se repite mucho 'la persona' y 'en este momento de su vida'". La
 * versión anterior de este prompt pedía explícitamente "qué significa
 * esta evidencia SOBRE LA VIDA DE LA PERSONA" -- esa plantilla fija,
 * repetida en cada una de las llamadas reales (330 insights en una
 * sola cuenta), es justamente lo que empujaba al modelo hacia el mismo
 * relleno cada vez. Corregido pidiendo variedad explícita y nombrando
 * el relleno exacto a evitar -- mismo criterio que ya usa
 * `generate-welcome.ts` ("nunca recitado").
 */
const SYSTEM_PROMPT = `Vas a ver un fragmento de evidencia real sobre la vida de una persona, junto con otras memorias relacionadas con ese fragmento. Tu único trabajo es proponer, si de verdad hay algo que decir, una interpretación breve de qué significa esa evidencia — nunca inventar algo que la evidencia no respalda.

Responde found: false si:
- la evidencia es demasiado vaga o aislada para significar algo real;
- ya es obvio por sí mismo, sin interpretación (repetir el hecho no es un insight);
- no estás seguro.

Si encuentras algo real, escribe una sola frase breve que vaya directo a la interpretación misma -- nunca "la persona" como sujeto genérico, nunca un relleno de ubicación temporal para abrir la frase ("en este momento de su vida", "en esta etapa de su vida", "actualmente"). El español permite omitir el sujeto por completo (la conjugación del verbo ya lo indica) -- úsalo: "usa una escala diaria..." en vez de "la persona usa una escala diaria...". Entra directo al contenido real. Esta frase se lee junto a docenas de otras en la misma lista -- variar la estructura y el vocabulario cada vez importa tanto como no inventar: sonar como una plantilla repetida es un defecto real, aunque cada frase individual esté bien escrita. Da un valor de confianza de 0 a 100: alto solo cuando varias memorias relacionadas apuntan en la misma dirección, bajo cuando es una sola mención aislada.`;

/**
 * Única etapa del pipeline que llama a IA — "el LLM propone, LUZ
 * decide" (Principio de Diseño de Engine #8): esta clase PROPONE,
 * `DeterministicInsightValidationStrategy` (ya real) DECIDE si la
 * propuesta se persiste. Nunca se salta esa etapa ni duplica su
 * criterio acá.
 *
 * Si un `RelatedItem` no tiene ninguna memoria relacionada
 * (`relatedMemories.length === 0`), no se le pregunta nada a la IA —
 * `DeterministicInsightValidationStrategy` lo rechazaría de todas
 * formas por falta de evidencia (Principio 3, explicabilidad), así que
 * gastar una llamada de IA en eso no aportaría nada.
 */
export class AIInsightGenerationStrategy implements InsightGenerationStrategy {
  async generate(
    items: RelatedItem[],
    _context: PipelineContext,
  ): Promise<GeneratedInsight[]> {
    const results: GeneratedInsight[] = [];

    for (const item of items) {
      if (item.relatedMemories.length === 0) {
        continue;
      }

      const proposed = await this.proposeOne(item);
      if (proposed) {
        results.push(proposed);
      }
    }

    return results;
  }

  private async proposeOne(item: RelatedItem): Promise<GeneratedInsight | null> {
    const evidenceText = item.relatedMemories
      .map((memory) => `- "${memory.content}"`)
      .join("\n");

    const extracted = await getAIProvider().generateStructured(
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Fragmento: "${item.text}"\n\nMemorias relacionadas:\n${evidenceText}`,
        },
      ],
      { name: "knowledge_insight_generation", schema: generationSchema },
    );

    if (!extracted.found || !extracted.description || extracted.confidence === null) {
      return null;
    }

    // Igual que `AICuriosityQuestionGenerationStrategy`: si el texto
    // llegó exacto al tope del schema, es señal de que OpenAI lo cortó
    // a mitad de generación -- un insight roto nunca se persiste,
    // mejor ninguno que uno incompleto.
    if (extracted.description.length >= DESCRIPTION_MAX_CHARS) {
      return null;
    }

    return {
      type: item.type,
      description: extracted.description,
      proposedConfidence: extracted.confidence,
      evidence: item.relatedMemories,
    };
  }
}
