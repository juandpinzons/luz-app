import type { EntityId } from "../life/value-objects/entity-id";

/**
 * Proyección mínima de una entidad del Life Graph — deliberadamente no
 * es `Goal`/`Project`/`Habit` de `core/life`. `core/reality` es kernel
 * compartido: no importa el tipo de ninguna entidad de `core/life`, ni
 * llama a sus repositorios. Un futuro ensamblador de `RealitySnapshot`
 * es quien traduce `Goal`/`Project`/`Habit` reales a esta forma — esa
 * traducción es la frontera anti-corrupción, nunca cruzada dentro de
 * este módulo.
 */
export interface LifeStateItem {
  id: EntityId;
  title: string;
  /**
   * Unifica `Goal.targetDate` y `Project.dueDate` en una sola forma
   * neutral — ambas expresan lo mismo desde `core/reality`: "para
   * cuándo importa esto". `Habit` no tiene fecha natural, así que
   * queda `undefined` para hábitos, nunca inventada.
   */
  dueDate?: Date;
}

/** Estado estructurado del Life Graph relevante para un engine, no todo el grafo. */
export interface LifeStateSnapshot {
  activeGoals: LifeStateItem[];
  activeProjects: LifeStateItem[];
  activeHabits: LifeStateItem[];
}
