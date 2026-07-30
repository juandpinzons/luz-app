import { createEntityId } from "../../../core/life";
import type { Scenario } from "../../presence/tests/fixtures";

/**
 * Escenario adicional propio de Home: "highly active user". Los otros
 * 7 escenarios pedidos por la Tarea 4 ya existen en
 * `features/presence/tests/fixtures.ts` (compartidos con Presence, sin
 * copiarlos aquí -- esta misión pide trabajar solo dentro de
 * `features/home/`, así que este archivo agrega en vez de modificar
 * ese módulo). Este es el único que no tenía un análogo real: mucho
 * volumen (6 observaciones, 5 recomendaciones) con una mezcla sana de
 * señales positivas y una sola cosa por revisar -- pensado
 * específicamente para ejercitar `lifeContext.observationCount`/
 * `recommendationCount` (que en el resto de los escenarios apenas se
 * diferencian de lo que ya se muestra) y el recorte a 3 de
 * `recentProgress` con datos que no son ni una crisis ni un día vacío.
 */

const activeGoalRunningId = createEntityId("goal-media-maraton");
const activeGoalPortfolioId = createEntityId("goal-renovar-portafolio");
const activeHabitYogaId = createEntityId("habit-yoga-matutino");
const activeHabitJournalId = createEntityId("habit-journaling");
const activeTeamPersonId = createEntityId("person-equipo-trabajo");
const activeTeamRelationshipId = createEntityId("relationship-equipo-trabajo");
const activeGrowthGoalId = createEntityId("goal-curso-diseno");
const activeGrowthHabitId = createEntityId("habit-sketch-diario");
const activeReportProjectId = createEntityId("project-reporte-anual");

const NOW = new Date("2026-07-29T09:00:00-05:00");

