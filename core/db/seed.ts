import { fileURLToPath } from "node:url";
import { db } from "./client";
import { users } from "./schema";

/**
 * Usuario de demostración temporal.
 *
 * LUZ todavía no tiene autenticación implementada (decisión CTO #9,
 * pendiente — Auth.js sobre PostgreSQL). Como el esquema exige
 * `user_id` en todo lo que persiste el usuario, este id fijo es el
 * puente explícito hasta que exista login real. Se referencia siempre
 * por este nombre para que sea trivial de encontrar y retirar.
 */
export const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

export async function seedDemoUser(): Promise<void> {
  await db
    .insert(users)
    .values({
      id: DEMO_USER_ID,
      email: "demo@luz.local",
      name: "Usuario Demo",
    })
    .onConflictDoNothing();
}

const isDirectRun =
  process.argv[1] !== undefined &&
  process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  seedDemoUser()
    .then(() => {
      console.log(`[seed] Usuario demo listo: ${DEMO_USER_ID}`);
      process.exit(0);
    })
    .catch((error: unknown) => {
      console.error("[seed] error:", error);
      process.exit(1);
    });
}
