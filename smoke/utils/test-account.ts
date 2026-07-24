import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import type { Database } from "../../core/db/client";
import { users } from "../../core/db/schema/users";
import { conversations } from "../../core/db/schema/conversations";
import { knowledgeJobs } from "../../core/db/schema/jobs";
import { lifeGraphs } from "../../core/db/schema/life-graph";
import { accountIdentities, sessions } from "../../auth/schema";
import { createAccountIdentityResolver } from "../../auth/drizzle-identity-resolver";
import type { LifeGraphContext } from "../../core/life";

/**
 * Cuenta fixture, real y permanente en `users` -- reglas de seguridad
 * (Founder, 2026-07-24):
 *
 * 1. Nunca puede autenticarse por un proveedor OAuth real: `.internal`
 *    no es un TLD real, ningún proveedor (Google es el único hoy,
 *    `auth/providers`) puede verificar ni emitir ese email -- no es una
 *    convención a respetar, es estructuralmente imposible mientras
 *    Google siga siendo el único proveedor. Si algún día se agrega un
 *    proveedor que deje al usuario declarar su propio email sin
 *    verificarlo, esta garantía deja de sostenerse sola y hace falta
 *    una comprobación activa -- no aplica hoy.
 * 2. Marcada en el modelo de datos: `metadata` abajo, para que sea
 *    inspeccionable directo en la fila, no solo por convención de
 *    nombre de email.
 * 3. Excluir de métricas/analytics/`/admin`: ver
 *    docs/engineering/SMOKE_TEST_PLAN.md -- ese dashboard no existe
 *    todavía en producción, así que hoy esto es documentación para
 *    cuando se construya, no un filtro activo en código real.
 * 4. Correos/notificaciones: no aplica -- no existe ningún sistema de
 *    envío de emails o notificaciones en el proyecto todavía
 *    (confirmado por búsqueda en el código, 2026-07-24). Si se agrega
 *    uno, debe excluir cuentas con `metadata.fixture = true`.
 */
export const SMOKE_TEST_EMAIL = "smoke-test@luz.internal";

export const SMOKE_TEST_METADATA = {
  fixture: true,
  purpose: "smoke-test",
} as const;

const SESSION_TTL_MS = 60 * 60 * 1000;

export interface TestAccount {
  userId: string;
  lifeGraphContext: LifeGraphContext;
  sessionCookie: string;
}

/**
 * Reinicia la cuenta de smoke test a un estado limpio y conocido, y
 * abre una sesión nueva -- cada corrida es autocontenida (regla del
 * Founder, 2026-07-24): nunca depende de datos dejados por una corrida
 * anterior, ni de un usuario real.
 *
 * Borrar `life_graphs` de esta cuenta basta para limpiar TODO lo que
 * cuelga de ella (`persons`, `account_identities`, `life_goals/
 * projects/habits/routines/relationships`, `memories`,
 * `memory_connections`, `memory_embeddings`) -- todas esas tablas
 * referencian `life_graphs.id` con `ON DELETE CASCADE` (ver
 * core/db/schema/life-graph.ts, life-entities.ts, memory.ts). Un solo
 * punto de verdad, nunca una lista de tablas hijas que mantener
 * sincronizada a mano según crece el dominio.
 *
 * Después de borrar, se vuelve a resolver el mismo
 * `AccountIdentityResolver` que usa producción -- así cada corrida
 * también verifica el bootstrap real de una cuenta nueva, no un atajo
 * de prueba aparte.
 */
export async function resetTestAccount(db: Database): Promise<TestAccount> {
  const [user] = await db
    .insert(users)
    .values({
      email: SMOKE_TEST_EMAIL,
      name: "Smoke Test",
      metadata: SMOKE_TEST_METADATA,
    })
    .onConflictDoUpdate({
      target: users.email,
      set: { name: "Smoke Test", metadata: SMOKE_TEST_METADATA },
    })
    .returning();

  const [existingIdentity] = await db
    .select()
    .from(accountIdentities)
    .where(eq(accountIdentities.accountId, user.id));

  if (existingIdentity) {
    await db.delete(lifeGraphs).where(eq(lifeGraphs.id, existingIdentity.lifeGraphId));
  }

  await db.delete(conversations).where(eq(conversations.userId, user.id));
  await db.delete(knowledgeJobs).where(eq(knowledgeJobs.userId, user.id));
  await db.delete(sessions).where(eq(sessions.userId, user.id));

  const lifeGraphContext = await createAccountIdentityResolver(db).resolve(user.id);

  const sessionToken = crypto.randomUUID();
  await db.insert(sessions).values({
    sessionToken,
    userId: user.id,
    expires: new Date(Date.now() + SESSION_TTL_MS),
  });

  // Auth.js usa el prefijo `__Secure-` en el nombre de la cookie cuando
  // el sitio corre en https (ver `useSecureCookies` en
  // @auth/core/lib/utils/cookie.js) -- mandamos ambas variantes para
  // que la suite funcione igual contra prod (https) y contra localhost
  // (http) sin tener que detectar el protocolo acá.
  return {
    userId: user.id,
    lifeGraphContext,
    sessionCookie: `authjs.session-token=${sessionToken}; __Secure-authjs.session-token=${sessionToken}`,
  };
}
