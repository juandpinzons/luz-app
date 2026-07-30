import { createEntityId, GOAL_STATUSES, PROJECT_STATUSES, type GoalStatus, type ProjectStatus } from "../../../core/life";
import type { FollowUpRecommendation } from "../../dashboard/services/build-follow-up-recommendations";
import type { DueLifeItem, LifeDashboardSnapshot } from "../../dashboard/services/build-life-dashboard-snapshot";
import type { LifeObservation } from "../../dashboard/services/build-life-observations";

/**
 * Datos sintéticos compartidos por `features/presence/tests/` y
 * `features/home/tests/` -- un solo lugar arma los 7 escenarios
 * pedidos (busy/calm/recovery/relationship/crisis/celebration/empty)
 * para que ambas capas se verifiquen sobre exactamente los mismos
 * datos de entrada, nunca dos copias que puedan divergir.
 */

export const NOW = new Date("2026-07-29T09:00:00-05:00");

function zeroGoalStatusCounts(): Record<GoalStatus, number> {
  return Object.fromEntries(GOAL_STATUSES.map((status) => [status, 0])) as Record<GoalStatus, number>;
}

function zeroProjectStatusCounts(): Record<ProjectStatus, number> {
  return Object.fromEntries(PROJECT_STATUSES.map((status) => [status, 0])) as Record<ProjectStatus, number>;
}

export interface Scenario {
  name: string;
  observations: LifeObservation[];
  recommendations: FollowUpRecommendation[];
  /**
   * Solo poblado en los escenarios donde importa demostrar la sección
   * "Upcoming" de `HomeState` con datos reales -- el resto queda en
   * `[]` a propósito. `domains`/`totals`/`relationships` se quedan
   * siempre en cero: ni Presence ni Home los calculan, son passthrough
   * puro del snapshot (`build-current-context.ts`), así que poblarlos
   * no ejercitaría ninguna lógica adicional, solo agregaría ruido.
   */
  upcoming?: DueLifeItem[];
}

/**
 * `buildPresenceState` hoy solo lee `snapshot.generatedAt`, y
 * `buildHomeState` además lee `domains`/`totals`/`relationships`/
 * `upcoming` -- el fixture respeta el contrato completo de
 * `LifeDashboardSnapshot` para que estos ejemplos sigan siendo válidos
 * si cualquiera de las dos capas empieza a leer más campos.
 */
export function buildSnapshot(scenario: Scenario): LifeDashboardSnapshot {
  return {
    generatedAt: NOW,
    domains: [],
    overdue: [],
    upcoming: scenario.upcoming ?? [],
    stalled: [],
    relationships: { total: 0, byType: {} },
    totals: {
      goalsByStatus: zeroGoalStatusCounts(),
      projectsByStatus: zeroProjectStatusCounts(),
      activeHabits: 0,
      inactiveHabits: 0,
    },
    observations: scenario.observations,
  };
}

// ---------------------------------------------------------------------------
// Busy day -- dos goals de "career" en riesgo, un cuarto recommendation de
// baja prioridad que demuestra el tope de 3 por sección.
// ---------------------------------------------------------------------------

const busyDayGoalOverdueId = createEntityId("goal-propuesta-acme");
const busyDayGoalStalledId = createEntityId("goal-onboarding");
const busyDayProjectId = createEntityId("project-migracion-bd");

