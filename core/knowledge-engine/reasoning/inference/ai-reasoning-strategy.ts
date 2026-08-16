import { z } from "zod";
import { getAIProvider } from "../../../../ai";
import type { EntityId } from "../../../life/value-objects/entity-id";
import type { EvidenceCluster } from "../correlation/reasoning-correlate-stage";
import type { ProposedReasoning, ReasoningStrategy } from "./reasoning-strategy";

/**
 * Topes generosos a propósito -- mismo hallazgo que
 * `AICuriosityQuestionGenerationStrategy` (confirmado contra la API
 * real): la salida estructurada de OpenAI recorta la cadena al tope
 * exacto del schema en vez de rechazarla. `propose` descarta cualquier
 * texto que llegue exacto a su tope en vez de persistirlo cortado.
 */
const CONCLUSION_MAX_CHARS = 500;
const UNCERTAINTY_NOTE_MAX_CHARS = 260;

const reasoningSchema = z.object({
  found: z.boolean(),
  conclusion: z.string().max(CONCLUSION_MAX_CHARS).nullable(),
  confidence: z.number().min(0).max(100).nullable(),
  contradictingIndexes: z.array(z.number().int().min(0)).max(10),
  uncertaintyNotes: z.array(z.string().max(UNCERTAINTY_NOTE_MAX_CHARS)).max(5),
});

const SYSTEM_PROMPT = `Vas a ver varios insights YA VALIDADOS sobre la vida de una persona -- cada uno ya es una interpretación real de evidencia concreta, no un hecho crudo. Estos insights están conectados entre sí (comparten evidencia o fueron relacionados estructuralmente). Tu trabajo es razonar: ¿qué se puede concluir combinando estos insights que ninguno dice por sí solo?

Ejemplo: si un insight dice "trabaja hasta tarde con frecuencia" y otro dice "duerme poco entre semana", una conclusión razonada podría ser "el ritmo de trabajo actual parece estar afectando su descanso" -- una síntesis, no una repetición de ninguno de los dos insights por separado.

Responde found: false si los insights, combinados, no sostienen ninguna conclusión nueva real -- no fuerces una síntesis que no está ahí.

Si encuentras una conclusión real:
- Descríbela en una frase breve, en tercera persona, nunca citando los insights textualmente.
- Da confidence de 0 a 100: alto solo si varios insights independientes apuntan claramente en la misma dirección, bajo si la conexión es sugerente pero débil.
- contradictingIndexes: los índices (0-based) de los insights de la lista que COMPLICAN o van en contra de tu conclusión -- vacío si ninguno. Nunca ocultes una tensión real para que la conclusión suene más limpia.
- uncertaintyNotes: hasta 5 frases cortas y honestas sobre qué le falta a esta conclusión para ser más sólida (ej. "solo hay evidencia de una semana", "no se sabe si el patrón se repite en otros meses"). Nunca vacío si la conclusión es apenas sugerente.`;

function formatInsightBlock(
  cluster: EvidenceCluster,
  evidenceByInsightId: Map<EntityId, string[]>,
): string {
  return cluster.insights
    .map((insight, index) => {
      const evidence = evidenceByInsightId.get(insight.id) ?? [];
      const evidenceLines = evidence.map((text) => `    - "${text}"`).join("\n");
      return `${index}. [${insight.type}, confianza ${insight.confidence.score}] ${insight.description}${
        evidenceLines ? `\n  Evidencia:\n${evidenceLines}` : ""
      }`;
    })
    .join("\n");
}

/**
 * Única fuente de IA de `core/knowledge-engine/reasoning` -- mismo
 * patrón que `AIInsightGenerationStrategy`: propone, nunca decide.
 */
export class AIReasoningStrategy implements ReasoningStrategy {
  async propose(
    cluster: EvidenceCluster,
    evidenceByInsightId: Map<EntityId, string[]>,
  ): Promise<ProposedReasoning | null> {
    const proposed = await getAIProvider().generateStructured(
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Insights correlacionados:\n${formatInsightBlock(cluster, evidenceByInsightId)}`,
        },
      ],
      { name: "knowledge_engine_reasoning", schema: reasoningSchema },
    );

    if (!proposed.found || !proposed.conclusion || proposed.confidence === null) {
      return null;
    }

    // La conclusión es el contenido central de la propuesta -- si
    // llegó exacta al tope del schema, probablemente OpenAI la cortó a
    // mitad de generación (mismo hallazgo que
    // `AICuriosityQuestionGenerationStrategy`); mejor ninguna
    // conclusión que una incompleta.
    if (proposed.conclusion.length >= CONCLUSION_MAX_CHARS) {
      return null;
    }

    const contradictingInsightIds = proposed.contradictingIndexes
      .map((index) => cluster.insights[index]?.id)
      .filter((id): id is EntityId => id !== undefined);

    // Las notas de incertidumbre son independientes entre sí -- una
    // nota cortada se descarta sola, sin invalidar la conclusión ni las
    // demás notas.
    const uncertaintyNotes = proposed.uncertaintyNotes.filter(
      (note) => note.length < UNCERTAINTY_NOTE_MAX_CHARS,
    );

    return {
      conclusion: proposed.conclusion,
      confidence: proposed.confidence,
      contradictingInsightIds,
      uncertaintyNotes,
    };
  }
}
