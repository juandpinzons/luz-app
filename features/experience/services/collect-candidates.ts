import type { DueLifeItem } from "../../dashboard/services/build-life-dashboard-snapshot";
import type { ObservationEntityRef } from "../../dashboard/services/build-life-observations";
import type { FollowUpRecommendation } from "../../dashboard/services/build-follow-up-recommendations";
import type { HomeMeetingMoment, HomeMeetingMomentKind, HomeState } from "../../home/domain/home-state";
import type { PresenceFocusItem } from "../../presence/domain/presence-state";
import type { ExperienceCard } from "../domain/experience-state";

/**
 * Identidad estable de una `ObservationEntityRef` -- lo que la rotación
 * (`apply-rotation.ts`) usa para reconocer "esta MISMA tarjeta" entre
 * días, nunca el slot en el que cayó (`primary`/`secondary`). Sin esto,
 * "el problema A fue foco ayer, hoy es el problema B" se leería
 * incorrectamente como "la misma tarjeta otra vez" solo porque ambos
 * ocuparon el mismo slot -- exactamente el bug que la rotación existe
 * para evitar.
 */
function entityKey(ref: ObservationEntityRef): string {
  return ref.kind === "domain" ? `domain:${ref.domain}` : `${ref.kind}:${ref.id}`;
}

const OBSERVATION_PRIORITY_IMPORTANCE: Record<PresenceFocusItem["priority"], number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/** Candidata más su identidad de entidad real (para deduplicar entre categorías) -- nunca se expone fuera de este archivo, `ExperienceCard.key` (con prefijo de categoría) es lo único que ve el resto de `features/experience/`. */
interface CandidateWithEntity {
  card: ExperienceCard;
  entityKey: string | null;
}

function focusCandidate(item: PresenceFocusItem | null): CandidateWithEntity | null {
  if (!item) return null;
  const entity = entityKey(item.entities[0]);
  return {
    entityKey: entity,
    card: {
      key: `focus:${entity}`,
      category: "focus",
      title: item.title,
      detail: item.explanation,
      importance: OBSERVATION_PRIORITY_IMPORTANCE[item.priority] ?? 1,
    },
  };
}

const RECOMMENDATION_PRIORITY_IMPORTANCE: Record<FollowUpRecommendation["priority"], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/** `relatedEntities[0]` -- mismo criterio que `buildAction` (`build-follow-up-recommendations.ts`) ya usa para `targetEntity`: la entidad principal de la recomendación. Ausente solo en un caso que hoy no ocurre (ver `DashboardAction.targetEntity`); si llegara a faltar, la recomendación simplemente nunca deduplica contra `focus`/`upcoming_deadline`, nunca revienta. */
function recommendationEntityKey(recommendation: FollowUpRecommendation): string | null {
  const primary = recommendation.relatedEntities[0];
  return primary ? entityKey(primary) : null;
}

function attentionCandidates(items: FollowUpRecommendation[]): CandidateWithEntity[] {
  return items.map((recommendation) => ({
    entityKey: recommendationEntityKey(recommendation),
    card: {
      key: `attention:${recommendation.id}`,
      category: "attention",
      title: recommendation.title,
      detail: recommendation.explanation,
      importance: RECOMMENDATION_PRIORITY_IMPORTANCE[recommendation.priority] ?? 1,
      action: recommendation.suggestedAction,
    },
  }));
}

/**
 * Las celebraciones nunca cargan urgencia propia (mismo criterio que
 * `computeUrgency` en Presence: "las celebraciones nunca cuentan") --
 * importancia fija y baja, para que solo ganen `primary` en un día
 * genuinamente tranquilo, nunca por encima de algo accionable real.
 */
const CELEBRATION_IMPORTANCE = 1;

function celebrationCandidates(
  items: FollowUpRecommendation[],
  encouragement: string | null,
): CandidateWithEntity[] {
  return items.map((recommendation) => ({
    entityKey: recommendationEntityKey(recommendation),
    card: {
      key: `celebration:${recommendation.id}`,
      category: "celebration",
      title: recommendation.title,
      detail: encouragement ?? recommendation.explanation,
      importance: CELEBRATION_IMPORTANCE,
      action: recommendation.suggestedAction,
    },
  }));
}

const MEETING_MOMENT_IMPORTANCE: Record<HomeMeetingMomentKind, number> = {
  in_progress: 4,
  starting_soon: 3,
  recently_ended: 1,
};

const MEETING_MOMENT_DETAIL: Record<HomeMeetingMomentKind, string> = {
  in_progress: "En curso ahora mismo.",
  starting_soon: "Empieza en menos de 30 minutos.",
  recently_ended: "Terminó hace poco -- buen momento para un seguimiento.",
};

