import type { Database } from "../../../core/db/client";
import {
  DrizzleGoalRepository,
  DrizzleHabitRepository,
  DrizzleProjectRepository,
  DrizzleRelationshipRepository,
  GOAL_STATUSES,
  PROJECT_STATUSES,
  LIFE_DOMAIN_TYPES,
  type EntityId,
  type Goal,
  type GoalStatus,
  type Habit,
  type LifeDomainType,
  type LifeGraphContext,
  type Project,
  type ProjectStatus,
  type Relationship,
  type RelationshipType,
} from "../../../core/life";

/**
 * "¿Cuál es el estado actual de la vida de esta persona?" -- para el
 * Dashboard actual, únicamente (Founder, 2026-07-29: opción 1, no una
 * capa canónica para subsistemas futuros que todavía no existen). Vive
 * en `features/dashboard/`, no en `core/` -- no es un motor nuevo, es
 * un agregador de solo lectura sobre repositorios de `core/life` que
 * ya existen, mismo rol que `build-dashboard-summary.ts` (con el que
 * convive, nunca lo reemplaza). Cero tabla nueva, cero migración, cero
 * contrato de Memory/Knowledge/Context Engine ni de RealitySnapshot
 * tocado -- `core/life` ni siquiera es uno de esos engines.
 *
 * Deliberadamente NO se conecta todavía a ninguna página ni ruta
 * (mandato explícito: "solo el snapshot de backend, no la feature
 * todavía"). Este archivo es el punto de partida para un futuro bloque
 * de UI, no algo que ya esté en producción.
 *
 * Cada entidad (Goal/Project/Habit/Relationship) se trae con una sola
 * consulta (`repository.list(context)`), nunca una por cada
 * clasificación derivada -- evita exactamente el antipatrón de "triple
 * fetch" que esta misma auditoría encontró en `app/dashboard/page.tsx`.
 * Nunca se inventa un puntaje ni una interpretación: todo campo es un
 * conteo o una fecha trazable directamente a una fila real.
 */

const INACTIVE_GOAL_STATUSES = new Set<GoalStatus>(["completed", "abandoned"]);
const INACTIVE_PROJECT_STATUSES = new Set<ProjectStatus>(["completed", "cancelled"]);

/** Mismo criterio que `app/dashboard/page.tsx` (`UPCOMING_WINDOW_DAYS`) -- consistencia entre agregadores del mismo Dashboard. */
const UPCOMING_WINDOW_DAYS = 14;
/**
 * Un objetivo/proyecto/hábito activo sin ninguna actualización en más
 * de un mes es una señal honesta de "quedó en pausa silenciosa" -- no
 * una interpretación, `updatedAt` es un hecho de la fila. El umbral es
 * generoso a propósito: nunca marcar algo como "estancado" solo porque
 * la persona no volvió a tocarlo la semana siguiente de crearlo.
 */
const STALLED_THRESHOLD_DAYS = 30;

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

export type LifeItemKind = "goal" | "project" | "habit";

export interface LifeDomainSnapshot {
  domain: LifeDomainType;
  activeGoals: number;
  activeProjects: number;
  activeHabits: number;
}

export interface DueLifeItem {
  kind: "goal" | "project";
  id: EntityId;
  title: string;
  domain?: LifeDomainType;
  dueDate: Date;
}

export interface StalledLifeItem {
  kind: LifeItemKind;
  id: EntityId;
  title: string;
  domain?: LifeDomainType;
  daysSinceUpdate: number;
}

export interface RelationshipsSnapshot {
  total: number;
  byType: Partial<Record<RelationshipType, number>>;
}

export interface LifeTotals {
  goalsByStatus: Record<GoalStatus, number>;
  projectsByStatus: Record<ProjectStatus, number>;
  activeHabits: number;
  inactiveHabits: number;
}

export interface LifeDashboardSnapshot {
  generatedAt: Date;
  /** Una entrada por cada `LifeDomainType` -- incluye dominios sin ninguna actividad (todo en 0), nunca los omite: la ausencia real se representa como ausencia, mismo criterio que `RealitySnapshot`. */
  domains: LifeDomainSnapshot[];
  /** Goals/Projects activos cuya fecha ya pasó -- nunca incluye algo completado o cancelado, eso ya no es "vencido", está resuelto. */
  overdue: DueLifeItem[];
  /** Goals/Projects activos con fecha dentro de `UPCOMING_WINDOW_DAYS`. */
  upcoming: DueLifeItem[];
  /** Goals/Projects/Habits activos sin actualizar en más de `STALLED_THRESHOLD_DAYS`. */
  stalled: StalledLifeItem[];
  relationships: RelationshipsSnapshot;
  totals: LifeTotals;
}

function emptyGoalStatusRecord(): Record<GoalStatus, number> {
  return Object.fromEntries(GOAL_STATUSES.map((status) => [status, 0])) as Record<
    GoalStatus,
    number
  >;
}

function emptyProjectStatusRecord(): Record<ProjectStatus, number> {
  return Object.fromEntries(
    PROJECT_STATUSES.map((status) => [status, 0]),
  ) as Record<ProjectStatus, number>;
}

