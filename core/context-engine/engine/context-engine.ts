import type { LifeGraphContext } from "../../life/life-graph-context";
import type { RealitySnapshot } from "../../reality/reality-snapshot";
import type { Context } from "../entities/context";
import type { ContextFilterStrategy } from "../filtering/context-filter-strategy";
import type { ContextPrioritizationStrategy } from "../prioritization/context-prioritization-strategy";
import type { ContextScoringStrategy } from "../scoring/context-scoring-strategy";

/**
 * Las dependencias que una implementación de `ContextEngine` compone:
 * Filter → Score → Prioritize, siempre en ese orden — filtrar antes de
 * puntuar evita gastar esfuerzo puntuando candidatos que ya no
 * aplican. Solo el tipo — orquestarlas es lógica de negocio, fuera de
 * alcance de esta foundation.
 */
export interface ContextEngineStages {
  filter: ContextFilterStrategy;
  score: ContextScoringStrategy;
  prioritize: ContextPrioritizationStrategy;
}

/**
 * Único punto de acceso al Context Engine que vería el resto del
 * dominio. Contrato únicamente: sin implementación. Recibe el
 * `RealitySnapshot` ya ensamblado (ADR-0013) — nunca lee Memory, el
 * Life Graph, ni Knowledge directamente.
 */
export interface ContextEngine {
  build(snapshot: RealitySnapshot, context: LifeGraphContext): Promise<Context>;
}
