import type { EntityId } from "../life/value-objects/entity-id";

/**
 * Un Goal/Project que se completó recientemente y todavía no se
 * reconoció -- ya filtrado por la capa de aplicación contra
 * `seen_prompts` (`subjectType: "goal_closure"`) y por una ventana de
 * recencia real (`listRecentlyCompletedGoals`/`...Projects`), para que
 * un cierre de hace meses nunca se sienta como "esto acaba de pasar".
 * `AcknowledgeClosureStrategyRule` (redesign del pipeline
 * conversacional, Beta) la usa para reconocer el hecho específico, no
 * un "felicidades" genérico.
 */
export interface RealityClosure {
  id: EntityId;
  title: string;
  kind: "goal" | "project";
}

/** Como máximo una a la vez -- mismo criterio que `GrowingBeliefSnapshot`. */
export interface ClosureSnapshot {
  items: RealityClosure[];
}