export const busyDay: Scenario = {
  name: "busy work day",
  observations: [
    {
      type: "goal_at_risk",
      priority: "high",
      domain: "career",
      entities: [{ kind: "goal", id: busyDayGoalOverdueId, title: "Cerrar propuesta cliente Acme" }],
      evidence: { status: "active", daysSinceUpdate: 4, targetDate: new Date("2026-07-24"), daysOverdue: 5 },
      generatedAt: NOW,
      explanation: 'El objetivo "Cerrar propuesta cliente Acme" está activo y venció hace 5 días.',
    },
    {
      type: "goal_at_risk",
      priority: "medium",
      domain: "career",
      entities: [{ kind: "goal", id: busyDayGoalStalledId, title: "Rediseñar onboarding" }],
      evidence: { status: "active", daysSinceUpdate: 32 },
      generatedAt: NOW,
      explanation: 'El objetivo "Rediseñar onboarding" está activo y sin actualizarse hace 32 días.',
    },
  ],
  recommendations: [
    {
      id: `COMPLETE_OVERDUE:project:${busyDayProjectId}`,
      type: "COMPLETE_OVERDUE",
      priority: "critical",
      title: "Completar vencido",
      explanation:
        'Completar vencido: "Migración de base de datos" (2 señales) [dueDate=2026-07-24, daysSinceUpdate=32].',
      evidence: ["dueDate=2026-07-24", "daysSinceUpdate=32"],
      relatedEntities: [{ kind: "project", id: busyDayProjectId, title: "Migración de base de datos" }],
      suggestedAction: {
        kind: "update_status",
        targetEntity: { kind: "project", id: busyDayProjectId, title: "Migración de base de datos" },
        suggestedFields: ["status", "targetDate", "dueDate"],
      },
      confidence: 1,
    },
    {
      id: `GOAL_REVIEW:goal:${busyDayGoalOverdueId}`,
      type: "GOAL_REVIEW",
      priority: "high",
      title: "Revisar objetivo",
      explanation:
        'Revisar objetivo: "Cerrar propuesta cliente Acme" [status=active, daysSinceUpdate=4, daysOverdue=5].',
      evidence: ["status=active", "daysSinceUpdate=4", "daysOverdue=5"],
      relatedEntities: [{ kind: "goal", id: busyDayGoalOverdueId, title: "Cerrar propuesta cliente Acme" }],
      suggestedAction: {
        kind: "open_entity",
        targetEntity: { kind: "goal", id: busyDayGoalOverdueId, title: "Cerrar propuesta cliente Acme" },
        suggestedFields: ["status", "targetDate"],
      },
      confidence: 0.8,
    },
    {
      id: `GOAL_REVIEW:goal:${busyDayGoalStalledId}`,
      type: "GOAL_REVIEW",
      priority: "medium",
      title: "Revisar objetivo",
      explanation: 'Revisar objetivo: "Rediseñar onboarding" [status=active, daysSinceUpdate=32].',
      evidence: ["status=active", "daysSinceUpdate=32"],
      relatedEntities: [{ kind: "goal", id: busyDayGoalStalledId, title: "Rediseñar onboarding" }],
      suggestedAction: {
        kind: "open_entity",
        targetEntity: { kind: "goal", id: busyDayGoalStalledId, title: "Rediseñar onboarding" },
        suggestedFields: ["status", "targetDate"],
      },
      confidence: 0.8,
    },
    {
      id: "FOCUS_DOMAIN:domain:leisure",
      type: "FOCUS_DOMAIN",
      priority: "low",
      title: "Enfocar dominio",
      explanation: 'Enfocar dominio: "Ocio" [activeItems=0].',
      evidence: ["activeItems=0"],
      relatedEntities: [{ kind: "domain", domain: "leisure", title: "Ocio" }],
      suggestedAction: {
        kind: "open_entity",
        targetEntity: { kind: "domain", domain: "leisure", title: "Ocio" },
      },
      confidence: 0.85,
    },
  ],
  upcoming: [
    {
      kind: "goal",
      id: createEntityId("goal-revision-trimestral"),
      title: "Preparar revisión trimestral",
      domain: "career",
      dueDate: new Date(NOW.getTime() + 5 * 24 * 60 * 60 * 1000),
    },
  ],
};

// ---------------------------------------------------------------------------
// Calm / progress day -- un goal avanzando y un hábito consistente, dos
// CELEBRATE_PROGRESS, ninguna señal urgente.
// ---------------------------------------------------------------------------

const progressGoalId = createEntityId("goal-certificacion-aws");
const progressHabitId = createEntityId("habit-meditacion");

