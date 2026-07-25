import { execFileSync } from "node:child_process";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "../core/db/client";
import { events } from "../core/db/schema/events";
import { knowledgeJobs } from "../core/db/schema/jobs";

/**
 * Reporte de operación, no un dashboard -- imprime en texto lo que
 * `docs/engineering/OBSERVABILITY_PLAN.md` define como las métricas
 * de la beta. Ninguna de estas consultas escribe nada (todo `select`),
 * a diferencia de `smoke/`, así que no hay el mismo riesgo de correr
 * contra prod por accidente -- de hecho correr esto contra datos
 * locales de desarrollo casi no sirve, el punto es ver tráfico real.
 *
 * `npm run obs:report` (usa `.env.smoke`, producción) o
 * `npm run obs:report -- --hours 6` para otra ventana (default 24h).
 */

const CHAT_ROUTE = "POST /api/chat";

function parseHours(argv: string[]): number {
  const idx = argv.indexOf("--hours");
  if (idx === -1) return 24;
  const value = Number(argv[idx + 1]);
  return Number.isFinite(value) && value > 0 ? value : 24;
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function fmtMs(value: number | null): string {
  return value === null ? "sin datos" : `${value}ms`;
}

async function main() {
  const hours = parseHours(process.argv.slice(2));
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  console.log(`Reporte de observabilidad -- últimas ${hours}h (desde ${since.toISOString()})\n`);

  // --- Disponibilidad ---
  const [completed] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.type, "message_sent"), gte(events.createdAt, since)));

  const chatErrors = await db
    .select({ route: events.route, message: events.message, n: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.type, "error"), gte(events.createdAt, since)))
    .groupBy(events.route, events.message)
    .orderBy(sql`count(*) desc`);

  const chatErrorCount = chatErrors
    .filter((e) => e.route === CHAT_ROUTE)
    .reduce((sum, e) => sum + e.n, 0);
  const totalChatAttempts = completed.n + chatErrorCount;
  const successRate = totalChatAttempts > 0 ? (completed.n / totalChatAttempts) * 100 : null;

  console.log("Disponibilidad");
  console.log(`  Requests a ${CHAT_ROUTE}: ${totalChatAttempts}`);
  console.log(
    `  Tasa de éxito: ${successRate === null ? "sin datos" : successRate.toFixed(1) + "%"}` +
      (successRate !== null && successRate < 99 ? "  <-- por debajo del umbral (99%)" : ""),
  );
  console.log(`  Errores por ruta:`);
  if (chatErrors.length === 0) {
    console.log("    (ninguno)");
  }
  for (const e of chatErrors) {
    console.log(`    ${e.n}x ${e.route ?? "(sin route)"} -- ${e.message ?? "(sin mensaje)"}`);
  }

  // --- Experiencia ---
  const messageSentRows = await db
    .select({ metadata: events.metadata })
    .from(events)
    .where(and(eq(events.type, "message_sent"), gte(events.createdAt, since)));

  const totalDurations = messageSentRows
    .map((r) => (r.metadata as { durationMs?: number } | null)?.durationMs)
    .filter((v): v is number => typeof v === "number")
    .sort((a, b) => a - b);
  const firstTokenDurations = messageSentRows
    .map((r) => (r.metadata as { firstTokenMs?: number } | null)?.firstTokenMs)
    .filter((v): v is number => typeof v === "number")
    .sort((a, b) => a - b);

  console.log("\nExperiencia");
  console.log(
    `  Latencia al primer token -- P50: ${fmtMs(percentile(firstTokenDurations, 50))}, P95: ${fmtMs(percentile(firstTokenDurations, 95))} (n=${firstTokenDurations.length}, solo camino con streaming)`,
  );
  console.log(
    `  Duración total del mensaje -- P50: ${fmtMs(percentile(totalDurations, 50))}, P95: ${fmtMs(percentile(totalDurations, 95))} (n=${totalDurations.length})`,
  );
  console.log(
    `  Streams completados vs. abortados: ${completed.n} completados, ${chatErrorCount} fallidos` +
      (successRate !== null ? ` (${successRate.toFixed(1)}% completados)` : ""),
  );

  // --- Sistema ---
  const backgroundFailures = chatErrors.filter(
    (e) => e.route === "background.title" || e.route === "background.life_capture",
  );

  const knowledgeJobStatus = await db
    .select({ status: knowledgeJobs.status, n: sql<number>`count(*)::int` })
    .from(knowledgeJobs)
    .groupBy(knowledgeJobs.status);

  console.log("\nSistema");
  console.log("  Fallos de background jobs (título / Life Capture):");
  if (backgroundFailures.length === 0) {
    console.log("    (ninguno)");
  }
  for (const f of backgroundFailures) {
    console.log(`    ${f.n}x ${f.route} -- ${f.message ?? "(sin mensaje)"}`);
  }
  console.log(
    "  Knowledge Engine jobs por estado (informativo -- P1-1 ya documenta que el motor falla a propósito hoy, sin alerta):",
  );
  for (const row of knowledgeJobStatus) {
    console.log(`    ${row.status}: ${row.n}`);
  }

  const [{ n: appliedMigrations }] = await db.execute<{ n: number }>(
    sql`select count(*)::int as n from drizzle.__drizzle_migrations`,
  ).then((r) => r as unknown as { n: number }[]);
  // Lee el journal desde `git show HEAD:...`, nunca del archivo en
  // disco -- un cambio local sin commitear (p. ej. una migración de un
  // feature todavía no aprobado, ver `0010_lively_bug`) infla el
  // conteo del working tree y da una falsa alarma de "pendientes" que
  // no refleja lo que producción realmente tiene desplegado.
  const journalAtHead = execFileSync(
    "git",
    ["show", "HEAD:core/db/migrations/meta/_journal.json"],
    { cwd: import.meta.dirname + "/..", encoding: "utf8" },
  );
  const expectedMigrations = (JSON.parse(journalAtHead) as { entries: unknown[] }).entries.length;

  console.log(
    `  Migraciones: ${appliedMigrations} aplicadas / ${expectedMigrations} esperadas` +
      (appliedMigrations < expectedMigrations ? "  <-- pendientes, revisar el último build" : ""),
  );

  // El pool de `postgres-js` mantiene el proceso vivo -- salida
  // explícita en vez de intentar cerrarlo a través de `db` (drizzle no
  // expone eso de forma estable).
  process.exit(0);
}

main().catch((error) => {
  console.error("FATAL:", error);
  process.exit(1);
});
