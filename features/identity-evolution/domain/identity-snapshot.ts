import type { EntityId } from "../../../core/life/value-objects/entity-id";
import type {
  ConversationGuidance,
  ExperienceGuidance,
  NarrativeGuidance,
  PresenceGuidance,
} from "./identity-guidance";
import type { IdentityConfidence } from "./identity-confidence";
import type { IdentityDimension } from "./identity-dimension";
import type { IdentityMomentum } from "./identity-momentum";
import type { IdentityShift } from "./identity-shift";
import type { IdentityTheme } from "./identity-theme";
import type { IdentityTrajectory } from "./identity-trajectory";

/**
 * Referencia ligera a un `IdentityDimension` o `IdentityTheme` ya
 * clasificado -- usada en todas las listas rankeadas de
 * `IdentitySnapshot` para que un consumidor no tenga que cargar el
 * objeto completo (con `representation`/`confidence`/etc.) solo para
 * saber "cuáles son los 3 temas en declive". El objeto completo sigue
 * disponible en `dimensions`/`themes` por `key`.
 */
export interface IdentityRankedUnitRef {
  readonly unitKind: "dimension" | "theme";
  /** `LifeDomainType` para dimensiones, `themeKey` (`Concept.id`) para temas. */
  readonly key: string;
  readonly label: string;
  readonly weight: number;
  readonly momentum: IdentityMomentum;
}

/**
 * Salida determinística única de la capa de Evolución de Identidad.
 * Responde la pregunta que le da nombre a la misión: **no "qué le pasó
 * a esta persona", sino "quién es esta persona HOY"** -- un agregado de
 * evidencia de largo plazo (`lookbackDays`), nunca la conversación más
 * reciente, nunca un conteo de menciones.
 *
 * Nunca se persiste como estado propio -- se recalcula en cada consulta
 * a partir de `Belief`/`BeliefHistoryEntry`/`Concept`/`ConceptEvidence`
 * ya guardados (mismo principio que `RealitySnapshot`: la fuente de
 * verdad sigue siendo la evidencia subyacente, esto es una vista).
 * `capturedAt`/`asOf` documenta que es una lectura puntual.
 */
export interface IdentitySnapshot {
  readonly lifeGraphId: EntityId;
  readonly personId: EntityId;
  readonly asOf: Date;

  /** Cuántos días atrás llega la evidencia considerada -- evidencia más vieja que esto no aporta a `weight` (pero la fila original en `core/belief-engine`/`core/concept-graph` nunca se toca ni se borra). */
  readonly lookbackDays: number;
  /** Ventana usada para `delta`/`momentum`/`IdentityShift` -- "cambio reciente" se mide sobre esto, nunca sobre un solo mensaje. */
  readonly comparisonWindowDays: number;

  /** Las 8 áreas de vida, siempre las 8, incluso en `weight: 0`. */
  readonly dimensions: readonly IdentityDimension[];
  /** Un elemento por cada `Concept` con evidencia real dentro de `lookbackDays`. Nunca se elimina uno ya presente en una consulta anterior mientras el `Concept` siga existiendo. */
  readonly themes: readonly IdentityTheme[];

  /** El `IdentityDimension`/`IdentityTheme` de mayor `weight` por encima del umbral mínimo de presencia, o `null` si ninguno lo cruza todavía (nunca se fabrica uno). */
  readonly primaryIdentity: IdentityRankedUnitRef | null;
  readonly secondaryIdentity: IdentityRankedUnitRef | null;

  /** `momentum` en `emerging` o `renewing`, cualquier grano, ordenado por `weight`. */
  readonly emergingThemes: readonly IdentityRankedUnitRef[];
  /** `momentum === "declining"`. */
  readonly decliningThemes: readonly IdentityRankedUnitRef[];
  /** `momentum === "stable"` y `weight` por encima del umbral mínimo de presencia -- identidad sostenida, no ausencia sostenida. */
  readonly stableThemes: readonly IdentityRankedUnitRef[];
  /** `momentum === "dormant"` -- capítulos reales que ya se resolvieron o dejaron de ser el centro. La evidencia detrás de cada uno sigue intacta; esto nunca es un DELETE. */
  readonly resolvedChapters: readonly IdentityRankedUnitRef[];
  /** Unión de `decliningThemes` + `resolvedChapters` cuyo `peakWeight` fue alguna vez significativo -- la respuesta directa a "cosas que ya no deberían dominar la conversación". Fuente única para `ConversationGuidance.avoidDominating`. */
  readonly deemphasized: readonly IdentityRankedUnitRef[];

  /** Cambios reales detectados en esta consulta -- ver `IdentityShift`. Vacío cuando nada cruzó de un `momentum` a otro dentro de `comparisonWindowDays`. */
  readonly recentShifts: readonly IdentityShift[];
  /** Hacia dónde se mueve la identidad completa -- ver `IdentityTrajectory`. */
  readonly trajectory: IdentityTrajectory;
  /** Confianza agregada de todo el snapshot -- baja en una cuenta nueva, sube con evidencia real repartida en el tiempo. */
  readonly overallConfidence: IdentityConfidence;

  readonly conversationGuidance: ConversationGuidance;
  readonly narrativeGuidance: NarrativeGuidance;
  readonly presenceGuidance: PresenceGuidance;
  readonly experienceGuidance: ExperienceGuidance;
}
