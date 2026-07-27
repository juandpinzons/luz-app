import { titlesLikelyMatch } from "../../life/services/title-similarity";
import type { LifeGraphContext } from "../../life/life-graph-context";
import { createEntityId, type EntityId } from "../../life/value-objects/entity-id";
import type { Insight } from "../../knowledge-engine/entities/insight";
import type { Concept } from "../entities/concept";
import type { ConceptExtractionStrategy } from "../extraction/concept-extraction-strategy";
import type { ConceptRepository } from "../repositories/concept.repository";

/**
 * Umbral deliberadamente más alto que `VALIDATION_CONFIDENCE_THRESHOLD`
 * (50, `DeterministicInsightValidationStrategy`): un concepto es una
 * abstracción sobre un Insight que YA pasó ese umbral, así que dejarlo
 * pasar con la misma confianza mínima infla el grafo de conceptos con
 * lecturas marginales. Documentado aquí, no reutilizado desde
 * knowledge-engine, porque son decisiones independientes que pueden
 * evolucionar por separado (Principio 1).
 */
const CONCEPT_CONFIDENCE_THRESHOLD = 55;

async function getOrCreateConcept(
  repository: ConceptRepository,
  context: LifeGraphContext,
  proposed: { label: string; description?: string },
  now: Date,
): Promise<Concept> {
  const exact = await repository.getByLabel(context, proposed.label);
  if (exact) {
    return exact;
  }

  const existing = await repository.list(context);
  const fuzzyMatch = existing.find((concept) =>
    titlesLikelyMatch(concept.label, proposed.label),
  );
  if (fuzzyMatch) {
    return fuzzyMatch;
  }

  return repository.save(context, {
    id: createEntityId(crypto.randomUUID()),
    lifeGraphId: context.lifeGraphId,
    label: proposed.label,
    description: proposed.description,
    createdAt: now,
    updatedAt: now,
  });
}

/**
 * Corre después de que un Insight quedó persistido (ver
 * `enrich-knowledge-graph.ts`, el único llamador real) — nunca antes:
 * un concepto siempre nace de un Insight ya validado, jamás de una
 * memoria cruda ni de un Insight rechazado. Best-effort: si la IA no
 * encuentra nada (`extract()` devuelve `null`) o la confianza no
 * alcanza el umbral, no se crea ni actualiza nada — silencio, no error.
 * Devuelve los conceptos tocados (creados o reforzados) para que el
 * llamador pueda recalcular su importancia (`core/importance-engine`)
 * sin que este servicio tenga que conocer ese engine.
 */
export async function extractConceptsFromInsight(
  repository: ConceptRepository,
  strategy: ConceptExtractionStrategy,
  context: LifeGraphContext,
  insight: Insight,
  evidenceMemories: { id: EntityId; content: string }[],
): Promise<Concept[]> {
  if (evidenceMemories.length === 0) {
    return [];
  }

  const proposal = await strategy.extract(
    insight,
    evidenceMemories.map((memory) => memory.content),
  );

  if (!proposal || proposal.confidence < CONCEPT_CONFIDENCE_THRESHOLD) {
    return [];
  }

  const now = new Date();
  const byLabel = new Map<string, Concept>();

  for (const proposedConcept of proposal.concepts) {
    const concept = await getOrCreateConcept(repository, context, proposedConcept, now);
    byLabel.set(proposedConcept.label.trim().toLowerCase(), concept);

    for (const memory of evidenceMemories) {
      await repository.saveEvidence(context, {
        id: createEntityId(crypto.randomUUID()),
        lifeGraphId: context.lifeGraphId,
        conceptId: concept.id,
        insightId: insight.id,
        memoryId: memory.id,
        createdAt: now,
      });
    }
  }

  for (const relation of proposal.relations) {
    const from = byLabel.get(relation.fromLabel.trim().toLowerCase());
    const to = byLabel.get(relation.toLabel.trim().toLowerCase());
    // Solo conecta conceptos que este mismo lote acaba de resolver --
    // una relación que referencia una etiqueta que la IA no incluyó en
    // `concepts` no es una relación verificable, se descarta en
    // silencio (mismo criterio que "found: false" para un insight sin
    // evidencia real).
    if (!from || !to || from.id === to.id) {
      continue;
    }

    await repository.saveRelation(context, {
      id: createEntityId(crypto.randomUUID()),
      lifeGraphId: context.lifeGraphId,
      fromConceptId: from.id,
      toConceptId: to.id,
      relationType: relation.relationType,
      strength: proposal.confidence,
      createdAt: now,
    });
  }

  return [...byLabel.values()];
}
