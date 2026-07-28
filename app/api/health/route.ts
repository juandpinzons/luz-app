import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/core/db/client";
import { logger } from "@/core/observability/logger";

/**
 * Endpoint de salud para monitoreo externo (UptimeRobot u otro
 * servicio, ver ALPHA_BACKLOG.md). Deliberadamente mínimo: solo app +
 * conectividad a Postgres. No verifica OpenAI, Auth, Memory Engine,
 * Knowledge Engine ni ningún otro servicio — un monitor de uptime debe
 * detectar "LUZ está caída", no diagnosticar cuál dependencia falló.
 */
export async function GET(): Promise<Response> {
  const timestamp = new Date().toISOString();

  try {
    await db.execute(sql`select 1`);
    return NextResponse.json({ status: "ok", database: "ok", timestamp });
  } catch (error) {
    logger.log({
      event: "health.database_check_failed",
      severity: "error",
      route: "GET /api/health",
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { status: "error", database: "down", timestamp },
      { status: 503 },
    );
  }
}
