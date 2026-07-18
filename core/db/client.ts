import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env";
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

export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
