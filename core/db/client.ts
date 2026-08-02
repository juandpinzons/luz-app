import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env";
import { recordQuery } from "../observability/trace";
import * as schema from "./schema";

/**
 * Cliente de base de datos único para todo el dominio. Vive en `core/`
 * y solo depende de `postgres` + `drizzle-orm`, ninguna librería de
 * framework — así es reutilizable desde Web, Workers o una futura CLI.
 *
 * `prepare: false` es obligatorio para conectar a través del pooler de
 * Neon (PgBouncer, modo transacción) — sin esto, los prepared
 * statements de postgres-js fallan de forma intermitente bajo carga
 * concurrente serverless. Es seguro también contra una conexión
 * directa (Docker local): solo desactiva una optimización, no cambia
 * el comportamiento de ninguna query.
 */
const queryClient = postgres(env.DATABASE_URL, { prepare: false });

/**
 * Misión "complete latency profile" -- `logger.logQuery` es el punto de
 * extensión oficial de Drizzle (no un hack sobre el driver crudo),
 * llamado por cada sentencia SQL real que Drizzle ejecuta. Solo cuenta
 * (`recordQuery`, atribuida al span activo vía `AsyncLocalStorage`,
 * `core/observability/trace.ts`) -- nunca registra el texto de la query
 * ni sus parámetros (podrían llevar contenido real de una persona),
 * nunca cambia ni retrasa la ejecución real.
 */
export const db = drizzle(queryClient, {
  schema,
  logger: { logQuery: () => recordQuery() },
});

export type Database = typeof db;

/**
 * El `tx` que recibe el callback de `db.transaction(async (tx) => ...)`
 * — mismo query builder que `Database` (select/insert/update/delete),
 * pero sin `$client` (no expone la conexión cruda, correcto: nadie
 * dentro de una transacción debe abrir su propia conexión aparte).
 * Repositorios que necesiten poder ejecutarse tanto sueltos como dentro
 * de una transacción del llamador (War Room 2026-07-29, ver
 * `find-or-create-goal.ts`) aceptan `Database | Transaction`, nunca
 * solo uno de los dos -- ningún repositorio debe forzar a su llamador
 * a decidir eso por él.
 */
export type Transaction = Parameters<Database["transaction"]>[0] extends (
  tx: infer Tx,
) => unknown
  ? Tx
  : never;
