/**
 * Conversational Variety V1 (ver README.md). El usuario nunca debe
 * sentir que LUZ está obsesionada con un solo tema. `assembleConversationalVariety`
 * (`application/`) es el punto de entrada real; `computeConversationVariety`
 * (`services/`) es el punto de entrada para tests/escenarios sintéticos.
 * Sin IA, sin repositorio propio, sin tabla nueva -- una sola consulta
 * de solo lectura sobre `conversations.category`, ya existente. Vive
 * en `features/`, no en `core/` -- mismo criterio que `features/home/`/
 * `features/narrative/`/`features/identity-evolution/` (ver ADR-0018).
 */
export * from "./domain";
export * from "./services/compute-conversation-variety";
export * from "./application/assemble-conversational-variety";
export * from "./integrations";
