import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config/env";
import * as schema from "./schema";

/**
 * Cliente de base de datos único para todo el dominio. Vive en `core/`
 * y solo depende de `postgres` + `drizzle-orm`, ninguna librería de
 * framework — así es reutilizable desde Web, Workers o una futura CLI.
 */
const queryClient = postgres(env.DATABASE_URL);

export const db = drizzle(queryClient, { schema });

export type Database = typeof db;
