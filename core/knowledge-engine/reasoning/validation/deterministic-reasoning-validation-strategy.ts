import type { ContradictionRepository } from "../../../contradiction-engine";
import type { EntityId } from "../../../life/value-objects/entity-id";
import type { PipelineContext } from "../../pipeline-context";
import type { EvidenceCluster } from "../correlation/reasoning-correlate-stage";
import type { ProposedReasoning } from "../inference/reasoning-strategy";
import type {
  ReasoningValidationStrategy,
  ValidatedReasoning,
} from "./reasoning-validation-strategy";

/**
 * Nunca una conclusión a partir de un solo insight -- mismo criterio de
 * evidencia mínima que `DeterministicInsightValidationStrategy` (2
 * memorias distintas), aplicado un nivel más arriba (2 insights
 * correlacionados). Exportada para que `DefaultReasoningEngine` pueda
 * saltarse la llamada a IA en clusters que de todas formas se
 * rechazarían aquí -- un solo número compartido, nunca duplicado.
 */
export const MIN_CLUSTER_SIZE = 2;

/**
 * Más alto que el umbral base de validación de Insight (50) -- una
 * conclusión de razonamiento es una síntesis de tercer orden (memoria
 * → insight → conclusión), mismo criterio de exigencia creciente ya
 * documentado en `CONCEPT_CONFIDENCE_THRESHOLD`/
 * `BELIEF_CONFIDENCE_THRESHOLD`/`CONTRADICTION_CONFIDENCE_THRESHOLD`.
 */
const REASONING_CONFIDENCE_THRESHOLD = 60;

/**
 * Determinista, sin IA -- decide si una propuesta se persiste, mismo
 * rol que `DeterministicInsightValidationStrategy` un nivel arriba.
 * `contradictionRepository` es la reutilización real de
 * `core/contradiction-engine`: hoy las contradicciones persistidas
 * nunca referencian un Insight directamente (Contradiction Engine
 * compara Beliefs/Goals/Habits, ver `enrich-knowledge-graph.ts`), así
 * que esta comprobación consistentemente no encuentra nada todavía --
 * queda lista, correcta, para cuando Contradiction Engine se extienda
 * a insights sin que esta etapa tenga que cambiar (compatibilidad
 * futura real, no un adorno).
 */
export class DeterministicReasoningValidationStrategy implements ReasoningValidationStrategy {
  constructor(private readonly contradictionRepository: ContradictionRepository) {}

  async validate(
    cluster: EvidenceCluster,
    proposed: ProposedReasoning | null,
    pipelineContext: PipelineContext,
  ): Promise<ValidatedReasoning | null> {
    if (cluster.insights.length < MIN_CLUSTER_SIZE) {
      return null;
    }
    if (!proposed || proposed.confidence < REASONING_CONFIDENCE_THRESHOLD) {
      return null;
    }

    const contradictingFromProposal = new Set(proposed.contradictingInsightIds);
    const supportingInsightIds = cluster.insights
      .map((insight) => insight.id)
      .filter((id) => !contradictingFromProposal.has(id));

    const contradictingFromRepository: EntityId[] = [];
    for (const insight of cluster.insights) {
      const existing = await this.contradictionRepository.listByRef(pipelineContext, {
        refType: "insight",
        refId: insight.id,
      });
      if (existing.some((contradiction) => contradiction.status === "open" || contradiction.status === "acknowledged")) {
        contradictingFromRepository.push(insight.id);
      }
    }

    const contradictingInsightIds = [
      ...new Set([...proposed.contradictingInsightIds, ...contradictingFromRepository]),
    ];

    const uncertaintyNotes = [...proposed.uncertaintyNotes];
    if (cluster.insights.length === MIN_CLUSTER_SIZE) {
      uncertaintyNotes.push(
        "Basado en el mínimo de evidencia necesaria (2 insights correlacionados) -- una tercera fuente independiente fortalecería esta conclusión.",
      );
    }

    return {
      statement: proposed.conclusion,
      confidence: { score: proposed.confidence, assignedAt: new Date() },
      uncertaintyNotes,
      supportingInsightIds,
      contradictingInsightIds,
    };
  }
}
