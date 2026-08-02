import type { LifeDomainType } from "../../../core/life/value-objects/life-domain-type";
import type { ConversationVarietySnapshot } from "../domain/conversation-variety-snapshot";

/**
 * `ConversationVarietySnapshot` -> el único primitivo que
 * `CuriosityStrategyRule` necesita. Deliberadamente NO el snapshot
 * completo ni un tipo propio de este módulo: `core/conversation-strategy-engine`
 * es `core/*`, nunca puede importar un tipo de `features/*` -- mismo
 * criterio que ya usa `core/reality/knowledge-gaps-snapshot.ts`
 * (define su propia forma mínima en vez de importar la más rica de
 * `core/knowledge-gaps`). `LifeDomainType` ya vive en `core/life`, del
 * que `core/conversation-strategy-engine` ya depende -- cero import
 * nuevo entre capas.
 *
 * `"general"` nunca puede ser el resultado -- no es un `LifeDomainType`
 * real, y `CuriosityStrategyRule` nunca elige explorar "general".
 */
export function toCuriosityFatiguedDomain(
  snapshot: ConversationVarietySnapshot,
): LifeDomainType | null {
  const domain = snapshot.fatiguedDomain?.domain;
  return domain && domain !== "general" ? domain : null;
}
