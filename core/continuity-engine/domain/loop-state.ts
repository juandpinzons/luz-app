/**
 * Ciclo de vida de un `ContinuityLoop` -- misión: "Design a
 * deterministic lifecycle... Every transition must require evidence.
 * Never close a loop automatically without justification."
 *
 * - `open`: recién detectado, sin seguimiento todavía. Estado inicial
 *   único -- ningún loop nace en otro estado.
 * - `waiting`: hay una próxima fecha de seguimiento real (`nextFollowUpAt`,
 *   ver `../scheduling/`) todavía no alcanzada -- LUZ ya decidió CUÁNDO
 *   volver a mirar esto, solo que no es ahora.
 * - `follow_up`: la fecha de seguimiento ya se cumplió (o el loop nunca
 *   necesitó esperar) -- este loop debería resurfacear AHORA en algún
 *   consumidor (Presence/Daily Reflection/Morning Brief/Dashboard).
 * - `resolved`: cerrado CON un desenlace real capturado (`LoopOutcome`)
 *   -- el único estado terminal que implica que el asunto se resolvió
 *   de verdad, no solo que LUZ dejó de rastrearlo.
 * - `archived`: cerrado SIN un desenlace explícito -- el sistema dejó
 *   de rastrearlo por una razón determinista propia (superado por
 *   información más nueva, expiró el número máximo de intentos de
 *   seguimiento) nunca por silencio. Nunca implica éxito ni fracaso.
 * - `abandoned`: cerrado porque la persona señaló explícitamente que ya
 *   no importa -- distinto de `archived` (que es una decisión del
 *   sistema) en que este SIEMPRE requiere una señal humana explícita
 *   como evidencia (ver `LOOP_EVIDENCE_KINDS.user_explicit_abandon`).
 * - `transformed`: el asunto de este loop se convirtió en otra cosa
 *   concreta y rastreable (p. ej. una `explicit_intention` se volvió un
 *   `Goal` real vía `LifeCaptureService`) -- el loop original se cierra
 *   señalando hacia el loop nuevo (`LoopResolution.transformedIntoLoopId`),
 *   nunca se pierde la trazabilidad de cuál reemplazó a cuál.
 *
 * `resolved`/`archived`/`abandoned`/`transformed` son TERMINALES: un
 * loop cerrado nunca vuelve a abrirse. Si el mismo asunto reaparece de
 * verdad (p. ej. la persona vuelve a mencionar algo que ya se había
 * archivado), la regla de apertura correspondiente crea un
 * `ContinuityLoop` NUEVO -- mantiene el historial honesto en vez de
 * reescribir uno viejo.
 */
export const LOOP_STATES = [
  "open",
  "waiting",
  "follow_up",
  "resolved",
  "archived",
  "abandoned",
  "transformed",
] as const;

export type LoopState = (typeof LOOP_STATES)[number];

export const LOOP_TERMINAL_STATES: readonly LoopState[] = [
  "resolved",
  "archived",
  "abandoned",
  "transformed",
];

export function isTerminalLoopState(state: LoopState): boolean {
  return LOOP_TERMINAL_STATES.includes(state);
}

/**
 * Único punto de verdad de qué transición es válida -- `transitionLoop()`
 * (`../lifecycle/transition-loop.ts`) es el único código que la lee;
 * nada más en este módulo (ni fuera de él) debe decidir por su cuenta
 * si un cambio de estado es válido. Estados terminales listan un
 * arreglo vacío -- ninguna transición sale de ellos.
 */
export const LOOP_ALLOWED_TRANSITIONS: Readonly<Record<LoopState, readonly LoopState[]>> = {
  open: ["waiting", "follow_up", "resolved", "archived", "abandoned", "transformed"],
  waiting: ["follow_up", "resolved", "archived", "abandoned", "transformed"],
  follow_up: ["waiting", "resolved", "archived", "abandoned", "transformed"],
  resolved: [],
  archived: [],
  abandoned: [],
  transformed: [],
};

export function isAllowedLoopTransition(from: LoopState, to: LoopState): boolean {
  return LOOP_ALLOWED_TRANSITIONS[from].includes(to);
}
