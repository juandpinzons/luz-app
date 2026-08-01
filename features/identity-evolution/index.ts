/**
 * Identity Evolution Engine (ver README.md). Responde "¿quién es esta
 * persona HOY?" -- nunca "qué le pasó" -- a partir de la evidencia real
 * ya persistida por `core/belief-engine`/`core/concept-graph` (vía
 * `features/identity/services/describe-evolution.ts`, reutilizado sin
 * modificar). `buildIdentitySnapshot` (`application/`, puro) es el
 * punto de entrada para tests/escenarios sintéticos;
 * `assembleIdentityEvolution` (`application/`, toca `Database`) es el
 * punto de entrada para un consumidor real. Sin IA, sin persistencia
 * propia, sin tocar una sola línea de Memory/Knowledge/Narrative/
 * Experience. Vive en `features/`, no en `core/` -- mismo criterio que
 * `features/home/`/`features/experience/`/`features/presence/`/
 * `features/narrative/` (ver ADR-0018).
 */
export * from "./domain";
export * from "./application/build-identity-snapshot";
export * from "./application/assemble-identity-evolution";
export * from "./integrations";
