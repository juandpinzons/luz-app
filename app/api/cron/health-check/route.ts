import { NextResponse } from "next/server";
import { and, eq, gte, isNotNull, sql } from "drizzle-orm";
import { db } from "@/core/db/client";
import { calendarConnections, emailConnections, events, knowledgeJobs } from "@/core/db/schema";
import { isCronAuthorized } from "@/core/observability/is-cron-authorized";
import { createRequestId, logger } from "@/core/observability/logger";
import { recordEvent } from "@/core/observability/record-event";

export const maxDuration = 60;

/**
 * Alias estable de producción -- mismo valor que `smoke/utils/http.ts`
 * (`PRODUCTION_BASE_URL`), repetido en vez de importado: `smoke/` es
 * utilería de pruebas, nunca una dependencia de código de producción.
 */
const PRODUCTION_ORIGIN = "https://luz-app-joinluz.vercel.app";

const WINDOW_HOURS = 24;

function windowStart(): Date {
  return new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000);
}

/**
 * Tablero de salud diario (auditoría de seguridad, 2026-08-14, punto 1):
 * cualquier respuesta que no sea 404 es un incidente real -- la ruta
 * de migración de emergencia se borró, así que 404 es "sigue borrada",
 * no "nunca existió". Prueba HTTP real contra el propio origen de
 * producción, no solo "el archivo no existe en este deploy" (que no
 * distingue un rollback accidental ni un proxy/redirect inesperado).
 */
async function checkMigrationRoute(): Promise<{ ok: boolean; detail: string }> {
  try {
    const response = await fetch(`${PRODUCTION_ORIGIN}/api/admin/migrate-demo-account`, {
      method: "POST",
      body: "{}",
      headers: { "content-type": "application/json" },
    });
    return response.status === 404
      ? { ok: true, detail: "404 confirmado" }
      : { ok: false, detail: `respondió ${response.status}, se esperaba 404` };
  } catch (error) {
    return { ok: false, detail: `fetch falló: ${error instanceof Error ? error.message : String(error)}` };
  }
}

/**
 * Punto 2: una conexión `disconnected` con `encrypted_credentials`
 * NO nulo es exactamente la regresión que la auditoría 2026-08-14
 * corrigió (desconectar dejaba el secreto cifrado vivo indefinidamente).
 */
async function checkCredentialResidue(): Promise<{ ok: boolean; detail: string }> {
  const [emailResidue] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(emailConnections)
    .where(and(eq(emailConnections.status, "disconnected"), isNotNull(emailConnections.encryptedCredentials)));
  const [calendarResidue] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(calendarConnections)
    .where(and(eq(calendarConnections.status, "disconnected"), isNotNull(calendarConnections.encryptedCredentials)));

  const total = (emailResidue?.count ?? 0) + (calendarResidue?.count ?? 0);
  return {
    ok: total === 0,
    detail: `email=${emailResidue?.count ?? 0} calendar=${calendarResidue?.count ?? 0}`,
  };
}

/** Punto 3: cuántos eventos de calendario tuvieron que sanitizarse + cuántas veces falló el pipeline de señales, últimas 24h. Nunca "incidente" por sí solo -- un conteo alto es lo que un humano debe mirar, no algo que este chequeo pueda juzgar solo. */
async function checkExternalPromptSignals(): Promise<{
  sanitizedEvents: number;
  pipelineFailures: number;
}> {
  const since = windowStart();

  const sanitizedRows = await db
    .select({ metadata: events.metadata })
    .from(events)
    .where(and(eq(events.type, "calendar_signal_sanitized"), gte(events.createdAt, since)));
  const sanitizedEvents = sanitizedRows.reduce((sum, row) => {
    const count = (row.metadata as { count?: number } | null)?.count;
    return sum + (typeof count === "number" ? count : 1);
  }, 0);

  const [pipelineFailures] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(events)
    .where(
      and(
        eq(events.type, "error"),
        eq(events.route, "chat.calendar_context_failed"),
        gte(events.createdAt, since),
      ),
    );

  return { sanitizedEvents, pipelineFailures: pipelineFailures?.count ?? 0 };
}

