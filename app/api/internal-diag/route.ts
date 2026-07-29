import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/core/db/client";

/**
 * TEMPORAL -- root-causing el bug de "¿Cómo vamos?" (feedback) contra
 * el estado real de producción. Gateado por un secreto de un solo uso
 * (DIAG_SECRET), no por sesión -- se elimina en el mismo bloque de
 * trabajo, no queda como deuda técnica.
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env.DIAG_SECRET;
  if (!secret) return false;
  return request.headers.get("x-diag-secret") === secret;
}

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const report: Record<string, unknown> = {};

  try {
    const migrations = await db.execute(
      sql`select hash, created_at from drizzle.__drizzle_migrations order by created_at`,
    );
    report.migrations = migrations;
  } catch (e) {
    report.migrationsError = e instanceof Error ? e.message : String(e);
  }

  try {
    const t = await db.execute(
      sql`select to_regclass('public.feedback_responses') as t`,
    );
    report.feedbackTableExists = t;
  } catch (e) {
    report.feedbackTableError = e instanceof Error ? e.message : String(e);
  }

  try {
    const count = await db.execute(sql`select count(*) from feedback_responses`);
    report.feedbackCount = count;
  } catch (e) {
    report.feedbackCountError = e instanceof Error ? e.message : String(e);
  }

  try {
    const recentErrors = await db.execute(
      sql`select route, message, created_at from events where type = 'error' and (route ilike '%feedback%' or message ilike '%feedback%') order by created_at desc limit 15`,
    );
    report.feedbackRelatedErrors = recentErrors;
  } catch (e) {
    report.feedbackRelatedErrorsError = e instanceof Error ? e.message : String(e);
  }

  try {
    const allRecentErrors = await db.execute(
      sql`select route, message, created_at from events where type = 'error' order by created_at desc limit 10`,
    );
    report.recentErrorsAnyRoute = allRecentErrors;
  } catch (e) {
    report.recentErrorsAnyRouteError = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json(report);
}