function calendarMomentCandidates(moments: readonly HomeMeetingMoment[]): CandidateWithEntity[] {
  return moments.map((moment) => ({
    // Los eventos de calendario no son entidades del Life Graph -- nunca compiten por deduplicación con `focus`/`attention`/`upcoming_deadline`.
    entityKey: null,
    card: {
      key: `calendar:${moment.event.id}`,
      category: "calendar_moment",
      title: moment.event.title,
      detail: MEETING_MOMENT_DETAIL[moment.kind],
      importance: MEETING_MOMENT_IMPORTANCE[moment.kind],
    },
  }));
}

/** Mismo umbral que ya usa el resto de LUZ para "vence pronto" (ver `UPCOMING_WINDOW_DAYS` en `build-life-dashboard-snapshot.ts` para la ventana completa de 14 días -- esto es un umbral más corto, solo para decidir importancia relativa dentro de esa ventana). */
const DUE_VERY_SOON_DAYS = 1;
const DUE_SOON_DAYS = 3;

function upcomingDeadlineCandidates(items: DueLifeItem[], now: Date): CandidateWithEntity[] {
  return items.map((item) => {
    const daysUntil = Math.ceil((item.dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    const importance = daysUntil <= DUE_VERY_SOON_DAYS ? 3 : daysUntil <= DUE_SOON_DAYS ? 2 : 1;
    const kindLabel = item.kind === "goal" ? "Objetivo" : "Proyecto";
    const dayLabel = daysUntil <= 0 ? "hoy" : daysUntil === 1 ? "en 1 día" : `en ${daysUntil} días`;

    // Mismo formato que `entityKey()` produce para refs `goal`/`project` (`${kind}:${id}`) -- un Goal/Project que ya es `focus`/`attention` por otra razón nunca se muestra dos veces.
    return {
      entityKey: `${item.kind}:${item.id}`,
      card: {
        key: `deadline:${item.kind}:${item.id}`,
        category: "upcoming_deadline",
        title: item.title,
        detail: `${kindLabel} "${item.title}" vence ${dayLabel}.`,
        importance,
      },
    };
  });
}

/**
 * Cuando dos candidatas de categorías distintas apuntan a la MISMA
 * entidad real (p. ej. un Goal estancado que es a la vez `focus`, por
 * la observación, y `attention`, por la recomendación derivada de esa
 * observación), mostrar ambas sería exactamente la "lógica de ranking
 * duplicada"/"decisión duplicada" que esta misión y la de Presence ya
 * piden evitar. Se queda la de la categoría más rica (con acción
 * sugerida lista para un botón), nunca las dos.
 */
const ENTITY_DEDUPE_PRIORITY: Record<string, number> = {
  attention: 0,
  focus: 1,
  upcoming_deadline: 2,
  celebration: 3,
};

function dedupeByEntity(candidates: CandidateWithEntity[]): ExperienceCard[] {
  const winnerByEntity = new Map<string, CandidateWithEntity>();
  const withoutEntity: ExperienceCard[] = [];

  for (const candidate of candidates) {
    if (!candidate.entityKey) {
      withoutEntity.push(candidate.card);
      continue;
    }

    const current = winnerByEntity.get(candidate.entityKey);
    if (!current || ENTITY_DEDUPE_PRIORITY[candidate.card.category] < ENTITY_DEDUPE_PRIORITY[current.card.category]) {
      winnerByEntity.set(candidate.entityKey, candidate);
    }
  }

  return [...[...winnerByEntity.values()].map((c) => c.card), ...withoutEntity];
}

/**
 * Convierte lo que `HomeState` ya decidió en candidatas a experiencia
 * primaria -- ninguna consulta nueva, ningún ranking todavía (eso es
 * `score-candidates.ts` + `apply-rotation.ts`). Cada candidata es una
 * proyección 1:1 de algo que otro módulo ya calculó, mismo principio
 * que ya sigue `buildHomeState` con Presence/Calendar Foundation.
 *
 * La línea de continuidad de `buildMorningBrief` (IA) queda fuera a
 * propósito: sigue siendo "la voz de LUZ dirigiéndose a la persona",
 * no un dato sobre su vida (ver `features/home/README.md`, "Por qué
 * Presence y Dashboard no se tocaron") -- meterla a competir aquí
 * arriesgaba mostrarla dos veces (una como bloque de apertura, otra
 * como `primary`) sin ganar nada real a cambio.
 */
export function collectExperienceCandidates(homeState: HomeState): ExperienceCard[] {
  const candidates: CandidateWithEntity[] = [];

  const primaryFocus = focusCandidate(homeState.currentFocus.primary);
  if (primaryFocus) candidates.push(primaryFocus);

  const secondaryFocus = focusCandidate(homeState.currentFocus.secondary);
  if (secondaryFocus) candidates.push(secondaryFocus);

  candidates.push(...attentionCandidates(homeState.attentionNeeded));
  candidates.push(
    ...celebrationCandidates(homeState.recentProgress.items, homeState.recentProgress.encouragement),
  );

  if (homeState.calendar) {
    candidates.push(...calendarMomentCandidates(homeState.calendar.meetingMoments));
  }

  candidates.push(...upcomingDeadlineCandidates(homeState.upcoming, homeState.asOf));

  return dedupeByEntity(candidates);
}
