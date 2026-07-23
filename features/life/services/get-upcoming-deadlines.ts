import type { Database } from "../../../core/db/client";
import {
  listActiveGoals,
  listActiveProjects,
  type EntityId,
  type LifeGraphContext,
} from "../../../core/life";

export interface UpcomingDeadline {
  id: EntityId;
  title: string;
  kind: "goal" | "project";
  dueAt: Date;
}

/**
 * Goal/Project activos con `targetDate`/`dueDate` dentro de la ventana
 * dada — dato estructurado real (docs/product/ALPHA_EXPERIENCE_V1_DESIGN.md
 * §3.1, nota (d)), nunca una heurística de texto. Solo fechas futuras
 * dentro de la ventana; vencidas no se muestran aquí (fuera de alcance
 * del Sprint 2, no un olvido).
 */
export async function getUpcomingDeadlines(
  db: Database,
  context: LifeGraphContext,
  options: { withinDays: number },
): Promise<UpcomingDeadline[]> {
  const now = new Date();
  const cutoff = new Date(now.getTime() + options.withinDays * 24 * 60 * 60 * 1000);

  const [goals, projects] = await Promise.all([
    listActiveGoals(db, context),
    listActiveProjects(db, context),
  ]);

  const deadlines: UpcomingDeadline[] = [
    ...goals
      .filter((goal) => goal.targetDate && goal.targetDate >= now && goal.targetDate <= cutoff)
      .map((goal) => ({
        id: goal.id,
        title: goal.title,
        kind: "goal" as const,
        dueAt: goal.targetDate as Date,
      })),
    ...projects
      .filter((project) => project.dueDate && project.dueDate >= now && project.dueDate <= cutoff)
      .map((project) => ({
        id: project.id,
        title: project.title,
        kind: "project" as const,
        dueAt: project.dueDate as Date,
      })),
  ];

  return deadlines.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}