export const progressDay: Scenario = {
  name: "calm productive day",
  observations: [
    {
      type: "goal_progressing",
      priority: "low",
      domain: "career",
      entities: [{ kind: "goal", id: progressGoalId, title: "Certificación AWS" }],
      evidence: { status: "active", daysSinceUpdate: 2 },
      generatedAt: NOW,
      explanation: 'El objetivo "Certificación AWS" está activo y se actualizó hace 2 días, sin vencimiento superado.',
    },
    {
      type: "habit_consistent",
      priority: "low",
      domain: "health",
      entities: [{ kind: "habit", id: progressHabitId, title: "Meditar 10 minutos" }],
      evidence: { daysSinceUpdate: 1 },
      generatedAt: NOW,
      explanation: 'El hábito "Meditar 10 minutos" sigue activo y se actualizó hace 1 día.',
    },
  ],
  recommendations: [
    {
      id: `CELEBRATE_PROGRESS:goal:${progressGoalId}`,
      type: "CELEBRATE_PROGRESS",
      priority: "low",
      title: "Celebrar progreso",
      explanation: 'Celebrar progreso: "Certificación AWS" [status=active, daysSinceUpdate=2].',
      evidence: ["status=active", "daysSinceUpdate=2"],
      relatedEntities: [{ kind: "goal", id: progressGoalId, title: "Certificación AWS" }],
      suggestedAction: {
        kind: "acknowledge",
        targetEntity: { kind: "goal", id: progressGoalId, title: "Certificación AWS" },
      },
      confidence: 0.85,
    },
    {
      id: `CELEBRATE_PROGRESS:habit:${progressHabitId}`,
      type: "CELEBRATE_PROGRESS",
      priority: "low",
      title: "Celebrar progreso",
      explanation: 'Celebrar progreso: "Meditar 10 minutos" [daysSinceUpdate=1].',
      evidence: ["daysSinceUpdate=1"],
      relatedEntities: [{ kind: "habit", id: progressHabitId, title: "Meditar 10 minutos" }],
      suggestedAction: {
        kind: "acknowledge",
        targetEntity: { kind: "habit", id: progressHabitId, title: "Meditar 10 minutos" },
      },
      confidence: 0.85,
    },
  ],
};

// ---------------------------------------------------------------------------
// Recovery day -- un hábito abandonado y un dominio inactivo, urgencia
// media, ninguna celebración inventada.
// ---------------------------------------------------------------------------

const recoveryHabitId = createEntityId("habit-correr");

export const recoveryDay: Scenario = {
  name: "recovery day",
  observations: [
    {
      type: "habit_abandoned",
      priority: "medium",
      domain: "health",
      entities: [{ kind: "habit", id: recoveryHabitId, title: "Salir a correr" }],
      evidence: { daysSinceUpdate: 18 },
      generatedAt: NOW,
      explanation: 'El hábito "Salir a correr" está desactivado, actualizado por última vez hace 18 días.',
    },
    {
      type: "inactive_domain",
      priority: "medium",
      domain: "leisure",
      entities: [{ kind: "domain", domain: "leisure", title: "Ocio" }],
      evidence: { activeItems: 0, everHadActivity: true },
      generatedAt: NOW,
      explanation: "No hay ningún goal, project ni hábito activo en Ocio, aunque sí los hubo antes.",
    },
  ],
  recommendations: [
    {
      id: `HABIT_RESTART:habit:${recoveryHabitId}`,
      type: "HABIT_RESTART",
      priority: "medium",
      title: "Reiniciar hábito",
      explanation: 'Reiniciar hábito: "Salir a correr" [daysSinceUpdate=18].',
      evidence: ["daysSinceUpdate=18"],
      relatedEntities: [{ kind: "habit", id: recoveryHabitId, title: "Salir a correr" }],
      suggestedAction: {
        kind: "update_status",
        targetEntity: { kind: "habit", id: recoveryHabitId, title: "Salir a correr" },
        suggestedFields: ["active"],
      },
      confidence: 0.9,
    },
    {
      id: "FOCUS_DOMAIN:domain:leisure",
      type: "FOCUS_DOMAIN",
      priority: "medium",
      title: "Enfocar dominio",
      explanation: 'Enfocar dominio: "Ocio" [activeItems=0, everHadActivity=true].',
      evidence: ["activeItems=0", "everHadActivity=true"],
      relatedEntities: [{ kind: "domain", domain: "leisure", title: "Ocio" }],
      suggestedAction: {
        kind: "open_entity",
        targetEntity: { kind: "domain", domain: "leisure", title: "Ocio" },
      },
      confidence: 0.85,
    },
  ],
};

// ---------------------------------------------------------------------------
// Relationship day -- una relación descuidada (urgente) y una relación
// fuerte (para celebrar) al mismo tiempo.
// ---------------------------------------------------------------------------

const relationshipFriendId = createEntityId("person-camila");
const relationshipFriendLinkId = createEntityId("relationship-camila");
const relationshipMentorId = createEntityId("person-daniel");
const relationshipMentorLinkId = createEntityId("relationship-daniel");

