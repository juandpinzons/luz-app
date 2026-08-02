import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getLifeGraphContext, getUserContext } from "@/auth/user-context";
import { db } from "@/core/db/client";
import { conversations } from "@/core/db/schema";
import { createRequestId, logger } from "@/core/observability/logger";
import { buildContinuityLine } from "@/features/dashboard/services/build-morning-brief";

export interface GetContinuityLineResponse {
  continuityLine: string | null;
}

/**
 * Misión "complete latency profile" (roadmap #1): la única parte de
 * `MorningBrief` que toca IA -- hoy `app/dashboard/page.tsx` la sigue
 * esperando síncronamente dentro de su `Promise.all` bloqueante (312 ms
 * medidos, 94-98% del tiempo total de esa carga). Este endpoint expone
 * la misma pieza (`buildContinuityLine`) para pedirse aparte, mismo
 * patrón que `/api/chat/welcome` ya usa para su propio saludo generado
 * por IA -- `fetch` en el cliente, nunca bloqueando el render inicial.
 *
 * Deliberadamente NO reemplaza todavía la espera síncrona de
 * `app/dashboard/page.tsx`: consumir esto desde un componente cliente
 * (estado de carga, animación de aparición) es la mitad de UX de este
 * cambio -- fuera del alcance de este commit, mismo criterio que
 * `features/avatar/` y `features/identity-evolution/` esta sesión
 * (arquitectura/capacidad real, lista para integrarse visualmente).
 */
export async function GET(): Promise<Response> {
  const requestId = createRequestId();
  const startedAt = Date.now();
  const route = "GET /api/dashboard/continuity-line";

  const context = await getUserContext();
  if (!context) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  let lifeGraphContext;
  try {
    lifeGraphContext = await getLifeGraphContext();
  } catch (error) {
    logger.log({
      event: "lifegraph.resolve_failed",
      severity: "warn",
      requestId,
      route,
      userId: context.userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (!lifeGraphContext) {
    return NextResponse.json({ continuityLine: null } satisfies GetContinuityLineResponse);
  }

  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(conversations)
    .where(eq(conversations.userId, context.userId));
  const isFirstVisit = (row?.n ?? 0) === 0;

  const continuityLine = await buildContinuityLine(db, lifeGraphContext, isFirstVisit);

  logger.log({
    event: "api.request_completed",
    requestId,
    route,
    userId: context.userId,
    status: 200,
    durationMs: Date.now() - startedAt,
  });

  return NextResponse.json({ continuityLine } satisfies GetContinuityLineResponse);
}
