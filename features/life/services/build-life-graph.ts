import type { Belief } from "../../../core/belief-engine";
import type { Concept } from "../../../core/concept-graph";
import type { EntityId, Goal, Habit, Project } from "../../../core/life";
import type { Memory } from "../../../core/memory-engine";
import type { RelationshipWithDisplayName } from "./list-all-relationships";
import type { InsightExplanation } from "../../knowledge/services/explain-insight";

export interface LifeGraphItem {
  id: EntityId;
  title: string;
  subtitle?: string;
  muted?: boolean;
  celebrated?: boolean;
  href: string;
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
  count: number;
  items: LifeGraphItem[];
}

export interface LifeGraphSummary {
  branches: LifeGraphBranch[];
  relationships: RelationshipWithDisplayName[];
  timeline: Memory[];
  insights: InsightExplanation[];
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
  timeline: Memory[];
  insights: InsightExplanation[];
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
      count: timeline.length,
      items: timeline.map((memory) => ({
        id: memory.id,
        title: memory.content,
        href: `/memories`,
      })),
    },
    {
      id: "comprension",
      label: "Lo que he entendido",
      count: insights.length,
      items: insights.map((insight) => ({
        id: insight.id,
        title: insight.reason,
        href: `/memories`,
      })),
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

  return { branches, relationships, timeline, insights };
}
