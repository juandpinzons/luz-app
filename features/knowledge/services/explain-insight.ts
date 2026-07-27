import type { Database } from "../../../core/db/client";
import { DrizzleInsightRepository } from "../../../core/knowledge-engine";
import type { EntityId, LifeGraphContext } from "../../../core/life";
import { DrizzleMemoryRepository } from "../../../core/memory-engine";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface InsightEvidenceItem {
  content: string;
  occurredAt: Date | null;
}

/**
 * El "por qué" de un insight, trazable hasta la evidencia real -- nunca
 * un dato nuevo, solo lo que `Insight`/`Evidence`/`Memory` ya tenían
 * persistido. Deliberadamente NO incluye `confidence.score` ni un
 * "band" derivado de él: `DeterministicInsightValidationStrategy`
 * (`core/knowledge-engine/validation`) ya tiene un único umbral real
 * (`VALIDATION_CONFIDENCE_THRESHOLD = 50`) y ya decidió con él -- un
 * insight que llega aquí ya pasó ese corte. Inventar un segundo umbral
 * (p. ej. "alta" a partir de 75) encima del que Validate ya usó sería
 * exactamente la lógica inventada que se pidió evitar. Lo que sí varía
 * de verdad entre insights ya validados es cuánta evidencia hay y qué
 * tan seguido se repite -- eso es lo que esta forma expone.
 */
export interface InsightExplanation {
  id: EntityId;
  /** La interpretación misma (`insight.description`), tal cual -- nunca reescrita ni reinterpretada aquí. */
  reason: string;
  /** Orden cronológico, la más antigua primero. */
  evidence: InsightEvidenceItem[];
  /** Siempre >= 2 -- Validate rechaza cualquier insight con menos de dos memorias distintas de evidencia. */
  evidenceCount: number;
  firstEvidenceAt: Date | null;
  mostRecentEvidenceAt: Date | null;
  /** `null` únicamente si ninguna evidencia tiene fecha resuelta (memoria borrada, o sin `occurredAt` ni `createdAt` -- no debería pasar en la práctica). */
  daysSinceMostRecentEvidence: number | null;
  /** Días entre la primera y la última evidencia -- 0 si toda ocurrió el mismo día. */
  spanDays: number | null;
}

/**
 * Explica un insight ya persistido, leyendo únicamente lo que Knowledge
 * Engine y Memory Engine ya decidieron -- nunca vuelve a llamar a un
 * LLM, nunca recalcula confianza ni evidencia. `null` si el insight no
 * existe o no está `validated` (silencio intencional en la puerta de
 * entrada, no como caso especial después).
 */
export async function explainInsight(
  db: Database,
  context: LifeGraphContext,
  insightId: EntityId,
): Promise<InsightExplanation | null> {
  const insightRepository = new DrizzleInsightRepository(db);
  const memoryRepository = new DrizzleMemoryRepository(db);

  const insight = await insightRepository.getById(context, insightId);
  if (!insight || insight.status !== "validated") {
    return null;
  }

  const evidenceRows = await insightRepository.getEvidence(context, insightId);
  const resolved = await Promise.all(
    evidenceRows.map(async (row): Promise<InsightEvidenceItem | null> => {
      const memory = await memoryRepository.getById(context, row.memoryId);
      if (!memory) return null;
      return {
        content: memory.content,
        occurredAt: memory.occurredAt ?? memory.createdAt,
      };
    }),
  );

  const evidence = resolved
    .filter((item): item is InsightEvidenceItem => item !== null)
    .sort((a, b) => (a.occurredAt?.getTime() ?? 0) - (b.occurredAt?.getTime() ?? 0));

  const dated = evidence.filter(
    (item): item is { content: string; occurredAt: Date } => item.occurredAt !== null,
  );
  const firstEvidenceAt = dated[0]?.occurredAt ?? null;
  const mostRecentEvidenceAt = dated.at(-1)?.occurredAt ?? null;

  const daysSinceMostRecentEvidence = mostRecentEvidenceAt
    ? Math.floor((Date.now() - mostRecentEvidenceAt.getTime()) / DAY_MS)
    : null;
  const spanDays =
    firstEvidenceAt && mostRecentEvidenceAt
      ? Math.floor((mostRecentEvidenceAt.getTime() - firstEvidenceAt.getTime()) / DAY_MS)
      : null;

  return {
    id: insight.id,
    reason: insight.description,
    evidence,
    evidenceCount: evidence.length,
    firstEvidenceAt,
    mostRecentEvidenceAt,
    daysSinceMostRecentEvidence,
    spanDays,
  };
}