export const highlyActiveUser: Scenario = {
  name: "highly active user",
  observations: [
    {
      type: "goal_at_risk",
      priority: "medium",
      domain: "career",
      entities: [{ kind: "goal", id: activeGoalPortfolioId, title: "Renovar portafolio" }],
      evidence: { status: "active", daysSinceUpdate: 31 },
      generatedAt: NOW,
      explanation: 'El objetivo "Renovar portafolio" está activo y sin actualizarse hace 31 días.',
    },
    {
      type: "goal_progressing",
      priority: "low",
      domain: "health",
      entities: [{ kind: "goal", id: activeGoalRunningId, title: "Correr media maratón" }],
      evidence: { status: "active", daysSinceUpdate: 1 },
      generatedAt: NOW,
      explanation: 'El objetivo "Correr media maratón" está activo y se actualizó hace 1 día, sin vencimiento superado.',
    },
    {
      type: "habit_consistent",
      priority: "low",
      domain: "health",
      entities: [{ kind: "habit", id: activeHabitYogaId, title: "Yoga matutino" }],
      evidence: { daysSinceUpdate: 1 },
      generatedAt: NOW,
      explanation: 'El hábito "Yoga matutino" sigue activo y se actualizó hace 1 día.',
    },
    {
      type: "habit_consistent",
      priority: "low",
      domain: "personal_growth",
      entities: [{ kind: "habit", id: activeHabitJournalId, title: "Journaling" }],
      evidence: { daysSinceUpdate: 2 },
      generatedAt: NOW,
      explanation: 'El hábito "Journaling" sigue activo y se actualizó hace 2 días.',
    },
    {
      type: "strong_relationship",
      priority: "low",
      entities: [
        { kind: "person", id: activeTeamPersonId, title: "Equipo de trabajo" },
        { kind: "relationship", id: activeTeamRelationshipId, title: "Colegas del equipo de trabajo" },
      ],
      evidence: { closeness: 75 },
      generatedAt: NOW,
      explanation: "La relación de Colegas del equipo de trabajo tiene una cercanía declarada de 75/100.",
    },
    {
      type: "high_growth_domain",
      priority: "low",
      domain: "personal_growth",
      entities: [
        { kind: "domain", domain: "personal_growth", title: "Crecimiento personal" },
        { kind: "goal", id: activeGrowthGoalId, title: "Curso de diseño" },
        { kind: "habit", id: activeGrowthHabitId, title: "Sketch diario" },
      ],
      evidence: { newItemsInWindow: 2, windowDays: 30 },
      generatedAt: NOW,
      explanation: "Se registraron 2 elementos nuevos en Crecimiento personal en los últimos 30 días.",
    },
  ],
  recommendations: [
    {
      id: `GOAL_REVIEW:goal:${activeGoalPortfolioId}`,
      type: "GOAL_REVIEW",
      priority: "medium",
      title: "Revisar objetivo",
      explanation: 'Revisar objetivo: "Renovar portafolio" [status=active, daysSinceUpdate=31].',
      evidence: ["status=active", "daysSinceUpdate=31"],
      relatedEntities: [{ kind: "goal", id: activeGoalPortfolioId, title: "Renovar portafolio" }],
      suggestedAction: {
        kind: "open_entity",
        targetEntity: { kind: "goal", id: activeGoalPortfolioId, title: "Renovar portafolio" },
        suggestedFields: ["status", "targetDate"],
      },
      confidence: 0.8,
    },
    {
      id: `CELEBRATE_PROGRESS:goal:${activeGoalRunningId}`,
      type: "CELEBRATE_PROGRESS",
      priority: "low",
      title: "Celebrar progreso",
      explanation: 'Celebrar progreso: "Correr media maratón" [status=active, daysSinceUpdate=1].',
      evidence: ["status=active", "daysSinceUpdate=1"],
      relatedEntities: [{ kind: "goal", id: activeGoalRunningId, title: "Correr media maratón" }],
      suggestedAction: {
        kind: "acknowledge",
        targetEntity: { kind: "goal", id: activeGoalRunningId, title: "Correr media maratón" },
      },
      confidence: 0.85,
    },
    {
      id: `CELEBRATE_PROGRESS:habit:${activeHabitYogaId}`,
      type: "CELEBRATE_PROGRESS",
      priority: "low",
      title: "Celebrar progreso",
      explanation: 'Celebrar progreso: "Yoga matutino" [daysSinceUpdate=1].',
      evidence: ["daysSinceUpdate=1"],
      relatedEntities: [{ kind: "habit", id: activeHabitYogaId, title: "Yoga matutino" }],
      suggestedAction: {
        kind: "acknowledge",
        targetEntity: { kind: "habit", id: activeHabitYogaId, title: "Yoga matutino" },
      },
      confidence: 0.85,
    },
    {
      id: `CELEBRATE_PROGRESS:habit:${activeHabitJournalId}`,
      type: "CELEBRATE_PROGRESS",
      priority: "low",
      title: "Celebrar progreso",
      explanation: 'Celebrar progreso: "Journaling" [daysSinceUpdate=2].',
      evidence: ["daysSinceUpdate=2"],
      relatedEntities: [{ kind: "habit", id: activeHabitJournalId, title: "Journaling" }],
      suggestedAction: {
        kind: "acknowledge",
        targetEntity: { kind: "habit", id: activeHabitJournalId, title: "Journaling" },
      },
      confidence: 0.85,
    },
    {
      id: `CELEBRATE_PROGRESS:person:${activeTeamPersonId}`,
      type: "CELEBRATE_PROGRESS",
      priority: "low",
      title: "Celebrar progreso",
      explanation: 'Celebrar progreso: "Equipo de trabajo" [closeness=75].',
      evidence: ["closeness=75"],
      relatedEntities: [
        { kind: "person", id: activeTeamPersonId, title: "Equipo de trabajo" },
        { kind: "relationship", id: activeTeamRelationshipId, title: "Colegas del equipo de trabajo" },
      ],
      suggestedAction: {
        kind: "acknowledge",
        targetEntity: { kind: "person", id: activeTeamPersonId, title: "Equipo de trabajo" },
      },
      confidence: 0.85,
    },
  ],
  upcoming: [
    {
      kind: "project",
      id: activeReportProjectId,
      title: "Entregar reporte anual",
      domain: "career",
      dueDate: new Date(NOW.getTime() + 3 * 24 * 60 * 60 * 1000),
    },
  ],
};
