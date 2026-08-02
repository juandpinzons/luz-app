/**
 * Logger estructurado (Sprint de Observabilidad, Alpha). Una línea JSON
 * por evento hacia stdout/stderr — Vercel ya captura y busca sobre eso
 * (`vercel logs --json`), así que estructurar la salida ES el sistema
 * de logging en este entorno; no hace falta un servicio externo para
 * el tamaño actual del Alpha.
 *
 * Deliberadamente plano (sin clases, sin contexto implícito global):
 * cada llamada recibe explícitamente lo que quiere loguear. Un logger
 * con estado compartido entre requests es un riesgo real en
 * serverless (instancias reutilizadas entre invocaciones).
 */
export type LogSeverity = "info" | "warn" | "error";

export interface LogFields {
  event: string;
  severity?: LogSeverity;
  requestId?: string;
  userId?: string;
  conversationId?: string;
  route?: string;
  durationMs?: number;
  [key: string]: unknown;
}

function write(fields: LogFields): void {
  const { severity = "info", ...rest } = fields;

  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    severity,
    ...rest,
  });

  if (severity === "error") {
    console.error(line);
  } else if (severity === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const logger = { log: write };

/**
 * Genera un id corto por request — no un UUID completo (no necesita
 * ser globalmente único para siempre, solo distinguible dentro de una
 * ventana de logs razonable).
 */
export function createRequestId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * `Date.now()` envuelto -- un Server Component (`.tsx`) no puede
 * llamar `Date.now()` directamente en su cuerpo (regla
 * `react-hooks/purity` de este proyecto: "Cannot call impure function
 * during render"), pero SÍ puede llamar una función importada que lo
 * haga por dentro -- mismo criterio que ya permite `createRequestId()`
 * (que llama `Math.random()` internamente) en `app/dashboard/page.tsx`.
 * Los Route Handlers (`route.ts`) no son componentes y nunca
 * necesitaron este envoltorio -- siguen usando `Date.now()` directo.
 */
export function nowMs(): number {
  return Date.now();
}

/** `nowMs() - startedAt`, para el patrón `durationMs` que ya usa el resto del repo -- ver docblock de `nowMs`. */
export function elapsedMs(startedAt: number): number {
  return nowMs() - startedAt;
}
