import type { Belief } from "../../../core/belief-engine";
import { DrizzleBeliefRepository } from "../../../core/belief-engine";
import type { Concept } from "../../../core/concept-graph";
import { DrizzleConceptRepository } from "../../../core/concept-graph";
import type { Contradiction } from "../../../core/contradiction-engine";
import { DrizzleContradictionRepository } from "../../../core/contradiction-engine";
import type { Database } from "../../../core/db/client";
import { DrizzleImportanceRepository } from "../../../core/importance-engine";
import type { DomainCoverage } from "../../../core/knowledge-gaps";
import { DrizzleReasoningRepository, type ReasoningConclusion } from "../../../core/knowledge-engine";
import type { LifeGraphContext } from "../../../core/life/life-graph-context";
import { LIFE_DOMAIN_LABEL } from "../../../core/life/value-objects/life-domain-label";
import type { LifeDomainType } from "../../../core/life/value-objects/life-domain-type";
import type { EvolutionSummary } from "../../../core/temporal-evolution";
import { assembleRealitySnapshot } from "../../chat/services/assemble-reality-snapshot";
import { describeEvolution } from "./describe-evolution";

const TOP_BELIEFS_LIMIT = 8;
const TOP_CONCEPTS_LIMIT = 8;
const TOP_REASONING_CONCLUSIONS_LIMIT = 5;
const RECENT_EVOLUTION_WINDOW_DAYS = 30;

export interface DomainUnderstanding {
  domain: LifeDomainType;
  label: string;
  coverageScore: number;
  beliefs: Belief[];
}

/**
 * Vista viva de quién es la persona, ensamblada en el momento de cada
 * consulta -- nunca persistida como estado propio (Principio 6: la
 * fuente de verdad sigue siendo `beliefs`/`concepts`/`contradictions`/
 * `importance_scores` ya guardados, esto solo los combina). Todo dato
 * aquí es trazable a evidencia real vía el `id` de cada Belief/Concept
 * (Principio 3) -- esta forma nunca inventa una categoría (fortaleza,
 * valor, motivación...) que el dato subyacente no pueda respaldar
 * todavía; organiza por dominio y por Belief, que es lo que sí está
 * clasificado hoy. Evolucionar hacia categorías más finas es una
 * capacidad futura, no una que se simule aquí sin evidencia real
 * (Principio 1).
 */
export interface PersonIdentityModel {
  lifeGraphId: LifeGraphContext["lifeGraphId"];
  personId: LifeGraphContext["personId"];
  generatedAt: Date;
  domainUnderstanding: DomainUnderstanding[];
  topBeliefs: Belief[];
  topConcepts: Concept[];
  openContradictions: Contradiction[];
  knowledgeGaps: DomainCoverage[];
  recentEvolution: EvolutionSummary;
  /** `core/knowledge-engine/reasoning` -- síntesis sobre varios Beliefs/Insights a la vez, no una interpretación puntual. */
  topReasoningConclusions: ReasoningConclusion[];
}

function rankByImportance<T extends { id: string }>(
  items: T[],
  entityType: string,
  importanceByKey: Map<string, number>,
  fallbackScore: (item: T) => number,
  limit: number,
): T[] {
  return [...items]
    .sort((a, b) => {
      const scoreA = importanceByKey.get(`${entityType}:${a.id}`) ?? fallbackScore(a);
      const scoreB = importanceByKey.get(`${entityType}:${b.id}`) ?? fallbackScore(b);
      return scoreB - scoreA;
    })
    .slice(0, limit);
}

/**
 * Único punto de ensamblaje -- reutiliza `assembleRealitySnapshot` para
 * `knowledgeGaps`/vida activa en vez de recalcularlo aparte (misma
 * lógica, una sola vez), y `describeEvolution` para la evolución
 * reciente. Consumido por el endpoint de LifeGraph (nodo "Identidad")
 * y, en una fase futura, por el prompt de chat -- no todavía en este
 * bloque (alcance: construir el modelo, no inyectarlo en cada mensaje).
 */
export async function buildIdentityModel(
  db: Database,
  context: LifeGraphContext,
): Promise<PersonIdentityModel> {
  const beliefRepository = new DrizzleBeliefRepository(db);
  const conceptRepository = new DrizzleConceptRepository(db);
  const contradictionRepository = new DrizzleContradictionRepository(db);
  const importanceRepository = new DrizzleImportanceRepository(db);
  const reasoningRepository = new DrizzleReasoningRepository(db);

  const [snapshot, beliefs, concepts, contradictions, importanceScores, evolution, reasoningConclusions] =
    await Promise.all([
      assembleRealitySnapshot(db, context),
      beliefRepository.list(context),
      conceptRepository.list(context),
      contradictionRepository.list(context),
      importanceRepository.list(context),
      describeEvolution(db, context, RECENT_EVOLUTION_WINDOW_DAYS),
      reasoningRepository.list(context),
    ]);

  const activeBeliefs = beliefs.filter((belief) => belief.status === "active");
  const openContradictions = contradictions.filter(
    (contradiction) => contradiction.status === "open" || contradiction.status === "acknowledged",
  );

  const importanceByKey = new Map(
    importanceScores.map((entry) => [`${entry.entityType}:${entry.entityId}`, entry.score]),
  );

  const domainUnderstanding: DomainUnderstanding[] = snapshot.knowledgeGaps.domains.map(
    (coverage) => ({
      domain: coverage.domain,
      label: LIFE_DOMAIN_LABEL[coverage.domain],
      coverageScore: coverage.coverageScore,
      beliefs: activeBeliefs.filter((belief) => belief.domain === coverage.domain),
    }),
  );

  return {
    lifeGraphId: context.lifeGraphId,
    personId: context.personId,
    generatedAt: new Date(),
    domainUnderstanding,
    topBeliefs: rankByImportance(
      activeBeliefs,
      "belief",
      importanceByKey,
      (belief) => belief.confidence.score,
      TOP_BELIEFS_LIMIT,
    ),
    topConcepts: rankByImportance(
      concepts,
      "concept",
      importanceByKey,
      () => 0,
      TOP_CONCEPTS_LIMIT,
    ),
    openContradictions,
    knowledgeGaps: snapshot.knowledgeGaps.domains,
    recentEvolution: evolution.summary,
    topReasoningConclusions: rankByImportance(
      reasoningConclusions.filter((conclusion) => conclusion.status === "validated"),
      "reasoning_conclusion",
      importanceByKey,
      (conclusion) => conclusion.confidence.score,
      TOP_REASONING_CONCLUSIONS_LIMIT,
    ),
  };
}