function buildDomainSnapshots(
  activeGoals: Goal[],
  activeProjects: Project[],
  activeHabits: Habit[],
): LifeDomainSnapshot[] {
  const byDomain = new Map<LifeDomainType, LifeDomainSnapshot>(
    LIFE_DOMAIN_TYPES.map((domain) => [
      domain,
      { domain, activeGoals: 0, activeProjects: 0, activeHabits: 0 },
    ]),
  );

  for (const goal of activeGoals) {
    if (!goal.domain) continue;
    byDomain.get(goal.domain)!.activeGoals += 1;
  }
  for (const project of activeProjects) {
    if (!project.domain) continue;
    byDomain.get(project.domain)!.activeProjects += 1;
  }
  for (const habit of activeHabits) {
    if (!habit.domain) continue;
    byDomain.get(habit.domain)!.activeHabits += 1;
  }

  return LIFE_DOMAIN_TYPES.map((domain) => byDomain.get(domain)!);
}

function buildDueItems(
  activeGoals: Goal[],
  activeProjects: Project[],
  now: Date,
): { overdue: DueLifeItem[]; upcoming: DueLifeItem[] } {
  const cutoff = new Date(now.getTime() + UPCOMING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const overdue: DueLifeItem[] = [];
  const upcoming: DueLifeItem[] = [];

  const consider = (kind: "goal" | "project", item: Goal | Project, dueDate?: Date) => {
    if (!dueDate) return;
    const entry: DueLifeItem = { kind, id: item.id, title: item.title, domain: item.domain, dueDate };
    if (dueDate.getTime() < now.getTime()) {
      overdue.push(entry);
    } else if (dueDate.getTime() <= cutoff.getTime()) {
      upcoming.push(entry);
    }
  };

  for (const goal of activeGoals) consider("goal", goal, goal.targetDate);
  for (const project of activeProjects) consider("project", project, project.dueDate);

  const byDueDateAsc = (a: DueLifeItem, b: DueLifeItem) => a.dueDate.getTime() - b.dueDate.getTime();
  overdue.sort(byDueDateAsc);
  upcoming.sort(byDueDateAsc);

  return { overdue, upcoming };
}

function buildStalledItems(
  activeGoals: Goal[],
  activeProjects: Project[],
  activeHabits: Habit[],
  now: Date,
): StalledLifeItem[] {
  const stalled: StalledLifeItem[] = [];

  const consider = (kind: LifeItemKind, item: Goal | Project | Habit) => {
    const daysSinceUpdate = daysBetween(item.updatedAt, now);
    if (daysSinceUpdate >= STALLED_THRESHOLD_DAYS) {
      stalled.push({ kind, id: item.id, title: item.title, domain: item.domain, daysSinceUpdate });
    }
  };

  for (const goal of activeGoals) consider("goal", goal);
  for (const project of activeProjects) consider("project", project);
  for (const habit of activeHabits) consider("habit", habit);

  return stalled.sort((a, b) => b.daysSinceUpdate - a.daysSinceUpdate);
}

function buildRelationshipsSnapshot(relationships: Relationship[]): RelationshipsSnapshot {
  const byType: Partial<Record<RelationshipType, number>> = {};
  for (const relationship of relationships) {
    byType[relationship.type] = (byType[relationship.type] ?? 0) + 1;
  }
  // Nunca un tipo en 0 inventado -- solo aparecen los tipos con al
  // menos una relación real, a diferencia de `domains` (donde SÍ
  // interesa ver los ocho "en 0" para notar el desbalance).
  return { total: relationships.length, byType };
}

function buildLifeTotals(
  goals: Goal[],
  projects: Project[],
  habits: Habit[],
): LifeTotals {
  const goalsByStatus = emptyGoalStatusRecord();
  for (const goal of goals) goalsByStatus[goal.status] += 1;

  const projectsByStatus = emptyProjectStatusRecord();
  for (const project of projects) projectsByStatus[project.status] += 1;

  let activeHabits = 0;
  let inactiveHabits = 0;
  for (const habit of habits) {
    if (habit.active) activeHabits += 1;
    else inactiveHabits += 1;
  }

  return { goalsByStatus, projectsByStatus, activeHabits, inactiveHabits };
}

/**
 * Una sola consulta por entidad (`list(context)`, ya existente en cada
 * repositorio de `core/life`) -- activos, vencidos, próximos,
 * estancados y totales por status se derivan todos de ese mismo
 * resultado, nunca de una segunda consulta filtrada.
 */
export async function buildLifeDashboardSnapshot(
  db: Database,
  context: LifeGraphContext,
): Promise<LifeDashboardSnapshot> {
  const now = new Date();

  const [goals, projects, habits, relationships] = await Promise.all([
    new DrizzleGoalRepository(db).list(context),
    new DrizzleProjectRepository(db).list(context),
    new DrizzleHabitRepository(db).list(context),
    new DrizzleRelationshipRepository(db).list(context),
  ]);

  const activeGoals = goals.filter((goal) => !INACTIVE_GOAL_STATUSES.has(goal.status));
  const activeProjects = projects.filter(
    (project) => !INACTIVE_PROJECT_STATUSES.has(project.status),
  );
  const activeHabits = habits.filter((habit) => habit.active);

  const { overdue, upcoming } = buildDueItems(activeGoals, activeProjects, now);

  return {
    generatedAt: now,
    domains: buildDomainSnapshots(activeGoals, activeProjects, activeHabits),
    overdue,
    upcoming,
    stalled: buildStalledItems(activeGoals, activeProjects, activeHabits, now),
    relationships: buildRelationshipsSnapshot(relationships),
    totals: buildLifeTotals(goals, projects, habits),
  };
}
