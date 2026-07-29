import type { RealitySnapshot } from "../../reality/reality-snapshot";
import type { PipelineContext } from "../pipeline-context";
import type { InsightRepository } from "../repositories/insight.repository";
import type { ExtractedItem, ExtractStage } from "./extract-stage";

/**
 * Determinista a propósito, misma disciplina que
 * `DeterministicClassifyStage`/`StructuralInsightRelationshipStrategy`:
 * cada memoria relevante del `RealitySnapshot` (ya filtrada por
 * `assembleRealitySnapshot` a las que tienen señal real de comprensión,
 * ADR-0013) es, tal cual, un fragmento a interpretar — sin IA en esta
 * etapa. Primera iteración de una capacidad que seguirá evolucionando
 * (una futura versión podría dividir una memoria larga en varios
 * fragmentos, o incorporar `snapshot.signals` cuando existan
 * Conectores) — no una limitación permanente.
 *
 * Idempotencia (auditoría War Room 2026-07-29, bloque 5, reproducido
 * contra Postgres real): `assembleRealitySnapshot` trae hasta
 * `RELEVANT_MEMORY_LIMIT` memorias "top-N" relevantes, no solo la que
 * disparó el job -- las mismas memorias suelen seguir en esa ventana en
 * el job SIGUIENTE (el siguiente mensaje de la misma conversación) o en
 * un reintento tras lease expirado. Sin esta guarda, cada corrida
 * volvía a generar y persistir un Insight nuevo por cada memoria
 * "vieja" todavía en la ventana, aunque ya hubiera producido uno antes
 * -- sin evidencia nueva real, solo por seguir siendo relevante. Se
 * excluye una memoria si YA es evidencia de algún Insight existente
 * (`listByEvidenceMemoryId`, ya usado en `enrich-knowledge-graph.ts`
 * con el mismo criterio) -- una sola fuente de verdad, nunca una
 * bandera nueva que se pueda desincronizar de los datos reales. Esto
 * nunca excluye la memoria que disparó ESTA corrida: por definición
 * todavía no puede tener evidencia propia antes de que el pipeline la
 * produzca. Una memoria ya interpretada sigue disponible como evidencia
 * DE APOYO para un insight nuevo de otra memoria (`StructuralInsightRelationshipStrategy`
 * lee `snapshot.memory.items` directo, no la salida de esta etapa) --
 * solo deja de generar un insight NUEVO a partir de ella misma.
 */
export class DefaultExtractStage implements ExtractStage {
  constructor(private readonly insightRepository: InsightRepository) {}

  async extract(
    snapshot: RealitySnapshot,
    context: PipelineContext,
  ): Promise<ExtractedItem[]> {
    const items: ExtractedItem[] = [];

    for (const item of snapshot.memory.items) {
      const existingInsights = await this.insightRepository.listByEvidenceMemoryId(
        context,
        item.id,
      );
      if (existingInsights.length > 0) {
        continue;
      }

      items.push({ sourceMemoryId: item.id, text: item.content });
    }

    return items;
  }
}
