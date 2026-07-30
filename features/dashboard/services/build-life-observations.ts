import {
  LIFE_DOMAIN_LABEL,
  type EntityId,
  type Goal,
  type Habit,
  type LifeDomainType,
  type Person,
  type Project,
  type Relationship,
} from "../../../core/life";
import { GOAL_STATUS_LABELS, RELATIONSHIP_TYPE_LABELS } from "../../life/labels";
import {
  INACTIVE_GOAL_STATUSES,
  INACTIVE_PROJECT_STATUSES,
  STALLED_THRESHOLD_DAYS,
  daysBetween,
  type LifeDomainSnapshot,
} from "./build-life-dashboard-snapshot";

/**
 * Capa de observaciones de `buildLifeDashboardSnapshot` (evolución
 * 2026-07-29, mismo mandato: "opción 1", sin UI todavía). Cada
 * `LifeObservation` es una relectura de entidades que la propia
 * función ya trajo con una sola consulta -- nunca una fuente nueva,
 * nunca IA: el mismo criterio de `build-life-dashboard-snapshot.ts`
 * ("todo campo es un conteo o una fecha trazable directamente a una
 * fila real"), aplicado a un conjunto más rico de señales.
 *
 * `contradiction_detected` se queda deliberadamente adentro de
 * `core/life`: la señal real (Goal cerrado con Project/Habit todavía
 * activo bajo su `goalId`) ya es 100% observable con los datos que
 * este módulo ya tiene. No se toca `core/contradiction-engine` -- ese
 * motor es de M4, activo en paralelo (WAR_ROOM_AUDIT_2026-07-29.md).
 *
 * `overloaded_schedule` queda definido pero nunca se emite todavía:
 * `core/life` no modela ningún calendario real (`Routine` no tiene
 * horario ni duración, `LifeEvent` es histórico). Las señales de
 * "calendar" que sí existen viven en Context Engine/conectores, fuera
 * del límite que este archivo ya se impuso.
 */

export const LIFE_OBSERVATION_TYPES = [
  "goal_at_risk",
  "goal_progressing",
  "neglected_relationship",
  "strong_relationship",
  "habit_consistent",
  "habit_abandoned",
  "overloaded_schedule",
  "inactive_domain",
  "high_growth_domain",
  "contradiction_detected",
] as const;

export type LifeObservationType = (typeof LIFE_OBSERVATION_TYPES)[number];

export const OBSERVATION_PRIORITIES = ["low", "medium", "high"] as const;

export type ObservationPriority = (typeof OBSERVATION_PRIORITIES)[number];

/** Solo lo mínimo para que un futuro consumidor pueda enlazar de vuelta a la fila real -- nunca un objeto completo duplicado. */
export type ObservationEntityRef =
  | {
      kind: "goal" | "project" | "habit" | "person" | "relationship";
      id: EntityId;
      title: string;
    }
  | { kind: "domain"; domain: LifeDomainType; title: string };

/** Hechos concretos (conteos, fechas, valores de una fila real) -- nunca un puntaje inventado. */
export type ObservationEvidence = Record<string, string | number | boolean | Date>;

export interface LifeObservation {
  type: LifeObservationType;
  priority: ObservationPriority;
  /** Ausente cuando la observación no pertenece a un `LifeDomainType` (p. ej. una relación). */
  domain?: LifeDomainType;
  entities: ObservationEntityRef[];
  evidence: ObservationEvidence;
  generatedAt: Date;
  /** Texto armado con template + evidencia, siempre en español, nunca generado por un LLM. */
  explanation: string;
}

const PRIORITY_RANK: Record<ObservationPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

/** Mismo umbral que `strong_relationship` usa para calificar, reutilizado para decidir si una relación descuidada además era una que importaba. */
const STRONG_RELATIONSHIP_MIN_CLOSENESS = 70;

/** Ventana para "creado recientemente" -- coincide hoy con `STALLED_THRESHOLD_DAYS` (mismo horizonte de "un mes"), pero es una perilla de producto separada, no un alias. */
const GROWTH_WINDOW_DAYS = 30;
/** Dos o más ítems nuevos evita que un solo goal recién creado dispare "alto crecimiento" por accidente. */
const HIGH_GROWTH_MIN_NEW_ITEMS = 2;

function formatDays(days: number): string {
  return `${days} ${days === 1 ? "día" : "días"}`;
}

