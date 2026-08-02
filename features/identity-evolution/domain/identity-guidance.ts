import type { LifeDomainType } from "../../../core/life/value-objects/life-domain-type";
import type { EntityId } from "../../../core/life/value-objects/entity-id";

/**
 * Las cuatro salidas de "guía" que pide la misión -- cada una es una
 * proyección DERIVADA de `IdentitySnapshot` (nunca una segunda decisión
 * independiente, mismo criterio anti-duplicación que el resto del
 * repo), pensada para que un futuro consumidor real
 * (`core/conversation-strategy-engine`, `features/narrative`,
 * `features/presence`, `features/experience`) sepa qué hacer sin tener
 * que releer `dimensions`/`themes` y reimplementar el ranking. Datos
 * crudos únicamente -- nunca una frase lista, nunca una decisión de qué
 * decir (mismo límite que `NarrativeConversationContext`).
 */

/** Qué debería liderar y qué NO debería dominar la próxima conversación. */
export interface ConversationGuidance {
  readonly leadWithDomain: LifeDomainType | null;
  /** `themeKey` (`Concept.id`) del tema con el que más vale abrir, o `null`. */
  readonly leadWithTheme: EntityId | null;
  /** Dimensiones/temas `emerging`/`renewing` -- reales, recientes, vale la pena reconocer que están ahí. */
  readonly worthAcknowledging: readonly string[];
  /**
   * Dimensiones/temas históricamente fuertes (`peakWeight` alto) que ya
   * están `dormant`/`declining` -- el corazón de la misión: LUZ no debe
   * dejar que un capítulo viejo (ej. una recuperación ya resuelta)
   * secuestre una conversación que hoy es sobre otra cosa.
   */
  readonly avoidDominating: readonly string[];
}

/** Qué temas merecen seguir tejiéndose como historia activa, y cuáles ya son pasado. */
export interface NarrativeGuidance {
  readonly primaryThemeKey: EntityId | null;
  /** `stable`, con buen `timeSpreadWeeks` -- temas recurrentes, evidencia real de que esto se repite en el tiempo. */
  readonly recurringThemeKeys: readonly string[];
  /** `dormant` -- capítulos que ya se resolvieron o dejaron de ser el centro, sin dejar de haber existido. */
  readonly resolvedChapterKeys: readonly string[];
}

/** En qué área de vida enfocar el primer momento del día, y cuáles bajar de tono. */
export interface PresenceGuidance {
  readonly suggestedFocusDomain: LifeDomainType | null;
  readonly deemphasizeDomains: readonly LifeDomainType[];
}

/** Qué tema destacar como "lo que define hoy", y cuáles retirar de rotación. */
export interface ExperienceGuidance {
  readonly spotlightThemeKey: EntityId | null;
  readonly retireThemeKeys: readonly string[];
}
