import { LIFE_DOMAIN_LABEL } from "../../../../core/life";
import type {
  ConversationRule,
  ConversationRuleInput,
} from "./conversation-rule";

/** `LIFE_DOMAIN_LABEL` no cubre `"general"` (no es un `LifeDomainType` real) -- único lugar de este archivo con una etiqueta escrita a mano. */
const GENERAL_LABEL = "conversación libre, sin un tema de vida puntual";

function domainLabel(domain: string): string {
  return domain === "general" ? GENERAL_LABEL : (LIFE_DOMAIN_LABEL[domain as keyof typeof LIFE_DOMAIN_LABEL] ?? domain);
}

/**
 * Conversational Variety V1 -- el usuario nunca debe sentir que LUZ
 * está obsesionada con un solo tema. Dispara sin importar qué
 * Conversation Strategy ganó el turno (a diferencia de las reglas de
 * esa capa, esta es un respaldo general, no atado a una postura
 * puntual) -- la respuesta directa a "el usuario nunca debe sentir
 * que LUZ está obsesionada con un tema" del pedido del founder. No
 * reemplaza Narrative ni Identity Evolution: nunca decide qué capítulo
 * está activo ni quién es la persona hoy, solo pide margen.
 */
export class AvoidTopicMonotonyRule implements ConversationRule {
  readonly id = "avoid-topic-monotony";

  applies(input: ConversationRuleInput): boolean {
    return Boolean(input.variety?.isMonotonous && input.variety.dominantDomain);
  }

  directive(input: ConversationRuleInput): string {
    const variety = input.variety;
    if (!variety?.dominantDomain) {
      return "";
    }

    const label = domainLabel(variety.dominantDomain);
    const sharePercent = Math.round(variety.dominantDomainShare * 100);

    return (
      `De las últimas ${variety.windowSize} conversaciones, ${sharePercent}% ` +
      `(racha reciente de ${variety.dominantDomainStreak} seguidas) ha sido sobre ${label}. ` +
      "No lo evites si la persona lo trae de nuevo -- eso sigue siendo lo que le importa ahora. " +
      "Pero si el mensaje de este turno no lo pide, no lo fuerces de vuelta ni lo uses como el ángulo por defecto -- dale espacio real a lo que traiga hoy."
    );
  }
}
