import { sql } from "drizzle-orm";
import type { Database } from "../../db/client";
import type { Goal } from "../entities/goal";
import type { LifeDomainType } from "../value-objects/life-domain-type";
import type { LifeGraphContext } from "../life-graph-context";
import { DrizzleGoalRepository } from "../repositories/drizzle-goal.repository";
import { titlesLikelyMatch } from "./title-similarity";

export interface FindOrCreateGoalInput {
  title: string;
  domain?: LifeDomainType;
}

/**
 * Usado por `life-capture-service.ts` (disparado por Memory Engine)
 * — nunca crea un Goal nuevo si ya existe uno con un título similar,
 * para que declarar el mismo objetivo en dos conversaciones distintas
 * no produzca dos filas. Un Goal creado por esta vía siempre nace en
 * estado `"active"`.
 *
 * War Room 2026-07-29 (hallazgo de concurrencia): "leer todos, buscar
 * coincidencia, crear si no hay" no tenía ninguna protección contra dos
 * llamadas concurrentes para la misma persona (doble clic en enviar,
 * reintento del cliente) -- ambas podían leer "no hay coincidencia"
 * antes de que cualquiera terminara de escribir, y el resultado eran
 * dos Goals con el mismo título. Mismo patrón ya probado en
 * `check-rate-limit.ts`: todo el ciclo lectura-decisión-escritura
 * corre dentro de una única transacción, serializada por un advisory
 * lock de Postgres acotado a este LifeGraph y este tipo de entidad
 * (nunca bloquea, por ejemplo, la creación de un Project del mismo
 * usuario mientras se resuelve un Goal). Ningún cambio de esquema,
 * ningún índice nuevo -- solo concurrencia a nivel de aplicación.
 */
export async function findOrCreateGoal(
  db: Database,
  context: LifeGraphContext,
  input: FindOrCreateGoalInput,
): Promise<Goal> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${context.lifeGraphId} || ':goal'))`,
    );

    const repository = new DrizzleGoalRepository(tx);
    const existingGoals = await repository.list(context);
    const match = existingGoals.find((goal) =>
      titlesLikelyMatch(goal.title, input.title),
    );

    if (match) {
      return match;
    }

    return repository.create(context, {
      title: input.title,
      description: undefined,
      status: "active",
      domain: input.domain,
      targetDate: undefined,
    });
  });
}
