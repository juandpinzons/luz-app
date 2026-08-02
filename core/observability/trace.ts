import { AsyncLocalStorage } from "node:async_hooks";
import { elapsedMs, logger, nowMs } from "./logger";

/**
 * Perfil de latencia real (misión "complete latency profile") -- un
 * árbol de spans por request, construido con `AsyncLocalStorage` para
 * que la atribución (qué query/qué tiempo pertenece a qué subsistema)
 * sea correcta incluso cuando varios subsistemas corren en paralelo
 * (`Promise.all`), sin un "stack" mutable compartido que se corrompería
 * bajo esa concurrencia -- cada `span()` lee su padre del contexto
 * ambiental de SU PROPIA cadena de continuaciones asíncronas, nunca de
 * una variable global mutable.
 *
 * Ninguna función de este archivo cambia qué hace el código que
 * envuelve -- mismo valor de retorno, mismos errores relanzados tal
 * cual. Medición pura, cero efecto sobre el comportamiento real (misión
 * explícita: "measurement only").
 */

export const SPAN_KINDS = [
  /** La raíz de una traza -- una por request. */
  "root",
  /** Compone/decide a partir de resultados ya obtenidos, sin IO propia (Context Builder, Conversation Strategy, Presence, Voice). */
  "orchestration",
  /** Una lectura/escritura real contra Postgres. */
  "repository",
  /** Un motor determinista con su propia lógica (Narrative, Identity Evolution, Context Engine). */
  "engine",
  /** Una llamada de red real a un servicio externo (Google Calendar, Gmail). */
  "external_api",
  /** Una llamada real a un proveedor de IA (OpenAI). */
  "llm",
  /** Cómputo puro en memoria, sin IO. */
  "compute",
  /** Codificación de la respuesta (SSE, JSON). */
  "serialization",
  /** Trabajo que corre después de que la respuesta ya se envió (`after()`), nunca cuenta hacia la latencia percibida. */
  "background",
] as const;

export type SpanKind = (typeof SPAN_KINDS)[number];

export interface SpanRecord {
  readonly id: number;
  readonly name: string;
  readonly kind: SpanKind;
  readonly parentId: number | null;
  readonly startedAt: number;
  durationMs: number | null;
  /** Cuántas queries SQL reales se dispararon MIENTRAS este span estaba activo (atribución exacta vía `recordQuery()`, nunca estimada). */
  queryCount: number;
  /** `result.length` cuando el resultado del span es un arreglo -- automático, nunca inventado para resultados que no lo son (queda `null`). */
  rowCount: number | null;
  error?: string;
  meta?: Record<string, unknown>;
}

interface TraceStore {
  readonly requestId: string;
  readonly currentSpanId: number;
  readonly spans: SpanRecord[];
}

const als = new AsyncLocalStorage<TraceStore>();
let nextSpanId = 1;

/** `undefined` fuera de una traza activa (p. ej. un script standalone) -- nunca un valor inventado. */
export function currentRequestId(): string | undefined {
  return als.getStore()?.requestId;
}

/**
 * Llamada desde el logger de Drizzle (`core/db/client.ts`) por cada
 * sentencia SQL real ejecutada -- atribuye la query al span activo en
 * ESE momento. Fuera de una traza (scripts, tests, trabajo sin
 * instrumentar todavía), no hace nada -- nunca lanza, nunca bloquea la
 * query real.
 */
export function recordQuery(): void {
  const store = als.getStore();
  if (!store) return;
  const span = store.spans.find((candidate) => candidate.id === store.currentSpanId);
  if (span) span.queryCount += 1;
}

