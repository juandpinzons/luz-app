import type { RealitySnapshot } from "../../reality/reality-snapshot";
import type { PipelineContext } from "../pipeline-context";
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
 */
export class DefaultExtractStage implements ExtractStage {
  async extract(
    snapshot: RealitySnapshot,
    _context: PipelineContext,
  ): Promise<ExtractedItem[]> {
    return snapshot.memory.items.map((item) => ({ text: item.content }));
  }
}
