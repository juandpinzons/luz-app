import type { DashboardAction } from "../../dashboard/services/build-follow-up-recommendations";
import type { PresenceUrgencyLevel } from "../../presence/domain/presence-state";

/**
 * Categorías de tarjeta candidata -- una por cada fuente que Home ya
 * compone (`HomeState`). Ningún tipo nuevo de decisión: cada categoría
 * es una proyección de un campo que `HomeState` ya expone. La línea de
 * continuidad de `buildMorningBrief` (IA) queda fuera a propósito --
 * ver `collect-candidates.ts`.
 */
export const EXPERIENCE_CARD_CATEGORIES = [
  "focus",
  "attention",
  "celebration",
  "calendar_moment",
  "upcoming_deadline",
] as const;

export type ExperienceCardCategory = (typeof EXPERIENCE_CARD_CATEGORIES)[number];

/**
 * Una candidata a ser LA experiencia primaria del día. `key` es la
 * identidad estable entre renders/días (p. ej. `attention:${id}`) --
 * nunca se muestra, solo la usa la rotación (`apply-rotation.ts`) para
 * saber si esta MISMA tarjeta ya ganó antes. `importance` ya incluye
 * cualquier modificador de calendario (Fase 4, `score-candidates.ts`);
 * quien arma la UI nunca vuelve a puntuar nada.
 */
export interface ExperienceCard {
  key: string;
  category: ExperienceCardCategory;
  title: string;
  detail: string;
  /** Escala 0-4, determinística. Ver `score-candidates.ts` para cómo se calcula cada categoría. */
  importance: number;
  action?: DashboardAction;
}

/**
 * Resultado de la arbitración (Fases 1-5 de "Experience Intelligence
 * V1"): de todo lo que Presence/Calendar/Dashboard ya decidieron,
 * cuál ES la experiencia de hoy. Determinístico de punta a punta --
 * mismas entradas (`HomeState`, línea de continuidad, historial de
 * qué se mostró antes) siempre producen el mismo `ExperienceState`.
 * Sin IA, sin aleatoriedad: ver `apply-rotation.ts`.
 */
export interface ExperienceState {
  /** Mismo valor que `HomeState.asOf`. */
  asOf: Date;

  /** La única tarjeta que Home debe liderar hoy -- `null` solo cuando no hay ninguna candidata real (cuenta vacía, día vacío, sin foco ni progreso ni calendario). Nunca se fabrica una para llenar el espacio. */
  primary: ExperienceCard | null;

  /** Hasta `MAX_SECONDARY_CARDS` candidatas reales que no ganaron hoy -- apoyan a `primary`, nunca compiten con ella por atención. */
  secondary: ExperienceCard[];

  /** Candidatas que habrían ganado por importancia pero perdieron solo por cooldown (ya fueron primarias demasiados días seguidos) -- nunca se pierden, solo se posponen. Ver "Fase 3: Rotación" en el README. */
  postponed: ExperienceCard[];

  /**
   * Lo que Presence debe transmitir (Fase 5: "Presence decide el tono,
   * Experience Intelligence decide la atención"). Deriva de la
   * categoría/importancia de `primary`, nunca de `presence.urgency`
   * de forma independiente -- evita que las dos capas tomen la misma
   * decisión dos veces y puedan contradecirse.
   */
  tone: PresenceUrgencyLevel;

  /** `true` cuando `primary.key` es distinto de la última tarjeta primaria registrada -- "qué cambió desde la última visita" (Fase 1). `true` también en la primera visita (no hay historial). */
  isNewPrimary: boolean;
}