function buildGoalObservations(goals: Goal[], now: Date): LifeObservation[] {
  const observations: LifeObservation[] = [];

  for (const goal of goals) {
    // Completado/abandonado ya está resuelto -- no puede estar "en riesgo" ni "progresando".
    if (INACTIVE_GOAL_STATUSES.has(goal.status)) continue;

    const daysSinceUpdate = daysBetween(goal.updatedAt, now);
    const targetDate = goal.targetDate;
    const isOverdue = targetDate !== undefined && targetDate.getTime() < now.getTime();
    const isStalled = daysSinceUpdate >= STALLED_THRESHOLD_DAYS;
    const entities: ObservationEntityRef[] = [{ kind: "goal", id: goal.id, title: goal.title }];

    if (!isOverdue && !isStalled) {
      observations.push({
        type: "goal_progressing",
        priority: "low",
        domain: goal.domain,
        entities,
        evidence: { status: goal.status, daysSinceUpdate },
        generatedAt: now,
        explanation: `El objetivo "${goal.title}" está activo y se actualizó hace ${formatDays(daysSinceUpdate)}, sin vencimiento superado.`,
      });
      continue;
    }

    const evidence: ObservationEvidence = { status: goal.status, daysSinceUpdate };
    const reasons: string[] = [];
    if (isOverdue && targetDate) {
      const daysOverdue = daysBetween(targetDate, now);
      evidence.targetDate = targetDate;
      evidence.daysOverdue = daysOverdue;
      reasons.push(`venció hace ${formatDays(daysOverdue)}`);
    }
    if (isStalled) {
      reasons.push(`sin actualizarse hace ${formatDays(daysSinceUpdate)}`);
    }

    observations.push({
      type: "goal_at_risk",
      priority: isOverdue ? "high" : "medium",
      domain: goal.domain,
      entities,
      evidence,
      generatedAt: now,
      explanation: `El objetivo "${goal.title}" está activo y ${reasons.join(", ")}.`,
    });
  }

  return observations;
}

function buildHabitObservations(habits: Habit[], now: Date): LifeObservation[] {
  const observations: LifeObservation[] = [];

  for (const habit of habits) {
    const daysSinceUpdate = daysBetween(habit.updatedAt, now);
    const entities: ObservationEntityRef[] = [{ kind: "habit", id: habit.id, title: habit.title }];

    if (!habit.active) {
      observations.push({
        type: "habit_abandoned",
        // Recién desactivado (dentro del mismo umbral de "un mes") sigue siendo una señal accionable; más viejo que eso ya es historia asentada.
        priority: daysSinceUpdate <= STALLED_THRESHOLD_DAYS ? "medium" : "low",
        domain: habit.domain,
        entities,
        evidence: { daysSinceUpdate },
        generatedAt: now,
        explanation: `El hábito "${habit.title}" está desactivado, actualizado por última vez hace ${formatDays(daysSinceUpdate)}.`,
      });
      continue;
    }

    if (daysSinceUpdate < STALLED_THRESHOLD_DAYS) {
      observations.push({
        type: "habit_consistent",
        priority: "low",
        domain: habit.domain,
        entities,
        evidence: { daysSinceUpdate },
        generatedAt: now,
        explanation: `El hábito "${habit.title}" sigue activo y se actualizó hace ${formatDays(daysSinceUpdate)}.`,
      });
    }
    // Activo pero estancado (>= STALLED_THRESHOLD_DAYS) ya aparece en `stalled` -- no hay un tipo de observación dedicado para ese cruce todavía.
  }

  return observations;
}

/**
 * Sin `context.personId`, no hay forma de saber cuál extremo de la
 * relación es "la otra persona" -- en un LifeGraph compartido donde
 * ninguno de los dos lados es quien pidió el snapshot, se usa
 * `toPersonId` como referencia estable en vez de adivinar.
 */
function resolveOtherPersonId(relationship: Relationship, personId: EntityId): EntityId {
  if (relationship.fromPersonId === personId) return relationship.toPersonId;
  if (relationship.toPersonId === personId) return relationship.fromPersonId;
  return relationship.toPersonId;
}

