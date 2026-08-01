/**
 * Capa `features/` de Continuity System -- adaptadores para fuentes que
 * viven en `features/` (Calendar/Gmail Foundation, Dashboard
 * Recommendations) más los contratos de integración de producto
 * (Experience/Presence/Daily Reflection/Morning Brief/Dashboard/
 * Notification). El dominio, ciclo de vida, persistencia y reglas de
 * fuentes `core/` viven en `core/continuity-engine/`, que este módulo
 * consume -- ver `core/continuity-engine/README.md` para el porqué de
 * la separación entre los dos.
 */
export * from "./detection";
export * from "./resolution";
export * from "./integrations";
