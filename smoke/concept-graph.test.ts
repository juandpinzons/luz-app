import {
  DrizzleConceptRepository,
  extractConceptsFromInsight,
  type ConceptExtractionResult,
  type ConceptExtractionStrategy,
} from "../core/concept-graph";
import { db } from "../core/db/client";
import { createEntityId } from "../core/life";
import type { Insight } from "../core/knowledge-engine/entities/insight";
import type { SmokeContext, SmokeFlow } from "./types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/** Estrategia de IA falsa -- mismo criterio que el resto de `smoke/`. */
class FakeConceptExtractionStrategy implements ConceptExtractionStrategy {
  callCount = 0;

  constructor(private readonly response: ConceptExtractionResult | null) {}

  async extract(): Promise<ConceptExtractionResult | null> {
    this.callCount += 1;
    return this.response;
  }
}

function buildInsight(description: string): Insight {
  const now = new Date();
  return {
    id: createEntityId(crypto.randomUUID()),
    lifeGraphId: createEntityId(crypto.randomUUID()),
    type: "pattern",
    description,
    confidence: { score: 80, assignedAt: now },
    status: "validated",
    createdAt: now,
    updatedAt: now,
    validatedAt: now,
  };
}

export const conceptGraphFlow: SmokeFlow = {
  name: "concept-graph",
  async run(ctx: SmokeContext) {
    const context = ctx.lifeGraphContext;
    const repository = new DrizzleConceptRepository(db);
    const evidence = [{ id: createEntityId(crypto.randomUUID()), content: "Smoke: memoria de evidencia" }];
    const insight = buildInsight("Smoke: insight base para conceptos");

    // Fixture 1: sin memorias de evidencia -- nunca debe llamar a la
    // IA, mismo gate que `consolidateBeliefFromInsight`.
    const unusedStrategy = new FakeConceptExtractionStrategy({
      concepts: [{ label: "Smoke: no debería usarse" }],
      relations: [],
      confidence: 90,
    });
    const noEvidenceResult = await extractConceptsFromInsight(
      repository,
      unusedStrategy,
      context,
      insight,
      [],
    );
    assert(noEvidenceResult.length === 0, "sin memorias de evidencia, nunca debería extraer conceptos");
    assert(unusedStrategy.callCount === 0, "sin memorias de evidencia, nunca debería llamar a la estrategia");

    // Fixture 2: confianza propuesta por debajo del umbral (55) --
    // nunca se persiste, sin importar los conceptos propuestos.
    const lowConfidenceStrategy = new FakeConceptExtractionStrategy({
      concepts: [{ label: "Smoke: concepto débil" }],
      relations: [],
      confidence: 40,
    });
    const belowThreshold = await extractConceptsFromInsight(
      repository,
      lowConfidenceStrategy,
      context,
      insight,
      evidence,
    );
    assert(belowThreshold.length === 0, "una propuesta con confianza 40 (<55) nunca debería persistirse");

    // Fixture 3: propuesta válida, un concepto nuevo (etiqueta única
    // por corrida -- mismo criterio que belief-engine.test.ts: un
    // literal fijo colisionaría con datos de una corrida standalone
    // anterior via el match EXACTO de `getByLabel`, no solo el
    // fuzzy-match). Debe crear el concepto y guardar evidencia por
    // cada memoria.
    const uniqueLabel = `Smoke Disciplina ${crypto.randomUUID()}`;
    const creatingStrategy = new FakeConceptExtractionStrategy({
      concepts: [{ label: uniqueLabel, description: "Smoke: descripción" }],
      relations: [],
      confidence: 70,
    });
    const created = await extractConceptsFromInsight(
      repository,
      creatingStrategy,
      context,
      insight,
      evidence,
    );
    assert(created.length === 1, `se esperaba 1 concepto creado, se obtuvieron ${created.length}`);
    const concept = created[0];
    assert(concept.label === uniqueLabel, `label incorrecto: ${concept?.label}`);

    const evidenceRows = await repository.listEvidence(context, concept.id);
    assert(evidenceRows.length === 1, `se esperaba 1 fila de evidencia, se obtuvieron ${evidenceRows.length}`);
    assert(evidenceRows[0]?.memoryId === evidence[0]?.id, "la evidencia persistida no coincide con la memoria real");

    // Fixture 4: una segunda propuesta con la MISMA etiqueta (match
    // exacto, `getByLabel`) debe reutilizar el concepto existente,
    // nunca crear un duplicado.
    const secondInsight = buildInsight("Smoke: segundo insight, mismo concepto");
    const reuseStrategy = new FakeConceptExtractionStrategy({
      concepts: [{ label: uniqueLabel }],
      relations: [],
      confidence: 65,
    });
    const reused = await extractConceptsFromInsight(
      repository,
      reuseStrategy,
      context,
      secondInsight,
      evidence,
    );
    assert(reused.length === 1, `se esperaba 1 concepto (reutilizado), se obtuvieron ${reused.length}`);
    assert(
      reused[0]?.id === concept.id,
      "una etiqueta ya existente debe reutilizar el mismo Concept, nunca crear uno duplicado",
    );

    const evidenceAfterReuse = await repository.listEvidence(context, concept.id);
    assert(
      evidenceAfterReuse.length === 2,
      `se esperaban 2 filas de evidencia tras la segunda propuesta, se obtuvieron ${evidenceAfterReuse.length}`,
    );

    // Fixture 5: dos conceptos nuevos + una relación real entre ambos
    // -- debe persistir la relación con fromConceptId/toConceptId
    // correctos y strength = confidence de la propuesta.
    const labelA = `Smoke A ${crypto.randomUUID()}`;
    const labelB = `Smoke B ${crypto.randomUUID()}`;
    const relatingStrategy = new FakeConceptExtractionStrategy({
      concepts: [{ label: labelA }, { label: labelB }],
      relations: [{ fromLabel: labelA, toLabel: labelB, relationType: "lleva_a" }],
      confidence: 60,
    });
    const relatedInsight = buildInsight("Smoke: insight con relación real");
    const relatedConcepts = await extractConceptsFromInsight(
      repository,
      relatingStrategy,
      context,
      relatedInsight,
      evidence,
    );
    assert(relatedConcepts.length === 2, `se esperaban 2 conceptos, se obtuvieron ${relatedConcepts.length}`);
    const conceptA = relatedConcepts.find((c) => c.label === labelA);
    const conceptB = relatedConcepts.find((c) => c.label === labelB);
    assert(conceptA !== undefined && conceptB !== undefined, "no se encontraron los dos conceptos esperados por label");

    const relations = await repository.listRelations(context, conceptA!.id);
    assert(relations.length === 1, `se esperaba 1 relación persistida, se obtuvieron ${relations.length}`);
    assert(relations[0]?.fromConceptId === conceptA!.id, "fromConceptId no coincide con el concepto A");
    assert(relations[0]?.toConceptId === conceptB!.id, "toConceptId no coincide con el concepto B");
    assert(relations[0]?.relationType === "lleva_a", `relationType incorrecto: ${relations[0]?.relationType}`);
    assert(relations[0]?.strength === 60, `strength incorrecto: ${relations[0]?.strength} (se esperaba la confidence de la propuesta, 60)`);

    // Fixture 6: una relación que referencia una etiqueta que la IA NO
    // incluyó en `concepts` (nunca verificable) debe descartarse en
    // silencio, sin lanzar y sin persistir nada.
    const labelC = `Smoke C ${crypto.randomUUID()}`;
    const unresolvedLabel = `Smoke inexistente ${crypto.randomUUID()}`;
    const unresolvedStrategy = new FakeConceptExtractionStrategy({
      concepts: [{ label: labelC }],
      relations: [{ fromLabel: labelC, toLabel: unresolvedLabel, relationType: "lleva_a" }],
      confidence: 60,
    });
    const unresolvedInsight = buildInsight("Smoke: relación con etiqueta no resuelta");
    const unresolvedConcepts = await extractConceptsFromInsight(
      repository,
      unresolvedStrategy,
      context,
      unresolvedInsight,
      evidence,
    );
    assert(unresolvedConcepts.length === 1, `se esperaba 1 concepto (C), se obtuvieron ${unresolvedConcepts.length}`);
    const relationsForC = await repository.listRelations(context, unresolvedConcepts[0]!.id);
    assert(
      relationsForC.length === 0,
      `una relación hacia una etiqueta no resuelta nunca debería persistirse, se obtuvieron ${relationsForC.length}`,
    );

    // Fixture 7: una relación cuyo fromLabel/toLabel resuelven al MISMO
    // concepto (self-relation) debe descartarse en silencio.
    const labelD = `Smoke D ${crypto.randomUUID()}`;
    const selfRelationStrategy = new FakeConceptExtractionStrategy({
      concepts: [{ label: labelD }],
      relations: [{ fromLabel: labelD, toLabel: labelD, relationType: "lleva_a" }],
      confidence: 60,
    });
    const selfRelationInsight = buildInsight("Smoke: relación consigo mismo");
    const selfRelationConcepts = await extractConceptsFromInsight(
      repository,
      selfRelationStrategy,
      context,
      selfRelationInsight,
      evidence,
    );
    assert(selfRelationConcepts.length === 1, `se esperaba 1 concepto (D), se obtuvieron ${selfRelationConcepts.length}`);
    const relationsForD = await repository.listRelations(context, selfRelationConcepts[0]!.id);
    assert(
      relationsForD.length === 0,
      `una relación de un concepto consigo mismo nunca debería persistirse, se obtuvieron ${relationsForD.length}`,
    );
  },
};