function buildRelationshipObservations(
  relationships: Relationship[],
  personById: Map<EntityId, Person>,
  personId: EntityId,
  now: Date,
): LifeObservation[] {
  const observations: LifeObservation[] = [];

  for (const relationship of relationships) {
    const otherPersonId = resolveOtherPersonId(relationship, personId);
    const otherPersonName = personById.get(otherPersonId)?.name ?? "persona sin nombre registrado";
    const typeLabel = RELATIONSHIP_TYPE_LABELS[relationship.type];
    const entities: ObservationEntityRef[] = [
      { kind: "person", id: otherPersonId, title: otherPersonName },
      {
        kind: "relationship",
        id: relationship.id,
        title: `${typeLabel} con ${otherPersonName}`,
      },
    ];

    const { closeness } = relationship;
    const isMeaningfullyClose = closeness !== undefined && closeness >= STRONG_RELATIONSHIP_MIN_CLOSENESS;
    const daysSinceUpdate = daysBetween(relationship.updatedAt, now);

    if (daysSinceUpdate >= STALLED_THRESHOLD_DAYS) {
      const evidence: ObservationEvidence = { daysSinceUpdate };
      if (closeness !== undefined) evidence.closeness = closeness;

      observations.push({
        type: "neglected_relationship",
        priority: isMeaningfullyClose ? "high" : "medium",
        entities,
        evidence,
        generatedAt: now,
        explanation: `La relación de ${typeLabel} con ${otherPersonName} no se actualiza hace ${formatDays(daysSinceUpdate)}.`,
      });
    }

    if (closeness !== undefined && isMeaningfullyClose) {
      observations.push({
        type: "strong_relationship",
        priority: "low",
        entities,
        evidence: { closeness },
        generatedAt: now,
        explanation: `La relación de ${typeLabel} con ${otherPersonName} tiene una cercanía declarada de ${closeness}/100.`,
      });
    }
  }

  return observations;
}

/**
 * `core/life` no modela ningún calendario real todavía -- `Routine`
 * (patrón detectado) no tiene horario ni duración, y `LifeEvent` es
 * histórico (`occurredAt`), no una agenda futura. Las señales de
 * "calendar" que sí existen en el producto viven en
 * `core/reality`/conectores (Context Engine), fuera del límite que
 * `build-life-dashboard-snapshot.ts` ya se impuso ("cero contrato de
 * ... Context Engine tocado"). El tipo queda definido para cuando ese
 * dato exista dentro de `core/life`; hasta entonces esta función
 * nunca produce una observación.
 */
function buildScheduleObservations(): LifeObservation[] {
  return [];
}

function buildDomainObservations(
  domainSnapshots: LifeDomainSnapshot[],
  goals: Goal[],
  projects: Project[],
  habits: Habit[],
  now: Date,
): LifeObservation[] {
  const observations: LifeObservation[] = [];

  const totalItemsByDomain = new Map<LifeDomainType, number>();
  const recentItemsByDomain = new Map<LifeDomainType, ObservationEntityRef[]>();

  const account = (
    item: Goal | Project | Habit,
    kind: "goal" | "project" | "habit",
  ) => {
    if (!item.domain) return;
    totalItemsByDomain.set(item.domain, (totalItemsByDomain.get(item.domain) ?? 0) + 1);
    if (daysBetween(item.createdAt, now) <= GROWTH_WINDOW_DAYS) {
      const recent = recentItemsByDomain.get(item.domain) ?? [];
      recent.push({ kind, id: item.id, title: item.title });
      recentItemsByDomain.set(item.domain, recent);
    }
  };

  for (const goal of goals) account(goal, "goal");
  for (const project of projects) account(project, "project");
  for (const habit of habits) account(habit, "habit");

  for (const snapshot of domainSnapshots) {
    const activeTotal = snapshot.activeGoals + snapshot.activeProjects + snapshot.activeHabits;
    const domainRef: ObservationEntityRef = {
      kind: "domain",
      domain: snapshot.domain,
      title: LIFE_DOMAIN_LABEL[snapshot.domain],
    };

    if (activeTotal === 0) {
      const everHadActivity = (totalItemsByDomain.get(snapshot.domain) ?? 0) > 0;
      observations.push({
        type: "inactive_domain",
        // Tuvo algo antes y hoy nada: más notable que un área que nunca fue foco.
        priority: everHadActivity ? "medium" : "low",
        domain: snapshot.domain,
        entities: [domainRef],
        evidence: { activeItems: 0, everHadActivity },
        generatedAt: now,
        explanation: everHadActivity
          ? `No hay ningún goal, project ni hábito activo en ${LIFE_DOMAIN_LABEL[snapshot.domain]}, aunque sí los hubo antes.`
          : `Nunca hubo un goal, project ni hábito registrado en ${LIFE_DOMAIN_LABEL[snapshot.domain]}.`,
      });
    }

    const recentItems = recentItemsByDomain.get(snapshot.domain) ?? [];
    if (recentItems.length >= HIGH_GROWTH_MIN_NEW_ITEMS) {
      observations.push({
        type: "high_growth_domain",
        priority: "low",
        domain: snapshot.domain,
        entities: [domainRef, ...recentItems],
        evidence: { newItemsInWindow: recentItems.length, windowDays: GROWTH_WINDOW_DAYS },
        generatedAt: now,
        explanation: `Se registraron ${recentItems.length} elementos nuevos en ${LIFE_DOMAIN_LABEL[snapshot.domain]} en los últimos ${GROWTH_WINDOW_DAYS} días.`,
      });
    }
  }

  return observations;
}

