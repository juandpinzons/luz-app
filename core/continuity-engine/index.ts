/**
 * Continuity System Foundation -- ver README.md. Fuentes puramente
 * `core/` (Memory/Goal/Project/Relationship/Curiosity). Calendar/Gmail/
 * Recommendation y los contratos de integración de producto (Experience/
 * Presence/Daily Reflection/Morning Brief/Dashboard/Notification) viven
 * en `features/continuity/`, que consume este módulo -- `core/` nunca
 * depende de `features/`.
 */
export * from "./domain";
export * from "./repositories";
export * from "./lifecycle";
export * from "./detection";
export * from "./resolution";
export * from "./scheduling";
