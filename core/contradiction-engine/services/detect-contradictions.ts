import type { LifeGraphContext } from "../../life/life-graph-context";
import { createEntityId } from "../../life/value-objects/entity-id";
import type { LifeDomainType } from "../../life/value-objects/life-domain-type";
import type {
  ContradictionCandidate,
  ContradictionDetectionStrategy,
} from "../detection/contradiction-detection-strategy";
import type { Contradiction } from "../entities/contradiction";
import type { ContradictionRepository } from "../repositories/contradiction.repository";

/** Mismo criterio que `CONCEPT_CONFIDENCE_THRESHOLD`/`BELIEF_CONFIDENCE_THRESHOLD`: más alto que la validación base porque es una interpretación de segundo orden sobre datos ya validados. */
const CONTRADICTION_CONFIDENCE_THRESHOLD = 60;

function pairAlreadyOpen(
  existing: Contradiction[],
  subject: ContradictionCandidate,
  other: ContradictionCandidate,
): boolean {
  return existing.some((contradiction) => {
    if (contradiction.status !== "open" && contradiction.status !== "acknowledged") {
      return false;
    }
    const refs = [contradiction.left, contradiction.right];
    const hasSubject = refs.some(
      (ref) => ref.refType === subject.refType && ref.refId === subject.refId,
    );
    const hasOther = refs.some(
      (ref) => ref.refType === other.refType && ref.refId === other.refId,
    );
    return hasSubject && hasOther;
  });
}

/**
 * Corre después de que un Belief se crea o se refuerza (ver
 * `enrich-knowledge-graph.ts`) contra una lista acotada de candidatos
 * ya reunidos por la capa de aplicación (otros Beliefs activos, Goals,
 * Habits del mismo LifeGraph -- nunca ensamblados aquí, ver docblock de
 * `ContradictionRef`). Best-effort: nunca lanza por una detección sin
 * resultado.
 */
export async function detectContradictions(
  repository: ContradictionRepository,
  strategy: ContradictionDetectionStrategy,
  context: LifeGraphContext,
  subject: ContradictionCandidate,
  against: ContradictionCandidate[],
  domain: LifeDomainType | undefined,
): Promise<Contradiction[]> {
  if (against.length === 0) {
    return [];
  }

  const proposals = await strategy.detect(subject, against);
  if (proposals.length === 0) {
    return [];
  }

  const existingForSubject = await repository.listByRef(context, {
    refType: subject.refType,
    refId: subject.refId,
  });

  const now = new Date();
  const created: Contradiction[] = [];

  for (const proposal of proposals) {
    if (proposal.confidence < CONTRADICTION_CONFIDENCE_THRESHOLD) {
      continue;
    }

    const other = against[proposal.candidateIndex];
    if (!other) {
      continue;
    }

    if (pairAlreadyOpen(existingForSubject, subject, other)) {
      continue;
    }

    const contradiction: Contradiction = {
      id: createEntityId(crypto.randomUUID()),
      lifeGraphId: context.lifeGraphId,
      kind: `${subject.refType}_${other.refType}`,
      left: { refType: subject.refType, refId: subject.refId },
      right: { refType: other.refType, refId: other.refId },
      description: proposal.description,
      domain,
      status: "open",
      detectedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    created.push(await repository.save(context, contradiction));
  }

  return created;
}
