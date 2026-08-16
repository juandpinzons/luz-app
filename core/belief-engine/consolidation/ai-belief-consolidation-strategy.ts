import { z } from "zod";
import { getAIProvider } from "../../../ai";
import { LIFE_DOMAIN_TYPES } from "../../life/value-objects/life-domain-type";
import type { Insight } from "../../knowledge-engine/entities/insight";
import type {
  BeliefConsolidationStrategy,
  ProposedBeliefStatement,
} from "./belief-consolidation-strategy";

/**
 * `max` generoso a propósito -- mismo hallazgo que
 * `AICuriosityQuestionGenerationStrategy` (confirmado contra la API
 * real): la salida estructurada de OpenAI recorta la cadena al tope
 * exacto del schema en vez de rechazarla. `statement` se guarda como
 * creencia duradera sobre la persona (`/life/identity`) -- una frase
 * cortada a mitad de camino ahí es peor que ninguna, así que
 * `proposeStatement` descarta cualquiera que llegue exacto a este tope.
 */
const STATEMENT_MAX_CHARS = 320;

const consolidationSchema = z.object({
  found: z.boolean(),
  statement: z.string().max(STATEMENT_MAX_CHARS).nullable(),
  domain: z.enum(LIFE_DOMAIN_TYPES).nullable(),
  isCommunicationStyle: z.boolean(),
  confidence: z.number().min(0).max(100).nullable(),
});

const SYSTEM_PROMPT = `Vas a ver un Insight ya validado sobre la vida de una persona, junto con la evidencia real que lo respalda. Tu trabajo es decidir si esto revela algo duradero sobre QUIÉN ES la persona -- un rasgo, un valor, una tendencia consistente -- no un hecho puntual.

Si lo hay, escribe una frase corta en tercera persona describiendo la creencia (ej. "Es una persona disciplinada con su salud incluso bajo presión"), nunca citando el insight textualmente.

Casi siempre esto es sobre un ÁREA DE VIDA (domain) -- clasifícala ahí si es razonablemente claro, null si no aplica ninguna con claridad. Pero a veces la evidencia no es sobre un área de vida en absoluto, sino sobre CÓMO esta persona prefiere que LE HABLEN (ej. "prefiere respuestas directas y cortas, sin rodeos", "tiene buen nivel técnico, puede usarse vocabulario preciso sin explicar de más", "valora un tono cálido e informal") -- en ese caso marca isCommunicationStyle: true y deja domain en null, nunca fuerces esto a un área de vida que no le queda.

Responde found: false si el insight es un hecho aislado sin nada duradero detrás, o si sería prematuro generalizar a partir de una sola pieza de evidencia.

Da confidence de 0 a 100: alto solo si la evidencia respalda claramente un patrón, bajo si es apenas sugerente.`;

/**
 * Única fuente de IA de `core/belief-engine` -- mismo patrón que
 * `AIInsightGenerationStrategy`/`AIConceptExtractionStrategy`: propone,
 * nunca decide.
 */
export class AIBeliefConsolidationStrategy implements BeliefConsolidationStrategy {
  async proposeStatement(
    insight: Insight,
    evidenceText: string[],
  ): Promise<ProposedBeliefStatement | null> {
    const evidenceBlock = evidenceText.map((text) => `- "${text}"`).join("\n");

    const proposed = await getAIProvider().generateStructured(
      [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Insight (${insight.type}, confianza ${insight.confidence.score}): "${insight.description}"\n\nEvidencia:\n${evidenceBlock}`,
        },
      ],
      { name: "belief_consolidation", schema: consolidationSchema },
    );

    if (!proposed.found || !proposed.statement || proposed.confidence === null) {
      return null;
    }

    if (proposed.statement.length >= STATEMENT_MAX_CHARS) {
      return null;
    }

    return {
      statement: proposed.statement,
      domain: proposed.domain ?? undefined,
      category: proposed.isCommunicationStyle ? "communication_style" : "life_domain",
      confidence: proposed.confidence,
    };
  }
}
