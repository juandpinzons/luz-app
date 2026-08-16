import { z } from "zod";
import { getAIProvider } from "../../../ai";
import type { Insight } from "../../knowledge-engine/entities/insight";
import type {
  ConceptExtractionResult,
  ConceptExtractionStrategy,
} from "./concept-extraction-strategy";

/**
 * `max` generoso a propósito -- mismo hallazgo que
 * `AICuriosityQuestionGenerationStrategy` (confirmado contra la API
 * real): OpenAI recorta la salida estructurada al tope exacto en vez
 * de rechazarla. `label` casi nunca se acerca a su tope (el prompt pide
 * "una o dos palabras"), pero `description` sí puede -- `extract` la
 * descarta sola si llega exacta al tope, sin perder el concepto entero.
 */
const CONCEPT_DESCRIPTION_MAX_CHARS = 260;

const extractionSchema = z.object({
  found: z.boolean(),
  concepts: z
    .array(
      z.object({
        label: z.string().min(1).max(60),
        description: z.string().max(CONCEPT_DESCRIPTION_MAX_CHARS).nullable(),
      }),
    )
    .max(3),
  relations: z
    .array(
      z.object({
        fromLabel: z.string().min(1).max(60),
        toLabel: z.string().min(1).max(60),
        relationType: z.string().min(1).max(40),
      }),
    )
    .max(3),
  confidence: z.number().min(0).max(100).nullable(),
});

const SYSTEM_PROMPT = `Vas a ver una interpretación ya validada sobre la vida de una persona (un Insight) junto con la evidencia real que la respalda. Tu trabajo es nombrar, si de verdad aplica, los conceptos abstractos de los que este insight es evidencia -- no repetir el insight, ir un nivel más arriba.

Ejemplo: un insight como "va al gimnasio con constancia incluso en semanas difíciles" es evidencia del concepto "Disciplina" -- y "Disciplina" puede a su vez llevar_a "Confianza". Usa etiquetas cortas (una o dos palabras, sustantivos), nunca frases completas.

Responde found: false si el insight ya es completamente concreto (un hecho puntual sin ninguna cualidad, rasgo o patrón humano detrás) o si nombrar un concepto sería inventar algo que la evidencia no respalda.

Máximo 3 conceptos y 3 relaciones. Cada relación conecta dos de los conceptos que tú mismo propusiste (o un concepto propuesto con uno ya existente, si te lo damos). Da confidence de 0 a 100: alto solo si el concepto es una lectura directa y obvia de la evidencia, bajo si es una interpretación más especulativa.`;

/**
 * Única fuente de IA de `core/concept-graph` — mismo patrón que
 * `AIInsightGenerationStrategy`: propone, nunca decide. La decisión
 * (umbral de confianza, deduplicar por etiqueta) vive en
 * `extract-concepts-from-insight.ts`.
 */
export class AIConceptExtractionStrategy implements ConceptExtractionStrategy {
  async extract(
    insight: Insight,
    evidenceText: string[],
  ): Promise<ConceptExtractionResult | null> {
    const evidenceBlock = evidenceText.map((text) => `- "${text}"`).join("\n");

    const extracted = await getAIProvider().generateStructured(
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Insight (${insight.type}, confianza ${insight.confidence.score}): "${insight.description}"\n\nEvidencia:\n${evidenceBlock}`,
        },
      ],
      { name: "concept_graph_extraction", schema: extractionSchema },
    );

    if (!extracted.found || extracted.confidence === null) {
      return null;
    }

    return {
      concepts: extracted.concepts.map((concept) => ({
        label: concept.label,
        description:
          concept.description && concept.description.length < CONCEPT_DESCRIPTION_MAX_CHARS
            ? concept.description
            : undefined,
      })),
      relations: extracted.relations,
      confidence: extracted.confidence,
    };
  }
}