export interface SpanSummaryRow {
  readonly id: number;
  readonly name: string;
  readonly kind: SpanKind;
  readonly parentId: number | null;
  readonly depth: number;
  /** Tiempo de pared del span completo, incluyendo hijos -- "cumulative time". */
  readonly durationMs: number;
  /** `durationMs` menos la suma de los hijos DIRECTOS -- "own execution time", lo que este span hizo que ningún hijo ya explica. */
  readonly ownMs: number;
  readonly pctOfTotal: number;
  /** Queries disparadas directamente por este span (no por sus hijos). */
  readonly queryCount: number;
  /** Queries de este span + todos sus descendientes. */
  readonly queryCountCumulative: number;
  readonly rowCount: number | null;
  /** Suma de `durationMs` de los hijos directos. */
  readonly childSumMs: number;
  /**
   * `childSumMs / durationMs` -- por encima de 1 solo es posible si los
   * hijos corrieron en paralelo (se solaparon en el tiempo); cercano a 1
   * es evidencia real de ejecución secuencial. `null` sin hijos.
   */
  readonly parallelismRatio: number | null;
  readonly error?: string;
  readonly meta?: Record<string, unknown>;
}

export interface TraceSummary {
  readonly requestId: string;
  readonly rootName: string;
  readonly totalMs: number;
  readonly rows: readonly SpanSummaryRow[];
  readonly asciiTable: string;
}

function buildRow(
  span: SpanRecord,
  childrenOf: Map<number, SpanRecord[]>,
  byId: Map<number, SpanRecord>,
  totalMs: number,
): SpanSummaryRow {
  let depth = 0;
  let cursor: SpanRecord | undefined = span;
  while (cursor?.parentId !== null && cursor?.parentId !== undefined) {
    cursor = byId.get(cursor.parentId);
    depth += 1;
  }

  const kids = childrenOf.get(span.id) ?? [];
  const childSumMs = kids.reduce((sum, kid) => sum + (kid.durationMs ?? 0), 0);
  const duration = span.durationMs ?? 0;

  function cumulativeQueries(record: SpanRecord): number {
    const own = record.queryCount;
    const descendants = (childrenOf.get(record.id) ?? []).reduce(
      (sum, kid) => sum + cumulativeQueries(kid),
      0,
    );
    return own + descendants;
  }

  return {
    id: span.id,
    name: span.name,
    kind: span.kind,
    parentId: span.parentId,
    depth,
    durationMs: duration,
    ownMs: Math.max(0, Math.round((duration - childSumMs) * 10) / 10),
    pctOfTotal: totalMs > 0 ? Math.round((duration / totalMs) * 1000) / 10 : 0,
    queryCount: span.queryCount,
    queryCountCumulative: cumulativeQueries(span),
    rowCount: span.rowCount,
    childSumMs: Math.round(childSumMs * 10) / 10,
    parallelismRatio:
      kids.length > 0 && duration > 0 ? Math.round((childSumMs / duration) * 100) / 100 : null,
    error: span.error,
    meta: span.meta,
  };
}

const TABLE_NAME_WIDTH = 32;

function renderAsciiTable(rootName: string, rows: readonly SpanSummaryRow[], totalMs: number): string {
  // Solo los hijos DIRECTOS de la raíz -- mismo nivel que el ejemplo de
  // la misión (una línea por subsistema de alto nivel, no el árbol
  // completo; el árbol completo vive en `rows`/el log estructurado).
  const topLevel = rows.filter((row) => row.depth === 1);
  const lines = topLevel.map((row) => {
    const label = row.name;
    const dots = ".".repeat(Math.max(2, TABLE_NAME_WIDTH - label.length));
    return `${label} ${dots} ${Math.round(row.durationMs)} ms`;
  });
  const totalDots = ".".repeat(Math.max(2, TABLE_NAME_WIDTH - "Total".length));
  lines.push(`Total ${totalDots} ${Math.round(totalMs)} ms`);
  return lines.join("\n");
}

