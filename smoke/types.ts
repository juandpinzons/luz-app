import type { LifeGraphContext } from "../core/life";

/**
 * Todo lo que un flujo necesita para correr — nunca lee env vars ni
 * abre su propia sesión; eso lo resuelve el runner una sola vez por
 * corrida (ver `utils/test-account.ts`), así un flujo puede correr
 * solo (`--flow login`) o como parte de la suite completa sin cambiar
 * de comportamiento.
 */
export interface SmokeContext {
  baseUrl: string;
  sessionCookie: string;
  userId: string;
  lifeGraphContext: LifeGraphContext;
}

/**
 * Un flujo lanza (`throw new Error(mensaje)`) para fallar — el runner
 * captura eso, nunca un valor de retorno booleano. El mensaje del error
 * es lo único que un desarrollador ve al fallar, así que debe decir qué
 * se esperaba y qué pasó de verdad.
 */
export interface SmokeFlow {
  name: string;
  run(ctx: SmokeContext): Promise<void>;
}

export interface SmokeResult {
  name: string;
  status: "pass" | "fail";
  durationMs: number;
  error?: string;
}
