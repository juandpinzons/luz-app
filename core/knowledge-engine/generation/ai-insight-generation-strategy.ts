import { z } from "zod";
import { getAIProvider } from "../../../ai";
import type { PipelineContext } from "../pipeline-context";
import type { RelatedItem } from "../relationships/insight-relationship-strategy";
import type { GeneratedInsight, InsightGenerationStrategy } from "./insight-generation-strategy";

const generationSchema = z.object({
  found: z.boolean(),
  description: z.string().min(1).max(300).nullable(),
  confidence: z.number().min(0).max(100).nullable(),
});

const SYSTEM_PROMPT = `Vas a ver un fragmento de evidencia real sobre la vida de una persona, junto con otras memorias relacionadas con ese fragmento. Tu único trabajo es proponer, si de verdad hay algo que decir, una interpretación breve de qué significa esa evidencia — nunca inventar algo que la evidencia no respalda.

Responde found: false si:
- la evidencia es demasiado vaga o aislada para significar algo real;
- ya es obvio por sí mismo, sin interpretación (repetir el hecho no es un insight);
- no estás seguro.

Si encuentras algo real, describe en una sola frase breve qué significa esta evidencia sobre la vida de la persona — nunca la persona en sí, siempre algo que la evidencia concreta respalda. Da un valor de confianza de 0 a 100: alto solo cuando varias memorias relacionadas apuntan en la misma dirección, bajo cuando es una sola mención aislada.`;

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

    return {
      type: item.type,
      description: extracted.description,
      proposedConfidence: extracted.confidence,
      evidence: item.relatedMemories,
    };
  }
}