/**
 * Única contradicción hoy detectable sin salir de `core/life`: un Goal
 * ya cerrado (completado/abandonado) con un Project u Habit que sigue
 * vinculado a él (`goalId`) y todavía activo -- la propia persona
 * declaró dos cosas incompatibles en sus datos. Un solo `Promise.all`
 * ya trajo todo lo necesario; agrupar por `goalId` es indexación en
 * memoria, no una segunda consulta.
 */
function buildContradictionObservations(
  goals: Goal[],
  projects: Project[],
  habits: Habit[],
  now: Date,
): LifeObservation[] {
  const openProjectsByGoalId = new Map<EntityId, Project[]>();
  for (const project of projects) {
    if (!project.goalId || INACTIVE_PROJECT_STATUSES.has(project.status)) continue;
    const list = openProjectsByGoalId.get(project.goalId) ?? [];
    list.push(project);
    openProjectsByGoalId.set(project.goalId, list);
  }

  const activeHabitsByGoalId = new Map<EntityId, Habit[]>();
  for (const habit of habits) {
    if (!habit.goalId || !habit.active) continue;
    const list = activeHabitsByGoalId.get(habit.goalId) ?? [];
    list.push(habit);
    activeHabitsByGoalId.set(habit.goalId, list);
  }

  const observations: LifeObservation[] = [];

  for (const goal of goals) {
    if (!INACTIVE_GOAL_STATUSES.has(goal.status)) continue;

    const conflictingProjects = openProjectsByGoalId.get(goal.id) ?? [];
    const conflictingHabits = activeHabitsByGoalId.get(goal.id) ?? [];
    if (conflictingProjects.length === 0 && conflictingHabits.length === 0) continue;

    const linkedTitles = [
      ...conflictingProjects.map((project) => project.title),
      ...conflictingHabits.map((habit) => habit.title),
    ];

    observations.push({
      type: "contradiction_detected",
      priority: "high",
      domain: goal.domain,
      entities: [
        { kind: "goal", id: goal.id, title: goal.title },
        ...conflictingProjects.map(
          (project): ObservationEntityRef => ({ kind: "project", id: project.id, title: project.title }),
        ),
        ...conflictingHabits.map(
          (habit): ObservationEntityRef => ({ kind: "habit", id: habit.id, title: habit.title }),
        ),
      ],
      evidence: { goalStatus: goal.status, openLinkedItems: linkedTitles.length },
      generatedAt: now,
      explanation: `El objetivo "${goal.title}" está ${GOAL_STATUS_LABELS[goal.status]}, pero tiene ${linkedTitles.length} elemento(s) vinculado(s) todavía activo(s): ${linkedTitles.join(", ")}.`,
    });
  }

  return observations;
}

export interface BuildLifeObservationsInput {
  now: Date;
  personId: EntityId;
  goals: Goal[];
  projects: Project[];
  habits: Habit[];
  relationships: Relationship[];
  persons: Person[];
  domains: LifeDomainSnapshot[];
}

export function buildLifeObservations(input: BuildLifeObservationsInput): LifeObservation[] {
  const { now, personId, goals, projects, habits, relationships, persons, domains } = input;
  const personById = new Map(persons.map((person) => [person.id, person] as const));

  const observations = [
    ...buildGoalObservations(goals, now),
    ...buildHabitObservations(habits, now),
    ...buildRelationshipObservations(relationships, personById, personId, now),
    ...buildScheduleObservations(),
    ...buildDomainObservations(domains, goals, projects, habits, now),
    ...buildContradictionObservations(goals, projects, habits, now),
  ];

  return observations.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
}
