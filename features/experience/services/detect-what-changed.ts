import type { HomeState } from "../../home/domain/home-state";
import type { RealityChange, RealityFingerprint } from "../domain/experience-state";

/**
 * `HomeState` ya trae todo lo necesario salvo `memoriesStored`
 * (`DashboardSummary`, no `HomeState` -- Presence/Home nunca lo
 * cubrieron, ver `features/dashboard/services/build-dashboard-summary.ts`)
 * -- se recibe aparte en vez de ensanchar `HomeState` solo para este
 * uso.
 */
export function buildRealityFingerprint(homeState: HomeState, memoriesStored: number): RealityFingerprint {
  return {
    memoriesStored,
    goalsCompleted: homeState.lifeContext.totals.goalsByStatus.completed,
    projectsCompleted: homeState.lifeContext.totals.projectsByStatus.completed,
    observationCount: homeState.lifeContext.observationCount,
    recommendationCount: homeState.lifeContext.recommendationCount,
    relationshipTotal: homeState.lifeContext.relationships.total,
  };
}

/**
 * "¿Qué cambió desde tu última visita?" -- comparación exacta contra
 * la huella de la visita anterior, nunca una interpretación. Sin
 * huella previa (primera visita real con historial), no hay "antes"
 * contra qué comparar -- vacío, no fabricado. Determinístico: mismas
 * dos huellas siempre producen los mismos cambios, mismo orden.
 *
 * Solo diffs POSITIVOS (algo aumentó) -- un conteo que bajó (p. ej.
 * `recommendationCount` porque una recomendación dejó de aplicar) no
 * es una "novedad" que reportar aquí, es simplemente que algo se
 * resolvió; `isNewPrimary`/la ausencia de esa tarjeta ya lo reflejan
 * en otro lado.
 */
export function detectWhatChanged(
  current: RealityFingerprint,
  previous: RealityFingerprint | null,
): RealityChange[] {
  if (!previous) return [];

  const changes: RealityChange[] = [];

  const newMemories = current.memoriesStored - previous.memoriesStored;
  if (newMemories > 0) {
    changes.push({
      type: "new_memories",
      count: newMemories,
      summary: newMemories === 1 ? "Guardé un recuerdo nuevo tuyo." : `Guardé ${newMemories} recuerdos nuevos tuyos.`,
    });
  }

  const goalsCompleted = current.goalsCompleted - previous.goalsCompleted;
  if (goalsCompleted > 0) {
    changes.push({
      type: "goal_completed",
      count: goalsCompleted,
      summary: goalsCompleted === 1 ? "Completaste un objetivo." : `Completaste ${goalsCompleted} objetivos.`,
    });
  }

  const projectsCompleted = current.projectsCompleted - previous.projectsCompleted;
  if (projectsCompleted > 0) {
    changes.push({
      type: "project_completed",
      count: projectsCompleted,
      summary: projectsCompleted === 1 ? "Completaste un proyecto." : `Completaste ${projectsCompleted} proyectos.`,
    });
  }

  const newObservations = current.observationCount - previous.observationCount;
  if (newObservations > 0) {
    changes.push({
      type: "new_observation",
      count: newObservations,
      summary: newObservations === 1 ? "Noté algo nuevo en tu vida." : `Noté ${newObservations} cosas nuevas en tu vida.`,
    });
  }

  const newRelationships = current.relationshipTotal - previous.relationshipTotal;
  if (newRelationships > 0) {
    changes.push({
      type: "new_relationship",
      count: newRelationships,
      summary: newRelationships === 1 ? "Registraste una relación nueva." : `Registraste ${newRelationships} relaciones nuevas.`,
    });
  }

  return changes;
}
