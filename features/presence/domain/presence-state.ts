import type { LifeDomainType } from "../../../core/life";
import type { FollowUpRecommendation } from "../../dashboard/services/build-follow-up-recommendations";
import type { LifeObservationType, ObservationEntityRef, ObservationPriority } from "../../dashboard/services/build-life-observations";

/**
 * Misma escala que `RecommendationPriority`
 * (`build-follow-up-recommendations.ts`) -- la Capa de Presencia no
 * inventa una segunda noción de urgencia, solo resume la que ya existe.
 */
export const PRESENCE_URGENCY_LEVELS = ["low", "medium", "high", "critical"] as const;

export type PresenceUrgencyLevel = (typeof PRESENCE_URGENCY_LEVELS)[number];

/**
 * Proyección de una `LifeObservation` segura para un consumidor externo
 * (Home, y cualquier UI futura): mismo vocabulario (`type`/`priority`/
 * `domain`/`entities`) pero sin `evidence` (blob de depuración con
 * tipos mixtos, pensado para trazabilidad interna, no para mostrarse) ni
 * `generatedAt` (redundante -- `PresenceState.asOf` ya es el único
 * timestamp de referencia de todo el objeto).
 */
export interface PresenceFocusItem {
  /** Vocabulario completo de `LifeObservationType` -- Home lo necesita para elegir tono/ícono, no es un detalle interno. */
  type: LifeObservationType;
  priority: ObservationPriority;
  /** Ausente cuando la observación no pertenece a un `LifeDomainType` (p. ej. una relación). */
  domain?: LifeDomainType;
  /** Título de la entidad principal -- primer elemento de `entities`. Nunca vacío: toda observación hoy trae al menos una entidad. */
  title: string;
  /** Texto ya armado con template + evidencia, listo para mostrarse tal cual (nunca generado por IA). */
  explanation: string;
  /** Referencias mínimas (kind/id/title) para que un consumidor pueda enlazar de vuelta a la fila real -- puede tener más de un elemento (p. ej. una contradicción involucra Goal + Project/Habit). */
  entities: ObservationEntityRef[];
}

/**
 * Primer momento del día con LUZ, construido 100% a partir de datos ya
 * calculados aguas arriba (`LifeDashboardSnapshot`, `LifeObservation[]`,
 * `FollowUpRecommendation[]`) -- determinístico, sin IA, sin acceso a
 * repositorios ni base de datos. Ver `buildPresenceState`
 * (`application/build-presence-state.ts`).
 *
 * Contrato estable: este es el único objeto de Presencia que un
 * consumidor externo (Home) debe leer. Ningún campo expone una forma
 * interna de otro módulo que no esté ya pensada para consumo externo
 * (`FollowUpRecommendation` ya es el "modelo" público documentado de
 * `features/dashboard/`; `PresenceFocusItem` es la proyección
 * equivalente para observaciones, que no tenía una forma pública propia
 * todavía).
 */
export interface PresenceState {
  /** Momento en que se calculó este estado -- mismo valor que `snapshot.generatedAt`. Único timestamp de referencia para todo el objeto. */
  asOf: Date;

  /** Saludo determinístico según la hora del día en Bogotá. Nunca incluye el nombre de la persona: la Capa de Presencia no recibe datos de identidad. */
  greeting: string;

  /** La señal de mayor prioridad entre todas las observaciones, o `null` si no hay ninguna -- nunca se inventa una si no existe. */
  primaryFocus: PresenceFocusItem | null;

  /** La segunda señal en prioridad, o `null`. */
  secondaryFocus: PresenceFocusItem | null;

  /** Hasta 3 recomendaciones accionables (nunca `CELEBRATE_PROGRESS` ni `NO_ACTION`), ya ordenadas por prioridad y confianza -- listas para renderizar sin volver a ordenar ni filtrar. */
  attentionNeeded: FollowUpRecommendation[];

  /** Hasta 3 recomendaciones de tipo `CELEBRATE_PROGRESS` -- la misma fuente que ya usa `encouragement`, nunca una segunda lista independiente. */
  recentProgress: FollowUpRecommendation[];

  /** Frase de reconocimiento derivada 1:1 de `recentProgress` -- `null` cuando esa lista está vacía, nunca una frase genérica sin evidencia. */
  encouragement: string | null;

  /** Nivel de urgencia derivado únicamente de las recomendaciones accionables (las celebraciones nunca cuentan como urgencia, sin importar su `priority`). */
  urgency: PresenceUrgencyLevel;
}
