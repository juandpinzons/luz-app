import type { RealityMemoryItem } from "../../reality/memory-context-snapshot";
import type { RealitySnapshot } from "../../reality/reality-snapshot";
import type { ClassifiedItem } from "../lifecycle/classify-stage";
import type { PipelineContext } from "../pipeline-context";

/**
 * `relatedMemories` son `RealityMemoryItem` (`core/reality`), no
 * `Memory` de `core/memory-engine` (ADR-0013) — Knowledge ya no
 * conoce ese tipo en absoluto.
 *
 * Memory-shaped porque Memory es hoy la única fuente de evidencia con
 * un engine real, no porque el pipeline esté cerrado a otras fuentes —
 * mismo punto documentado en `GeneratedInsight.evidence` y
 * `Evidence.memoryId`. `core/reality/external-signal-snapshot.ts` ya
 * reserva el lugar neutral para cuando eso cambie.
 */
export interface RelatedItem extends ClassifiedItem {
  relatedMemories: RealityMemoryItem[];
}

/**
 * Patrón estrategia, igual que `MemoryRetrievalStrategy`
 * (`core/memory-engine`): encontrar memorias relacionadas puede
 * resolverse por coincidencia estructural, por similitud semántica, o
 * ambas — ninguna implementación concreta existe todavía.
 *
 * Este contrato no presupone que "relacionar" signifique siempre
 * comparar texto. La primera implementación (`StructuralInsightRelationshipStrategy`,
 * PR-4) compara texto porque la única fuente con datos reales hoy es
 * `RealityMemoryItem.content` — no porque `relate()` exija texto. Una
 * vez existan engines para las demás fuentes de `RealitySnapshot.signals`
 * (Gmail, Calendar, Drive, Health, sensores, ubicación —
 * `core/reality/external-signal-snapshot.ts`), una implementación
 * hermana puede relacionar por superposición de ventanas de tiempo,
 * proximidad geográfica, hilo/remitente compartido, o cualquier otro
 * hecho verificable propio de esa fuente — sin tocar esta firma.
 *
 * Recibe `snapshot` explícito, mismo patrón que `ExtractStage.extract()`
 * (fix de contrato, PR-4): `relatedMemories` en `RelatedItem` exige
 * `RealityMemoryItem[]`, y el único lugar del pipeline con acceso a
 * esos datos es el `RealitySnapshot` — sin este parámetro, ninguna
 * implementación de esta interfaz podía cumplir lo que promete.
 * `context` sigue llevando solo identidad/alcance (ADR-0013): el
 * snapshot es el dato a procesar, no pertenece ahí.
 */
export interface InsightRelationshipStrategy {
  relate(
    snapshot: RealitySnapshot,
    items: ClassifiedItem[],
    context: PipelineContext,
  ): Promise<RelatedItem[]>;
}