function summarize(store: TraceStore): TraceSummary {
  const byId = new Map(store.spans.map((span) => [span.id, span]));
  const childrenOf = new Map<number, SpanRecord[]>();
  for (const span of store.spans) {
    if (span.parentId !== null) {
      const siblings = childrenOf.get(span.parentId) ?? [];
      siblings.push(span);
      childrenOf.set(span.parentId, siblings);
    }
  }

  const root = store.spans[0]!;
  const totalMs = root.durationMs ?? 0;
  const rows = store.spans.map((span) => buildRow(span, childrenOf, byId, totalMs));

  return {
    requestId: store.requestId,
    rootName: root.name,
    totalMs,
    rows,
    asciiTable: renderAsciiTable(root.name, rows, totalMs),
  };
}

/**
 * Punto de entrada de una traza -- una por request real
 * (`dashboard.request`, `chat.prepare_context`, `chat.finalize`).
 * `fn` corre dentro del contexto de `AsyncLocalStorage`: cualquier
 * `span()` anidado dentro (directo o a través de varios `await`,
 * incluyendo ramas paralelas de un `Promise.all`) se atribuye
 * correctamente a este árbol.
 */
export async function runTrace<T>(
  requestId: string,
  rootName: string,
  fn: () => Promise<T>,
): Promise<{ result: T; summary: TraceSummary }> {
  const root: SpanRecord = {
    id: nextSpanId++,
    name: rootName,
    kind: "root",
    parentId: null,
    startedAt: nowMs(),
    durationMs: null,
    queryCount: 0,
    rowCount: null,
  };
  const store: TraceStore = { requestId, currentSpanId: root.id, spans: [root] };

  try {
    const result = await als.run(store, fn);
    (root as { durationMs: number | null }).durationMs = elapsedMs(root.startedAt);
    return { result, summary: summarize(store) };
  } catch (error) {
    (root as { durationMs: number | null }).durationMs = elapsedMs(root.startedAt);
    root.error = error instanceof Error ? error.message : String(error);
    throw error;
  }
}

/**
 * Envuelve una operación real como un span hijo del span activo. Fuera
 * de una traza (`als.getStore()` vacío -- un script standalone, un test
 * sintético), corre `fn()` sin instrumentar -- nunca bloquea la
 * ejecución real por falta de contexto de trazas.
 *
 * Detecta `rowCount` automáticamente cuando el resultado es un arreglo
 * -- la mayoría de las llamadas a repositorios (`list()`/`retrieve()`)
 * ya devuelven uno, así que esto cubre "número de filas leídas" para el
 * caso común sin que cada call site tenga que reportarlo a mano.
 */
export async function span<T>(name: string, kind: SpanKind, fn: () => Promise<T>): Promise<T> {
  const parentStore = als.getStore();
  if (!parentStore) {
    return fn();
  }

  const record: SpanRecord = {
    id: nextSpanId++,
    name,
    kind,
    parentId: parentStore.currentSpanId,
    startedAt: nowMs(),
    durationMs: null,
    queryCount: 0,
    rowCount: null,
  };
  parentStore.spans.push(record);

  const childStore: TraceStore = { ...parentStore, currentSpanId: record.id };

  try {
    const result = await als.run(childStore, fn);
    record.durationMs = elapsedMs(record.startedAt);
    if (Array.isArray(result)) {
      record.rowCount = result.length;
    }
    return result;
  } catch (error) {
    record.durationMs = elapsedMs(record.startedAt);
    record.error = error instanceof Error ? error.message : String(error);
    throw error;
  }
}

/**
 * Imprime la tabla en el formato que pide la misión (consola, para
 * lectura humana en desarrollo) y emite el resumen estructurado
 * completo (`logger.log`, un evento por traza, con el árbol completo de
 * spans) -- la fuente real para el análisis posterior, nunca solo la
 * tabla de texto.
 */
export function logTraceSummary(summary: TraceSummary, extra: Record<string, unknown> = {}): void {
  console.log(`\n${summary.rootName}\n\n${summary.asciiTable}\n`);
  logger.log({
    event: summary.rootName,
    severity: "info",
    requestId: summary.requestId,
    totalMs: summary.totalMs,
    spans: summary.rows,
    ...extra,
  });
}
