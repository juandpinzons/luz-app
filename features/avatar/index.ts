/**
 * Presence Avatar (ver README.md). Responde "¿qué debería mostrar el
 * personaje de LUZ ahora mismo?" combinando dos capas: `deriveMood`
 * (agregado determinístico de Presence+Experience+Narrative+Identity,
 * `services/derive-mood.ts`) y `resolveAvatarState` (interacción en
 * vivo de la sesión actual, `services/resolve-avatar-state.ts`).
 * `buildPresenceAvatarState` (`application/`) es el punto de entrada
 * único para un consumidor real. Sin IA, sin persistencia propia, sin
 * tocar una sola línea de Presence/Experience/Narrative/Identity
 * Evolution ni de `features/orb/` (módulo hermano, no reemplazado --
 * ver README, "Relación con `features/orb/`"). Arquitectura y estado
 * determinístico únicamente -- el personaje/ilustración/animación
 * (SVG/Rive/Lottie/React) y su integración en home/chat/dashboard son
 * responsabilidad de Product Engineering (ver README, "Guía de
 * integración para I7").
 */
export * from "./domain";
export * from "./application/build-presence-avatar-state";
export * from "./services/derive-mood";
export * from "./services/resolve-avatar-state";
