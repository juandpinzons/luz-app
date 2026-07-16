// Value objects
export * from "./value-objects/entity-id";
export * from "./value-objects/relationship-type";
export * from "./value-objects/goal-status";
export * from "./value-objects/project-status";
export * from "./value-objects/routine-frequency";
export * from "./value-objects/life-domain-type";

// Identity
export * from "./life-graph-context";

// Entities
export * from "./entities/life-graph";
export * from "./entities/person";
export * from "./entities/relationship";
export * from "./entities/goal";
export * from "./entities/project";
export * from "./entities/habit";
export * from "./entities/routine";
export * from "./entities/life-event";
export * from "./entities/life-domain";

// Repositories
export * from "./repositories/life-graph.repository";
export * from "./repositories/life-repository";
export * from "./repositories/person.repository";
export * from "./repositories/goal.repository";
export * from "./repositories/project.repository";
export * from "./repositories/habit.repository";
export * from "./repositories/routine.repository";
export * from "./repositories/relationship.repository";
export * from "./repositories/life-event.repository";
export * from "./repositories/life-domain.repository";

// Events
export * from "./events/domain-event";
export * from "./events/life-graph-created";
export * from "./events/person-added-to-life-graph";
export * from "./events/goal-created";
export * from "./events/habit-created";
export * from "./events/routine-detected";
export * from "./events/life-event-registered";
export * from "./events/relationship-updated";

// Graph
export * from "./graph/life-node";
export * from "./graph/life-edge";
export * from "./graph/life-graph-index";

// Services
export * from "./services/life-graph-bootstrap";