/** Punto 4: p95 de duración + conteo por resultado + tamaño de entrada, últimas 24h. Sin costo real (`AIProvider.generateReply` no expone tokens de uso -- ver docblock de `recordAiCallEvent`, `send-message.ts`) -- limitación conocida del "mínimo", no un olvido. */
async function checkAiCalls(): Promise<{
  total: number;
  byOutcome: Record<string, number>;
  p95DurationMs: number | null;
  maxInputLength: number | null;
}> {
  const since = windowStart();
  const rows = await db
    .select({ metadata: events.metadata })
    .from(events)
    .where(and(eq(events.type, "ai_call_completed"), gte(events.createdAt, since)));

  const byOutcome: Record<string, number> = {};
  const durations: number[] = [];
  let maxInputLength: number | null = null;

  for (const row of rows) {
    const metadata = row.metadata as
      | { outcome?: string; durationMs?: number; inputLength?: number }
      | null;
    if (!metadata) continue;

    const outcome = metadata.outcome ?? "unknown";
    byOutcome[outcome] = (byOutcome[outcome] ?? 0) + 1;

    if (typeof metadata.durationMs === "number") {
      durations.push(metadata.durationMs);
    }
    if (typeof metadata.inputLength === "number") {
      maxInputLength = Math.max(maxInputLength ?? 0, metadata.inputLength);
    }
  }

  durations.sort((a, b) => a - b);
  const p95Index = Math.floor(durations.length * 0.95);
  const p95DurationMs = durations.length > 0 ? (durations[Math.min(p95Index, durations.length - 1)] ?? null) : null;

  return { total: rows.length, byOutcome, p95DurationMs, maxInputLength };
}

/** Punto 5: jobs pendientes, edad del más viejo, tasa de fallo -- Knowledge Engine corre una vez al día (`/api/cron/knowledge-worker`, límite del plan Hobby de Vercel), así que una cola que crece sin bajar entre corridas es degradación silenciosa real: LUZ conversa, pero deja de "entender". */
async function checkKnowledgeQueue(): Promise<{
  pending: number;
  oldestPendingAgeHours: number | null;
  failed24h: number;
  completed24h: number;
}> {
  const since = windowStart();

  const [pendingRow] = await db
    .select({ count: sql<number>`count(*)::int`, oldestCreatedAt: sql<Date | null>`min(created_at)` })
    .from(knowledgeJobs)
    .where(eq(knowledgeJobs.status, "pending"));

  const [failedRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(knowledgeJobs)
    .where(and(eq(knowledgeJobs.status, "failed"), gte(knowledgeJobs.createdAt, since)));

  const [completedRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(knowledgeJobs)
    .where(and(eq(knowledgeJobs.status, "completed"), gte(knowledgeJobs.processedAt, since)));

  const oldestPendingAgeHours = pendingRow?.oldestCreatedAt
    ? (Date.now() - new Date(pendingRow.oldestCreatedAt).getTime()) / (60 * 60 * 1000)
    : null;

  return {
    pending: pendingRow?.count ?? 0,
    oldestPendingAgeHours,
    failed24h: failedRow?.count ?? 0,
    completed24h: completedRow?.count ?? 0,
  };
}

/**
 * Tablero de salud diario mínimo (auditoría de seguridad, 2026-08-14) --
 * corre una vez al día (`vercel.json`, límite del plan Hobby), calcula
 * los 5 puntos que el Founder pidió vigilar y los deja en `events`
 * (`type: "error"`, `route: "cron.health_check"`) SOLO cuando hay un
 * incidente real (ruta de migración viva, o credencial residual) --
 * nunca una fila por corrida exitosa, esta tabla no es un log de
 * "todo bien". Los puntos 3-5 son series (conteos/percentiles), no
 * booleanos "incidente sí/no" -- se devuelven tal cual para que un
 * humano juzgue la tendencia, este chequeo no inventa un umbral que
 * nadie pidió.
 */
export async function GET(request: Request): Promise<Response> {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const requestId = createRequestId();
  const startedAt = Date.now();

  const [migrationRoute, credentialResidue, externalPromptSignals, aiCalls, knowledgeQueue] = await Promise.all([
    checkMigrationRoute(),
    checkCredentialResidue(),
    checkExternalPromptSignals(),
    checkAiCalls(),
    checkKnowledgeQueue(),
  ]);

  const incidents: string[] = [];
  if (!migrationRoute.ok) incidents.push(`ruta de migración: ${migrationRoute.detail}`);
  if (!credentialResidue.ok) incidents.push(`credenciales residuales: ${credentialResidue.detail}`);

  if (incidents.length > 0) {
    await recordEvent(db, {
      type: "error",
      route: "cron.health_check",
      message: incidents.join(" | "),
      metadata: { migrationRoute, credentialResidue },
    });
  }

  const report = {
    migrationRoute,
    credentialResidue,
    externalPromptSignals,
    aiCalls,
    knowledgeQueue,
    incidents,
    durationMs: Date.now() - startedAt,
  };

  logger.log({
    event: "cron.health_check.completed",
    requestId,
    route: "GET /api/cron/health-check",
    ...report,
  });

  return NextResponse.json(report);
}
