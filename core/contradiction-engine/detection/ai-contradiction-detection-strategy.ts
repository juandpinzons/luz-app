import { z } from "zod";
import { getAIProvider } from "../../../ai";
import type {
  ContradictionCandidate,
  ContradictionDetectionStrategy,
  ProposedContradiction,
} from "./contradiction-detection-strategy";

const detectionSchema = z.object({
  contradictions: z
    .array(
      z.object({
        candidateIndex: z.number().int().min(0),
        description: z.string().min(1).max(300),
        confidence: z.number().min(0).max(100),
      }),
    )
    .max(3),
});

const SYSTEM_PROMPT = `Vas a ver una afirmación sobre la vida de una persona (el "sujeto") y una lista numerada de otras afirmaciones ya conocidas sobre esa misma persona. Tu trabajo es encontrar tensiones genuinas -- casos donde el sujeto y alguna afirmación de la lista, tomados juntos, no encajan del todo (un objetivo que choca con un hábito, dos creencias que apuntan en direcciones distintas, una intención y una acción que la contradicen).

Esto NO es para juzgar a la persona ni señalar errores -- las contradicciones humanas son normales y reveladoras, ayudan a entenderla mejor. Nunca inventes una tensión que no esté ahí; casi siempre la lista no tendrá ninguna contradicción real, y found vacío es la respuesta correcta la mayoría de las veces.

Para cada tensión real que encuentres, da el índice exacto de la afirmación de la lista, una descripción breve y neutral de la tensión (nunca acusatoria), y confidence de 0 a 100 (alto solo si la tensión es clara, no forzada). Máximo 3 contradicciones.`;

/**
 * Única fuente de IA de `core/contradiction-engine`.
 */
export class AIContradictionDetectionStrategy implements ContradictionDetectionStrategy {
  async detect(
    subject: ContradictionCandidate,
    against: ContradictionCandidate[],
  ): Promise<ProposedContradiction[]> {
    if (against.length === 0) {
      return [];
    }

    const list = against
      .map((candidate, index) => `${index}. (${candidate.refType}) "${candidate.text}"`)
      .join("\n");

    const result = await getAIProvider().generateStructured(
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Sujeto (${subject.refType}): "${subject.text}"\n\nAfirmaciones conocidas:\n${list}`,
        },
      ],
      { name: "contradiction_detection", schema: detectionSchema },
    );

    return result.contradictions.filter(
      (item) => item.candidateIndex >= 0 && item.candidateIndex < against.length,
    );
  }
}
