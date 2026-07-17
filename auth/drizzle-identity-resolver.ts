import { eq } from "drizzle-orm";
import type { Database } from "../core/db/client";
import { users } from "../core/db/schema";
import type { LifeGraphContext } from "../core/life/life-graph-context";
import { DrizzleLifeGraphBootstrap } from "../core/life/services/drizzle-life-graph-bootstrap";
import type { LifeGraphBootstrap } from "../core/life/services/life-graph-bootstrap";
import { createEntityId } from "../core/life/value-objects/entity-id";
import type { AccountId } from "./account-id";
import type { AccountIdentityResolver } from "./identity-resolver";
import { accountIdentities } from "./schema";

/**
 * Resuelve una Account hacia su LifeGraphContext, usando
 * `account_identities` (auth/schema.ts) como vínculo persistente y
 * delegando en LifeGraphBootstrap la primera vez que una Account no
 * tiene todavía un LifeGraph.
 */
export class DrizzleAccountIdentityResolver
  implements AccountIdentityResolver
{
  constructor(
    private readonly db: Database,
    private readonly bootstrap: LifeGraphBootstrap,
  ) {}

  async resolve(accountId: AccountId): Promise<LifeGraphContext> {
    const existing = await this.findExisting(accountId);
    if (existing) {
      return existing;
    }

    const [account] = await this.db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, accountId))
      .limit(1);

    const { lifeGraph, owner } = await this.bootstrap.bootstrap({
      name: account?.name ?? "",
    });

    const inserted = await this.db
      .insert(accountIdentities)
      .values({
        accountId,
        lifeGraphId: lifeGraph.id,
        personId: owner.id,
      })
      .onConflictDoNothing({ target: accountIdentities.accountId })
      .returning();

    if (inserted[0]) {
      return {
        lifeGraphId: createEntityId(inserted[0].lifeGraphId),
        personId: createEntityId(inserted[0].personId),
      };
    }

    // Otra resolución concurrente ganó la carrera del primer login: el
    // LifeGraph que acabamos de bootstrapear queda huérfano (nunca
    // referenciado desde ningún lado — aceptable para este milestone,
    // no se orquesta un lock para evitarlo). Devolvemos el vínculo que
    // sí quedó persistido.
    const winner = await this.findExisting(accountId);
    if (!winner) {
      throw new Error(
        `DrizzleAccountIdentityResolver: no se pudo resolver ni crear identidad para la Account ${accountId}.`,
      );
    }

    return winner;
  }

  private async findExisting(
    accountId: AccountId,
  ): Promise<LifeGraphContext | null> {
    const rows = await this.db
      .select()
      .from(accountIdentities)
      .where(eq(accountIdentities.accountId, accountId))
      .limit(1);

    return rows[0]
      ? {
          lifeGraphId: createEntityId(rows[0].lifeGraphId),
          personId: createEntityId(rows[0].personId),
        }
      : null;
  }
}

export function createAccountIdentityResolver(
  db: Database,
): AccountIdentityResolver {
  return new DrizzleAccountIdentityResolver(
    db,
    new DrizzleLifeGraphBootstrap(db),
  );
}
