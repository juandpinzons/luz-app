import { authConfig } from "./config";
import { createMobileSessionHandoff } from "./mobile-session-handoff-repository";
import type { Database } from "../core/db/client";
import { recordEvent } from "../core/observability/record-event";

/** Mismo default que Auth.js (`@auth/core/lib/init.js`, `session.maxAge`) -- 30 días, nunca un número inventado aparte para que una sesión nativa no expire distinto que una web. */
const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export interface NativeIdentityProfile {
  readonly provider: string;
  readonly providerAccountId: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly name: string | null;
  readonly image: string | null;
  /** Campos crudos del proveedor que vale la pena guardar en `accounts` (tokens, scope, expiración) -- ninguno se vuelve a usar para llamar al proveedor después, ver el docblock de cada callback sobre por qué. */
  readonly accountFields?: {
    access_token?: string;
    id_token?: string;
    token_type?: Lowercase<string>;
    scope?: string;
    expires_at?: number;
  };
}

export class NativeAuthAdapterUnavailableError extends Error {
  constructor() {
    super("El adapter de Auth.js no expone los métodos requeridos.");
    this.name = "NativeAuthAdapterUnavailableError";
  }
}

/**
 * Compartido entre `app/api/mobile-auth/callback/route.ts` (Google) y
 * `app/api/apple-auth/callback/route.ts` (Apple) -- ambos ya verificaron
 * la identidad de la persona con el proveedor real (intercambio de
 * código + userinfo para Google, verificación de firma del JWT para
 * Apple) antes de llegar acá; esta función solo sabe "crear/vincular la
 * cuenta LUZ y abrir una sesión real", nunca cómo se verificó cada
 * identidad. Usa DIRECTAMENTE la misma instancia de `Adapter` que
 * construye `auth/config.ts` -- nunca reimplementa esa lógica aparte,
 * la sesión resultante es indistinguible de un login web normal: misma
 * tabla `sessions`, mismos tokens cifrados en `accounts` (`linkAccount`
 * ya los cifra, ver `auth/encrypted-adapter.ts`), mismo evento
 * `auth_sign_in` que dispara un login web (se dispara a mano acá porque
 * este camino nunca pasa por el ciclo de vida interno de Auth.js).
 *
 * El `sessionToken` real nunca sale de este servidor -- ver
 * `auth/schema.ts::mobileSessionHandoffs` para el resto del puente.
 */
export async function linkNativeAccountAndCreateSession(
  db: Database,
  profile: NativeIdentityProfile,
): Promise<{ exchangeCode: string; userId: string; isNewUser: boolean }> {
  // Defensivo, nunca debería pasar -- auth/config.ts siempre construye
  // el adapter. Explícito en vez de asumirlo en silencio.
  const adapter = authConfig.adapter;
  if (
    !adapter?.getUserByAccount ||
    !adapter.getUserByEmail ||
    !adapter.createUser ||
    !adapter.linkAccount ||
    !adapter.createSession
  ) {
    throw new NativeAuthAdapterUnavailableError();
  }

  // Mismo orden de resolución que el ciclo interno de Auth.js: primero
  // por la cuenta ya vinculada, después por email (una persona que ya
  // existe con OTRO proveedor pero todavía no vinculó este -- ej.
  // entró antes con Google y ahora entra con Apple), y solo si ninguna
  // existe, una persona nueva.
  //
  // Límite real, conocido, sin resolver (auditoría 2026-08-19): esta
  // resolución por email NUNCA encuentra la cuenta si Apple entrega un
  // email de reenvío privado ("Hide My Email", ej.
  // `xyz@privaterelay.appleid.com`) para alguien que ya tenía cuenta
  // por Google con su email real -- termina con DOS cuentas LUZ
  // separadas para la misma persona, cada una con su propio LifeGraph.
  // No hay ningún flujo de fusión de cuentas en todo el producto
  // todavía (no es algo específico de Apple); resolverlo bien
  // necesitaría ese flujo, no un parche acá.
  let user = await adapter.getUserByAccount({
    provider: profile.provider,
    providerAccountId: profile.providerAccountId,
  });
  let isNewUser = false;

  if (!user) {
    const existingByEmail = await adapter.getUserByEmail(profile.email);

    if (existingByEmail) {
      user = existingByEmail;
    } else {
      // `id` se descarta en tiempo de ejecución cuando la tabla ya
      // tiene default (`users.id`, `defaultRandom()`) -- ver
      // `node_modules/@auth/drizzle-adapter/lib/pg.js`. Se pasa solo
      // para satisfacer el tipo `AdapterUser`, nunca se usa de verdad.
      user = await adapter.createUser({
        id: crypto.randomUUID(),
        email: profile.email,
        emailVerified: profile.emailVerified ? new Date() : null,
        name: profile.name,
        image: profile.image,
      });
      isNewUser = true;
    }

    await adapter.linkAccount({
      userId: user.id,
      type: "oauth",
      provider: profile.provider,
      providerAccountId: profile.providerAccountId,
      ...profile.accountFields,
    });
  }

  const session = await adapter.createSession({
    sessionToken: crypto.randomUUID(),
    userId: user.id,
    expires: new Date(Date.now() + SESSION_MAX_AGE_MS),
  });

  await recordEvent(db, {
    type: "auth_sign_in",
    userId: user.id,
    metadata: { isNewUser, via: "mobile", provider: profile.provider },
  });

  const exchangeCode = await createMobileSessionHandoff(db, session.sessionToken);

  return { exchangeCode, userId: user.id, isNewUser };
}
