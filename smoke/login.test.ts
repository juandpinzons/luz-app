import { eq } from "drizzle-orm";
import { db } from "../core/db/client";
import { sessions } from "../auth/schema";
import { smokeFetch } from "./utils/http";
import type { SmokeContext, SmokeFlow } from "./types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * No ejerce el OAuth real de Google -- eso es problema de Google, no
 * de LUZ. Verifica lo que sí es responsabilidad de la app: que una
 * sesión de base de datos válida efectivamente autentica contra
 * `/dashboard` (misma sesión que crea `resetTestAccount`, mismo
 * mecanismo que usa un login real vía Auth.js database strategy).
 */
export const loginFlow: SmokeFlow = {
  name: "login",
  async run(ctx: SmokeContext) {
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.userId, ctx.userId));
    assert(session, "no existe la fila de sesión esperada en `sessions`");

    const res = await smokeFetch("/dashboard", ctx.sessionCookie);
    assert(
      res.status === 200,
      `/dashboard devolvió ${res.status}, se esperaba 200`,
    );
    assert(
      !res.url.includes("/login"),
      "/dashboard redirigió a /login -- la sesión no fue reconocida como válida",
    );
  },
};