export const relationshipDay: Scenario = {
  name: "relationship day",
  observations: [
    {
      type: "neglected_relationship",
      priority: "high",
      entities: [
        { kind: "person", id: relationshipFriendId, title: "Camila" },
        { kind: "relationship", id: relationshipFriendLinkId, title: "Amistad con Camila" },
      ],
      evidence: { daysSinceUpdate: 45, closeness: 85 },
      generatedAt: NOW,
      explanation: "La relación de Amistad con Camila no se actualiza hace 45 días.",
    },
    {
      type: "strong_relationship",
      priority: "low",
      entities: [
        { kind: "person", id: relationshipMentorId, title: "Daniel" },
        { kind: "relationship", id: relationshipMentorLinkId, title: "Mentoría con Daniel" },
      ],
      evidence: { closeness: 80 },
      generatedAt: NOW,
      explanation: "La relación de Mentoría con Daniel tiene una cercanía declarada de 80/100.",
    },
  ],
  recommendations: [
    {
      id: `RECONNECT_PERSON:person:${relationshipFriendId}`,
      type: "RECONNECT_PERSON",
      priority: "high",
      title: "Reconectar con persona",
      explanation: 'Reconectar con persona: "Camila" [daysSinceUpdate=45, closeness=85].',
      evidence: ["daysSinceUpdate=45", "closeness=85"],
      relatedEntities: [
        { kind: "person", id: relationshipFriendId, title: "Camila" },
        { kind: "relationship", id: relationshipFriendLinkId, title: "Amistad con Camila" },
      ],
      suggestedAction: {
        kind: "schedule_check_in",
        targetEntity: { kind: "person", id: relationshipFriendId, title: "Camila" },
      },
      confidence: 0.7,
    },
    {
      id: `CELEBRATE_PROGRESS:person:${relationshipMentorId}`,
      type: "CELEBRATE_PROGRESS",
      priority: "low",
      title: "Celebrar progreso",
      explanation: 'Celebrar progreso: "Daniel" [closeness=80].',
      evidence: ["closeness=80"],
      relatedEntities: [
        { kind: "person", id: relationshipMentorId, title: "Daniel" },
        { kind: "relationship", id: relationshipMentorLinkId, title: "Mentoría con Daniel" },
      ],
      suggestedAction: {
        kind: "acknowledge",
        targetEntity: { kind: "person", id: relationshipMentorId, title: "Daniel" },
      },
      confidence: 0.85,
    },
  ],
};

// ---------------------------------------------------------------------------
// Goal crisis -- una contradicción real (Goal cerrado con Project/Habit
// todavía activo bajo su goalId) más un Project vencido y estancado a la
// vez. Distinto de "busy day": aquí hay un hallazgo de integridad, no solo
// atraso.
// ---------------------------------------------------------------------------

const crisisGoalId = createEntityId("goal-lanzar-producto-v2");
const crisisProjectLinkedId = createEntityId("project-campana-lanzamiento");
const crisisHabitLinkedId = createEntityId("habit-demo-diaria");
const crisisOverdueGoalId = createEntityId("goal-renovar-iso");
const crisisOverdueProjectId = createEntityId("project-rediseno-sitio");

