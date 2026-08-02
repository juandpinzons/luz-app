import type { ConversationCategory } from "../../../core/db/schema/conversations";

/**
 * Frecuencia real de un dominio (o `"general"`) dentro de la ventana
 * considerada. `daysSinceLastConversation` es `null` únicamente cuando
 * el dominio no aparece en la ventana -- ausencia real, nunca
 * `Infinity` ni un número inventado. Medido y expuesto, pero NO
 * gatilla `ConversationVarietySnapshot.isMonotonous` por sí solo en
 * V1 -- "reengancharse con un dominio descuidado" es del resorte de
 * Curiosity/Narrative, no de este módulo (ver README, "Esto NO es").
 */
export interface DomainFrequency {
  readonly domain: ConversationCategory;
  readonly count: number;
  /** 0-1. `count / windowSize`. */
  readonly shareOfWindow: number;
  readonly daysSinceLastConversation: number | null;
}

/**
 * Salida determinística única de Conversational Variety V1. Responde
 * "¿ha dominado un solo tema las conversaciones recientes?" -- nunca
 * "¿qué tan bien entendida está un área de vida?" (eso es
 * `core/knowledge-gaps`) ni "¿qué historia sigue abierta?" (eso es
 * `features/narrative`).
 */
export interface ConversationVarietySnapshot {
  readonly asOf: Date;
  /** Cuántas conversaciones con `category` real se consideraron -- puede ser menor que el tope pedido si la persona todavía no tiene tantas. */
  readonly windowSize: number;
  /**
   * 0-1: cuántos de los 9 valores posibles de `ConversationCategory`
   * (8 `LifeDomainType` + `"general"`) aparecieron al menos una vez en
   * la ventana, sobre el total posible. Ratio simple a propósito --
   * mismo idioma que `coverageScore`/`RealityFingerprint`, nunca
   * entropía de Shannon ni otra métrica información-teórica. Límite
   * conocido: no distingue "3 dominios repartidos parejo" de "3
   * dominios, uno con el 90%" -- esa distinción ya la cubre
   * `dominantDomain.shareOfWindow`/`isMonotonous` por separado, así
   * que nada se pierde manteniendo esto simple.
   */
  readonly diversityScore: number;
  /** Los dominios presentes en la ventana, orden descendente por `shareOfWindow`. Nunca incluye dominios ausentes -- a diferencia de `DomainCoverage` (`core/knowledge-gaps`), que sí lista las 8 siempre; aquí la ausencia real es la ausencia de la fila. */
  readonly frequencies: readonly DomainFrequency[];
  /** `frequencies[0]`, o `null` si la ventana está vacía. */
  readonly dominantDomain: DomainFrequency | null;
  /** Cuántas de las conversaciones MÁS RECIENTES, sin interrupción, comparten la categoría de la más reciente -- mismo algoritmo que `apply-rotation.ts` (`consecutiveStreak`), aplicado aquí a categoría-por-conversación en vez de tarjeta-por-día. */
  readonly dominantDomainStreak: number;
  /** `true` cuando el dominio dominante domina de verdad -- ver `services/compute-conversation-variety.ts` para las dos condiciones exactas. */
  readonly isMonotonous: boolean;
  /** = `dominantDomain` cuando `isMonotonous`, si no `null`. La respuesta concreta a "qué tema evitar reforzar ahora mismo". */
  readonly fatiguedDomain: DomainFrequency | null;
}
