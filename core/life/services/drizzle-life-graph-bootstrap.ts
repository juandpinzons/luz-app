import { eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { lifeGraphs, persons } from "../../db/schema";
import type { LifeGraph } from "../entities/life-graph";
import type { Person } from "../entities/person";
import { createEntityId } from "../value-objects/entity-id";
import type {
  LifeGraphBootstrap,
  LifeGraphBootstrapInput,
  LifeGraphBootstrapResult,
} from "./life-graph-bootstrap";

/**
 * `life_graphs.owner_person_id` y `persons.life_graph_id` se
 * referencian mutuamente (core/db/schema/life-graph.ts) — solo la
 * primera columna es nullable, así que el LifeGraph se inserta primero
 * sin owner, luego el Person (que ya puede apuntar a este LifeGraph), y
 * al final se completa el owner. DrizzleLifeGraphRepository.save() no
 * sirve para el primer paso porque `LifeGraph.ownerPersonId` es no-nulo
 * a nivel de dominio — por eso esta orquestación de dos entidades vive
 * aquí (ver el comentario de LifeGraphBootstrap) y no en el
 * repositorio, con inserts directos sobre el schema en vez de componer
 * sobre otro repositorio, igual que DrizzlePersistStage.
 *
 * No emite LifeGraphCreated / PersonAddedToLifeGraph todavía: no existe
 * ningún event bus o publisher en el repositorio hoy — construir esos
 * eventos sin nadie que los consuma sería código muerto. Queda como
 * gap documentado, no resuelto aquí.
 */
export class DrizzleLifeGraphBootstrap implements LifeGraphBootstrap {
  constructor(private readonly db: Database) {}

  async bootstrap(
    input: LifeGraphBootstrapInput,
  ): Promise<LifeGraphBootstrapResult> {
    const lifeGraphId = createEntityId(crypto.randomUUID());
    const personId = createEntityId(crypto.randomUUID());
    const now = new Date();

    const owner: Person = {
      id: personId,
      lifeGraphId,
      name: input.name,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    const lifeGraph: LifeGraph = {
      id: lifeGraphId,
      ownerPersonId: personId,
      createdAt: now,
      updatedAt: now,
    };

    await this.db.transaction(async (tx) => {
      await tx.insert(lifeGraphs).values({
        id: lifeGraphId,
        ownerPersonId: null,
        createdAt: now,
        updatedAt: now,
      });

      await tx.insert(persons).values({
        id: personId,
        lifeGraphId,
        name: owner.name,
        notes: owner.notes ?? null,
        createdAt: now,
        updatedAt: now,
      });

      await tx
        .update(lifeGraphs)
        .set({ ownerPersonId: personId, updatedAt: now })
        .where(eq(lifeGraphs.id, lifeGraphId));
    });

    return { lifeGraph, owner };
  }
}
