import { db } from "../core/db/client";
import { findOrCreateGoal } from "../core/life";
import { smokeFetch } from "./utils/http";
import type { SmokeContext, SmokeFlow } from "./types";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

const SMOKE_GOAL_TITLE = "Meta de smoke test -- certificación AWS";

/**
 * Siembra un Goal directo por `core/life` en vez de depender de que la
 * IA clasifique el mensaje de `first-message.test.ts` como un Goal --
 * eso no sería determinista (regla del Founder: cada corrida debe ser
 * repetible). Este es el chequeo que habría atrapado el incidente del
 * 2026-07-24 (migración `life_goals` nunca corrida en prod) antes de
 * que llegara a los 13 usuarios reales.
 */
export const dashboardFlow: SmokeFlow = {
  name: "dashboard",
  async run(ctx: SmokeContext) {
    await findOrCreateGoal(db, ctx.lifeGraphContext, { title: SMOKE_GOAL_TITLE });

    const dashboardRes = await smokeFetch("/dashboard", ctx.sessionCookie);
    assert(
      dashboardRes.status === 200,
      `/dashboard devolvió ${dashboardRes.status}, se esperaba 200`,
    );
    const dashboardHtml = await dashboardRes.text();
    assert(
      dashboardHtml.includes(SMOKE_GOAL_TITLE),
      "/dashboard no muestra la meta sembrada -- posible tabla life_* faltante o degradación silenciosa (ver incidente 2026-07-24)",
    );

    const lifeRes = await smokeFetch("/life", ctx.sessionCookie);
    assert(lifeRes.status === 200, `/life devolvió ${lifeRes.status}, se esperaba 200`);
  },
};
