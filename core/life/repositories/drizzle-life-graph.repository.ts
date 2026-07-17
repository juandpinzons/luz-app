import { eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import {
  type LifeGraphRow,
  type PersonRow,
  lifeGraphs,
  persons,
} from "../../db/schema";
import type { LifeGraph } from "../entities/life-graph";
import type { Person } from "../entities/person";
import { type EntityId, createEntityId } from "../value-objects/entity-id";
import type { LifeGraphRepository } from "./life-graph.repository";

function toLifeGraph(row: LifeGraphRow): LifeGraph {
  if (!row.ownerPersonId) {
    // Solo puede pasar si se lee un LifeGraph a mitad de creación, fuera
    // de la transacción de LifeGraphBootstrap (Milestone 2) — nunca en
    // una lectura normal. Preferible fallar ruidosamente a devolver un
    // LifeGraph con un ownerPersonId inventado.
    throw new Error(
      `LifeGraph ${row.id} no tiene owner_person_id. Solo puede leerse ` +
        "así en medio de un bootstrap sin terminar.",
    );
  }

  return {
    id: createEntityId(row.id),
    ownerPersonId: createEntityId(row.ownerPersonId),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toPerson(row: PersonRow): Person {
  return {
    id: createEntityId(row.id),
    lifeGraphId: createEntityId(row.lifeGraphId),
    name: row.name,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DrizzleLifeGraphRepository implements LifeGraphRepository {
  constructor(private readonly db: Database) {}

  async getById(id: EntityId): Promise<LifeGraph | null> {
    const rows = await this.db
      .select()
      .from(lifeGraphs)
      .where(eq(lifeGraphs.id, id))
      .limit(1);

    return rows[0] ? toLifeGraph(rows[0]) : null;
  }

  /**
   * Upsert de un LifeGraph ya completo. El primer `save` de un LifeGraph
   * recién creado —antes de que exista su Person dueño— es
   * responsabilidad de life-graph-bootstrap.ts (Milestone 2), no de este
   * método: `ownerPersonId` es NOT NULL a nivel de dominio, así que
   * persistir un LifeGraph sin owner todavía requiere una estrategia que
   * ese servicio decidirá (p. ej. constraint FK deferida).
   */
  async save(lifeGraph: LifeGraph): Promise<void> {
    await this.db
      .insert(lifeGraphs)
      .values({
        id: lifeGraph.id,
        ownerPersonId: lifeGraph.ownerPersonId,
        createdAt: lifeGraph.createdAt,
        updatedAt: lifeGraph.updatedAt,
      })
      .onConflictDoUpdate({
        target: lifeGraphs.id,
        set: {
          ownerPersonId: lifeGraph.ownerPersonId,
          updatedAt: lifeGraph.updatedAt,
        },
      });
  }

  async getMembers(lifeGraphId: EntityId): Promise<Person[]> {
    const rows = await this.db
      .select()
      .from(persons)
      .where(eq(persons.lifeGraphId, lifeGraphId));

    return rows.map(toPerson);
  }

  async saveMember(person: Person): Promise<void> {
    await this.db
      .insert(persons)
      .values({
        id: person.id,
        lifeGraphId: person.lifeGraphId,
        name: person.name,
        notes: person.notes ?? null,
        createdAt: person.createdAt,
        updatedAt: person.updatedAt,
      })
      .onConflictDoUpdate({
        target: persons.id,
        set: {
          name: person.name,
          notes: person.notes ?? null,
          updatedAt: person.updatedAt,
        },
      });
  }
}
