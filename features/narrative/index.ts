/**
 * Living Narrative Foundation (ver README.md). `buildNarrativeState`
 * (`application/`) es el único punto de entrada público -- decide qué
 * historia está activa, en qué capítulo, qué cambió desde la última
 * visita, y qué merece continuación, celebración o silencio, a partir
 * de contratos ya calculados por Memory/Knowledge/Reality/Experience/
 * Continuity. Sin IA, sin repositorios, sin aleatoriedad. Vive en
 * `features/`, no en `core/` -- mismo criterio que `features/home/`/
 * `features/experience/`/`features/presence/` (ver ADR-0018).
 */
export * from "./domain";
export * from "./application/build-narrative-state";
export * from "./integrations";
