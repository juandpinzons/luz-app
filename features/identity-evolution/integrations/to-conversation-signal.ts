import type { EntityId } from "../../../core/life/value-objects/entity-id";
import type { LifeDomainType } from "../../../core/life/value-objects/life-domain-type";
import type { IdentitySnapshot } from "../domain/identity-snapshot";

export interface IdentityConversationSignal {
  readonly leadWithDomain: LifeDomainType | null;
  readonly leadWithTheme: EntityId | null;
  readonly primaryLabel: string | null;
  readonly worthAcknowledging: readonly string[];
  readonly avoidDominating: readonly string[];
  /** `true` cuando `trajectory.state === "transitioning"` -- la persona está, de forma medible, convirtiéndose en alguien distinto ahora mismo; una Conversation Strategy real podría usar esto para nombrar el cambio en vez de asumir continuidad. */
  readonly isIdentityInTransition: boolean;
}

/**
 * `IdentitySnapshot` -> señal para `core/conversation-strategy-engine`
 * -- misión: la capa de Conversación es uno de los cuatro consumidores
 * explícitos de "Identity Guidance". Combina `conversationGuidance` con
 * `primaryIdentity`/`trajectory` (no un passthrough puro: un consumidor
 * de Conversación no debería tener que releer `IdentitySnapshot`
 * completo solo para saber si la identidad está en transición ahora
 * mismo). Datos crudos únicamente -- nunca una frase, nunca una
 * decisión de qué decir (mismo límite que
 * `NarrativeConversationContext`). Ningún llamador real hoy.
 */
export function toIdentityConversationSignal(snapshot: IdentitySnapshot): IdentityConversationSignal {
  return {
    leadWithDomain: snapshot.conversationGuidance.leadWithDomain,
    leadWithTheme: snapshot.conversationGuidance.leadWithTheme,
    primaryLabel: snapshot.primaryIdentity?.label ?? null,
    worthAcknowledging: snapshot.conversationGuidance.worthAcknowledging,
    avoidDominating: snapshot.conversationGuidance.avoidDominating,
    isIdentityInTransition: snapshot.trajectory.state === "transitioning",
  };
}