export const goalCrisis: Scenario = {
  name: "goal crisis",
  observations: [
    {
      type: "contradiction_detected",
      priority: "high",
      domain: "career",
      entities: [
        { kind: "goal", id: crisisGoalId, title: "Lanzar producto V2" },
        { kind: "project", id: crisisProjectLinkedId, title: "Campaña de lanzamiento" },
        { kind: "habit", id: crisisHabitLinkedId, title: "Preparar demo diaria" },
      ],
      evidence: { goalStatus: "abandoned", openLinkedItems: 2 },
      generatedAt: NOW,
      explanation:
        'El objetivo "Lanzar producto V2" está abandonado, pero tiene 2 elemento(s) vinculado(s) todavía activo(s): Campaña de lanzamiento, Preparar demo diaria.',
    },
    {
      type: "goal_at_risk",
      priority: "high",
      domain: "career",
      entities: [{ kind: "goal", id: crisisOverdueGoalId, title: "Renovar certificación ISO" }],
      evidence: { status: "active", daysSinceUpdate: 12, targetDate: new Date("2026-07-17"), daysOverdue: 12 },
      generatedAt: NOW,
      explanation: 'El objetivo "Renovar certificación ISO" está activo y venció hace 12 días.',
    },
  ],
  recommendations: [
    {
      id: `COMPLETE_OVERDUE:project:${crisisOverdueProjectId}`,
      type: "COMPLETE_OVERDUE",
      priority: "critical",
      title: "Completar vencido",
      explanation: 'Completar vencido: "Rediseño del sitio web" (2 señales) [dueDate=2026-07-23, daysSinceUpdate=35].',
      evidence: ["dueDate=2026-07-23", "daysSinceUpdate=35"],
      relatedEntities: [{ kind: "project", id: crisisOverdueProjectId, title: "Rediseño del sitio web" }],
      suggestedAction: {
        kind: "update_status",
        targetEntity: { kind: "project", id: crisisOverdueProjectId, title: "Rediseño del sitio web" },
        suggestedFields: ["status", "targetDate", "dueDate"],
      },
      confidence: 1,
    },
    {
      id: `REVIEW_CONTRADICTION:goal:${crisisGoalId}`,
      type: "REVIEW_CONTRADICTION",
      priority: "high",
      title: "Resolver contradicción",
      explanation:
        'Resolver contradicción: "Lanzar producto V2" [goalStatus=abandoned, openLinkedItems=2].',
      evidence: ["goalStatus=abandoned", "openLinkedItems=2"],
      relatedEntities: [
        { kind: "goal", id: crisisGoalId, title: "Lanzar producto V2" },
        { kind: "project", id: crisisProjectLinkedId, title: "Campaña de lanzamiento" },
        { kind: "habit", id: crisisHabitLinkedId, title: "Preparar demo diaria" },
      ],
      suggestedAction: {
        kind: "open_entity",
        targetEntity: { kind: "goal", id: crisisGoalId, title: "Lanzar producto V2" },
        suggestedFields: ["status"],
      },
      confidence: 0.95,
    },
    {
      id: `GOAL_REVIEW:goal:${crisisOverdueGoalId}`,
      type: "GOAL_REVIEW",
      priority: "high",
      title: "Revisar objetivo",
      explanation:
        'Revisar objetivo: "Renovar certificación ISO" [status=active, daysSinceUpdate=12, daysOverdue=12].',
      evidence: ["status=active", "daysSinceUpdate=12", "daysOverdue=12"],
      relatedEntities: [{ kind: "goal", id: crisisOverdueGoalId, title: "Renovar certificación ISO" }],
      suggestedAction: {
        kind: "open_entity",
        targetEntity: { kind: "goal", id: crisisOverdueGoalId, title: "Renovar certificación ISO" },
        suggestedFields: ["status", "targetDate"],
      },
      confidence: 0.8,
    },
  ],
};

// ---------------------------------------------------------------------------
// Celebration day -- cuatro CELEBRATE_PROGRESS (más que el tope de 3) para
// verificar que `recentProgress`/`encouragement` se recortan igual que
// `attentionNeeded`.
// ---------------------------------------------------------------------------

const celebrationGoalId = createEntityId("goal-aprender-frances");
const celebrationHabitWaterId = createEntityId("habit-tomar-agua");
const celebrationHabitReadId = createEntityId("habit-leer");
const celebrationPersonId = createEntityId("person-marta");
const celebrationRelationshipId = createEntityId("relationship-marta");

