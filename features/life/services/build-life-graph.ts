import type { Belief } from "../../../core/belief-engine";
import type { Concept } from "../../../core/concept-graph";
import type { EntityId, Goal, Habit, Project } from "../../../core/life";
import type { Memory } from "../../../core/memory-engine";
import type { InsightExplanation } from "../../knowledge/services/explain-insight";
import type { ValidatedInsights } from "../../knowledge/services/list-validated-insights";
import { INSIGHT_TYPE_LABELS, MEMORY_TYPE_LABELS } from "../labels";
import type { RelationshipWithDisplayName } from "./list-all-relationships";
import type { LifeTimeline } from "./get-life-timeline";

export interface LifeGraphItem {
  id: EntityId;
  title: string;
  subtitle?: string;
  muted?: boolean;
  celebrated?: boolean;
  href: string;
}

export interface LifeGraphCategory {
  label: string;
  count: number;
}

export type LifeGraphBranchId =
  | "vida"
  | "habitos"
  | "relaciones"
  | "recuerdos"
  | "comprension"
  | "logros"
  | "creencias"
  | "conceptos";

export interface LifeGraphBranch {
  id: LifeGraphBranchId;
  label: string;
  /**
   * Total real (`LifeTimeline.total`/`ValidatedInsights.total` para
   * `recuerdos`/`comprensión`), nunca `items.length` -- `items` puede
   * venir recortado a un tope de exhibición (bug real, encontrado en
   * producción: dos cuentas distintas mostraban el mismo número
   * porque ambas superaban el tope).
   */
  count: number;
  items: LifeGraphItem[];
  /** Desglose por categoría real (`Memory.type`/`Insight.type`) -- solo presente en las ramas donde existe esa categorización (`recuerdos`, `comprensión`), ordenado de mayor a menor. */
  categories?: LifeGraphCategory[];
}

export interface LifeGraphSummary {
  branches: LifeGraphBranch[];
  relationships: RelationshipWithDisplayName[];
  timeline: Memory[];
  insights: InsightExplanation[];
}

/** `Partial<Record<T, number>>` -- de mayor a menor conteo, nunca el orden de inserción (que dependería de qué tipo apareció primero en esta cuenta). Empates: mismo orden que el vocabulario original (`MEMORY_TYPES`/`INSIGHT_TYPES`), ya estable en `byType`. */
function toCategories<T extends string>(
  byType: Partial<Record<T, number>>,
  labels: Record<T, string>,
): LifeGraphCategory[] {
  return (Object.entries(byType) as [T, number][])
    .map(([type, count]) => ({ label: labels[type], count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Pura y síncrona a propósito: solo reagrupa datos que el llamador ya
 * obtuvo (`/life` los pide con `Promise.allSettled`, cada fuente
 * degradándose por separado -- esta función no vuelve a decidir eso,
 * ni vuelve a consultar nada). "Logros" no es un dato nuevo: es el
 * mismo `status === "completed"` que `LifeCard` ya distinguía
 * visualmente (`celebrated`), ahora también su propia rama en vez de
 * mezclado con lo activo.
 */
export function assembleLifeGraph(input: {
  goals: Goal[];
  projects: Project[];
  habits: Habit[];
  relationships: RelationshipWithDisplayName[];
  timeline: LifeTimeline;
  insights: ValidatedInsights;
  beliefs: Belief[];
  concepts: Concept[];
}): LifeGraphSummary {
  const { goals, projects, habits, relationships, timeline, insights, beliefs, concepts } = input;
  const activeBeliefs = beliefs.filter((belief) => belief.status === "active");

  const activeGoals = goals.filter((goal) => goal.status !== "completed");
  const completedGoals = goals.filter((goal) => goal.status === "completed");
  const activeProjects = projects.filter((project) => project.status !== "completed");
  const completedProjects = projects.filter((project) => project.status === "completed");
  const activeHabits = habits.filter((habit) => habit.active);

  const branches: LifeGraphBranch[] = [
    {
      id: "vida",
      label: "Vida",
      count: activeGoals.length + activeProjects.length,
      items: [
        ...activeGoals.map((goal) => ({
          id: goal.id,
          title: goal.title,
          subtitle: "objetivo",
          muted: goal.status === "abandoned",
          href: `/life/goals/${goal.id}`,
        })),
        ...activeProjects.map((project) => ({
          id: project.id,
          title: project.title,
          subtitle: "proyecto",
          muted: project.status === "cancelled",
          href: `/life/projects/${project.id}`,
        })),
      ],
    },
    {
      id: "habitos",
      label: "Hábitos",
      count: activeHabits.length,
      items: activeHabits.map((habit) => ({
        id: habit.id,
        title: habit.title,
        subtitle: "hábito",
        href: `/life/habits/${habit.id}`,
      })),
    },
    {
      id: "relaciones",
      label: "Relaciones",
      count: relationships.length,
      items: relationships.map((relationship) => ({
        id: relationship.id,
        title: relationship.otherPersonName,
        subtitle: relationship.type,
        href: `/life/relationships/${relationship.id}`,
      })),
    },
    {
      id: "recuerdos",
      label: "Recuerdos",
      count: timeline.total,
      items: timeline.items.map((memory) => ({
        id: memory.id,
        title: memory.content,
        subtitle: MEMORY_TYPE_LABELS[memory.type],
        href: `/memories`,
      })),
      categories: toCategories(timeline.byType, MEMORY_TYPE_LABELS),
    },
    {
      id: "comprension",
      label: "Lo que he entendido",
      count: insights.total,
      items: insights.items.map((insight) => ({
        id: insight.id,
        title: insight.reason,
        subtitle: INSIGHT_TYPE_LABELS[insight.type],
        href: `/memories`,
      })),
      categories: toCategories(insights.byType, INSIGHT_TYPE_LABELS),
    },
    {
      id: "creencias",
      label: "Creencias",
      count: activeBeliefs.length,
      items: activeBeliefs.map((belief) => ({
        id: belief.id,
        title: belief.statement,
        subtitle: belief.domain,
        href: `/life/beliefs/${belief.id}`,
      })),
    },
    {
      id: "conceptos",
      label: "Conceptos",
      count: concepts.length,
      items: concepts.map((concept) => ({
        id: concept.id,
        title: concept.label,
        subtitle: concept.domain,
        href: `/life/concepts/${concept.id}`,
      })),
    },
    {
      id: "logros",
      label: "Logros",
      count: completedGoals.length + completedProjects.length,
      items: [
        ...completedGoals.map((goal) => ({
          id: goal.id,
          title: goal.title,
          subtitle: "objetivo cumplido",
          celebrated: true,
          href: `/life/goals/${goal.id}`,
        })),
        ...completedProjects.map((project) => ({
          id: project.id,
          title: project.title,
          subtitle: "proyecto cumplido",
          celebrated: true,
          href: `/life/projects/${project.id}`,
        })),
      ],
    },
  ];

  return { branches, relationships, timeline: timeline.items, insights: insights.items };
}
