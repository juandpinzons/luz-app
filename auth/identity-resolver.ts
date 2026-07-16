import type { LifeGraphContext } from "../core/life/life-graph-context";
import type { AccountId } from "./account-id";

/**
 * Contrato para resolver una Account autenticada hacia su
 * `LifeGraphContext` de dominio (ADR-0011). Vive en `auth/`, no en
 * `core/life`: su firma depende de `AccountId`, un concepto de
 * infraestructura que el dominio nunca debe conocer. Es la sucesora de
 * `getUserContext` (`auth/user-context.ts`) — coexisten hasta que el
 * resto del dominio (Memory, Knowledge, features/chat) migre de
 * `UserContext` a `LifeGraphContext` en su propio milestone.
 *
 * Si la Account no tiene todavía un `LifeGraph` asociado, una
 * implementación debe usar una `LifeGraphBootstrap`
 * (`core/life/services/life-graph-bootstrap.ts`) para crear uno junto
 * con su miembro owner, nunca orquestar esa creación aquí.
 *
 * Solo la interfaz — sin implementación (requiere persistencia, fuera
 * de alcance de Milestone 2).
 */
export interface AccountIdentityResolver {
  resolve(accountId: AccountId): Promise<LifeGraphContext>;
}