export const celebrationDay: Scenario = {
  name: "celebration day",
  observations: [
    {
      type: "goal_progressing",
      priority: "low",
      domain: "personal_growth",
      entities: [{ kind: "goal", id: celebrationGoalId, title: "Aprender francés" }],
      evidence: { status: "active", daysSinceUpdate: 1 },
      generatedAt: NOW,
      explanation: 'El objetivo "Aprender francés" está activo y se actualizó hace 1 día, sin vencimiento superado.',
    },
    {
      type: "habit_consistent",
      priority: "low",
      domain: "health",
      entities: [{ kind: "habit", id: celebrationHabitWaterId, title: "Tomar agua" }],
      evidence: { daysSinceUpdate: 1 },
      generatedAt: NOW,
      explanation: 'El hábito "Tomar agua" sigue activo y se actualizó hace 1 día.',
    },
    {
      type: "habit_consistent",
      priority: "low",
      domain: "personal_growth",
      entities: [{ kind: "habit", id: celebrationHabitReadId, title: "Leer 20 minutos" }],
      evidence: { daysSinceUpdate: 2 },
      generatedAt: NOW,
      explanation: 'El hábito "Leer 20 minutos" sigue activo y se actualizó hace 2 días.',
    },
    {
      type: "strong_relationship",
      priority: "low",
      entities: [
        { kind: "person", id: celebrationPersonId, title: "Marta" },
        { kind: "relationship", id: celebrationRelationshipId, title: "Amistad con Marta" },
      ],
      evidence: { closeness: 90 },
      generatedAt: NOW,
      explanation: "La relación de Amistad con Marta tiene una cercanía declarada de 90/100.",
    },
  ],
  recommendations: [
    {
      id: `CELEBRATE_PROGRESS:goal:${celebrationGoalId}`,
      type: "CELEBRATE_PROGRESS",
      priority: "low",
      title: "Celebrar progreso",
      explanation: 'Celebrar progreso: "Aprender francés" [status=active, daysSinceUpdate=1].',
      evidence: ["status=active", "daysSinceUpdate=1"],
      relatedEntities: [{ kind: "goal", id: celebrationGoalId, title: "Aprender francés" }],
      suggestedAction: {
        kind: "acknowledge",
        targetEntity: { kind: "goal", id: celebrationGoalId, title: "Aprender francés" },
      },
      confidence: 0.85,
    },
    {
      id: `CELEBRATE_PROGRESS:habit:${celebrationHabitWaterId}`,
      type: "CELEBRATE_PROGRESS",
      priority: "low",
      title: "Celebrar progreso",
      explanation: 'Celebrar progreso: "Tomar agua" [daysSinceUpdate=1].',
      evidence: ["daysSinceUpdate=1"],
      relatedEntities: [{ kind: "habit", id: celebrationHabitWaterId, title: "Tomar agua" }],
      suggestedAction: {
        kind: "acknowledge",
        targetEntity: { kind: "habit", id: celebrationHabitWaterId, title: "Tomar agua" },
      },
      confidence: 0.85,
    },
    {
      id: `CELEBRATE_PROGRESS:habit:${celebrationHabitReadId}`,
      type: "CELEBRATE_PROGRESS",
      priority: "low",
      title: "Celebrar progreso",
      explanation: 'Celebrar progreso: "Leer 20 minutos" [daysSinceUpdate=2].',
      evidence: ["daysSinceUpdate=2"],
      relatedEntities: [{ kind: "habit", id: celebrationHabitReadId, title: "Leer 20 minutos" }],
      suggestedAction: {
        kind: "acknowledge",
        targetEntity: { kind: "habit", id: celebrationHabitReadId, title: "Leer 20 minutos" },
      },
      confidence: 0.85,
    },
    {
      id: `CELEBRATE_PROGRESS:person:${celebrationPersonId}`,
      type: "CELEBRATE_PROGRESS",
      priority: "low",
      title: "Celebrar progreso",
      explanation: 'Celebrar progreso: "Marta" [closeness=90].',
      evidence: ["closeness=90"],
      relatedEntities: [
        { kind: "person", id: celebrationPersonId, title: "Marta" },
        { kind: "relationship", id: celebrationRelationshipId, title: "Amistad con Marta" },
      ],
      suggestedAction: {
        kind: "acknowledge",
        targetEntity: { kind: "person", id: celebrationPersonId, title: "Marta" },
      },
      confidence: 0.85,
    },
  ],
  upcoming: [
    {
      kind: "project",
      id: createEntityId("project-planear-viaje"),
      title: "Planear viaje de fin de año",
      domain: "leisure",
      dueDate: new Date(NOW.getTime() + 10 * 24 * 60 * 60 * 1000),
    },
  ],
};

// ---------------------------------------------------------------------------
// Empty account -- usuario nuevo, cero observaciones, cero recomendaciones.
// ---------------------------------------------------------------------------

export const emptyAccount: Scenario = {
  name: "empty account (new user)",
  observations: [],
  recommendations: [],
};

export const SCENARIOS: Scenario[] = [
  busyDay,
  progressDay,
  recoveryDay,
  relationshipDay,
  goalCrisis,
  celebrationDay,
  emptyAccount,
];
