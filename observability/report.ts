import { execFileSync } from "node:child_process";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "../core/db/client";
import { events } from "../core/db/schema/events";
import { knowledgeJobs } from "../core/db/schema/jobs";

/**
 * Reporte de operación, no un dashboard -- responde directo las
 * preguntas de `docs/engineering/OBSERVABILITY_PLAN.md` ("consumir,
 * no solo emitir"), nunca un volcado genérico de datos. Ninguna
 * consulta escribe nada (todo `select`), a diferencia de `smoke/` --
 * correr esto contra datos locales de desarrollo casi no sirve, el
 * punto es ver tráfico real.
 *
 * `npm run obs:report` -- ventana de 24h por defecto.
 * `npm run obs:report -- --hours 6` -- otra ventana.
 * `npm run obs:report -- --since-deploy` -- desde el último commit en
 * `main` (proxy razonable de "desde el último deploy": este repo
 * despliega en cada push, ver DEPLOY_RUNBOOK.md). Cada modo compara
 * contra el período inmediatamente anterior de la misma duración --
 * "tendencia" sin necesitar guardar estado entre corridas.
 */

const BACKGROUND_ROUTES = ["background.title", "background.life_capture"];

function lastCommitTimestamp(): Date {
  const iso = execFileSync("git", ["log", "-1", "--format=%cI"], {
    cwd: import.meta.dirname + "/..",
    encoding: "utf8",
  }).trim();
  return new Date(iso);
}

function parseWindow(argv: string[]): { since: Date; label: string } {
  if (argv.includes("--since-deploy")) {
    const since = lastCommitTimestamp();
    return { since, label: `desde el último commit en main (${since.toISOString()})` };
  }
  const idx = argv.indexOf("--hours");
  const hours = idx === -1 ? 24 : Number(argv[idx + 1]);
  const validHours = Number.isFinite(hours) && hours > 0 ? hours : 24;
  const since = new Date(Date.now() - validHours * 60 * 60 * 1000);
  return { since, label: `últimas ${validHours}h (desde ${since.toISOString()})` };
}

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function fmtMs(value: number | null): string {
  return value === null ? "sin datos" : `${value}ms`;
}

function trend(current: number, previous: number): string {
  if (previous === 0 && current === 0) return "sin cambio";
  if (previous === 0) return `nuevo (antes 0)`;
  const deltaPct = ((current - previous) / previous) * 100;
  const sign = deltaPct > 0 ? "+" : "";
  return `${sign}${deltaPct.toFixed(0)}% vs. período anterior (${previous})`;
}

interface WindowMetrics {
  messageSentCount: number;
  errorsByRoute: { route: string | null; message: string | null; n: number }[];
  totalDurations: number[];
  firstTokenDurations: number[];
}

async function loadWindow(since: Date, until: Date): Promise<WindowMetrics> {
  const [messageSent] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.type, "message_sent"), gte(events.createdAt, since), lt(events.createdAt, until)));

  const errorsByRoute = await db
    .select({ route: events.route, message: events.message, n: sql<number>`count(*)::int` })
    .from(events)
    .where(and(eq(events.type, "error"), gte(events.createdAt, since), lt(events.createdAt, until)))
    .groupBy(events.route, events.message)
    .orderBy(sql`count(*) desc`);

  const messageSentRows = await db
    .select({ metadata: events.metadata })
    .from(events)
    .where(and(eq(events.type, "message_sent"), gte(events.createdAt, since), lt(events.createdAt, until)));

  const totalDurations = messageSentRows
    .map((r) => (r.metadata as { durationMs?: number } | null)?.durationMs)
    .filter((v): v is number => typeof v === "number")
    .sort((a, b) => a - b);
  const firstTokenDurations = messageSentRows
    .map((r) => (r.metadata as { firstTokenMs?: number } | null)?.firstTokenMs)
    .filter((v): v is number => typeof v === "number")
    .sort((a, b) => a - b);

  return { messageSentCount: messageSent.n, errorsByRoute, totalDurations, firstTokenDurations };
}

function chatErrorCount(m: WindowMetrics): number {
  return m.errorsByRoute
    .filter((e) => e.route === "POST /api/chat")
    .reduce((sum, e) => sum + e.n, 0);
}

function successRate(m: WindowMetrics): number | null {
  const total = m.messageSentCount + chatErrorCount(m);
  return total > 0 ? (m.messageSentCount / total) * 100 : null;
}

async function main() {
  const argv = process.argv.slice(2);
  const { since, label } = parseWindow(argv);
  const windowMs = Date.now() - since.getTime();
  const previousSince = new Date(since.getTime() - windowMs);

  const current = await loadWindow(since, new Date());
  const previous = await loadWindow(previousSince, since);

  console.log(`Reporte de observabilidad -- ${label}\n`);

  // 1. ¿Hubo errores nuevos desde el último deploy/ventana?
  console.log("1. ¿Errores nuevos?");
  if (current.errorsByRoute.length === 0) {
    console.log("   Ninguno.");
  }
  for (const e of current.errorsByRoute) {
    const wasBefore = previous.errorsByRoute.some(
      (p) => p.route === e.route && p.message === e.message,
    );
    console.log(
      `   ${e.n}x ${e.route ?? "(sin route)"} -- ${e.message ?? "(sin mensaje)"}` +
        (wasBefore ? "" : "  <-- NUEVO, no estaba en el período anterior"),
    );
  }

  // 2. Latencia al primer token
  const p50First = percentile(current.firstTokenDurations, 50);
  const p95First = percentile(current.firstTokenDurations, 95);
  console.log("\n2. ¿P50/P95 de latencia al primer token?");
  console.log(
    `   P50: ${fmtMs(p50First)}, P95: ${fmtMs(p95First)} (n=${current.firstTokenDurations.length}, solo streaming)`,
  );

  // 3. Fallos de background jobs
  const currentBg = current.errorsByRoute.filter((e) => e.route && BACKGROUND_ROUTES.includes(e.route));
  const previousBg = previous.errorsByRoute.filter((e) => e.route && BACKGROUND_ROUTES.includes(e.route));
  const currentBgTotal = currentBg.reduce((s, e) => s + e.n, 0);
  const previousBgTotal = previousBg.reduce((s, e) => s + e.n, 0);
  console.log("\n3. ¿Qué background job falló y cuántas veces?");
  if (currentBg.length === 0) {
    console.log("   Ninguno.");
  }
  for (const f of currentBg) {
    console.log(`   ${f.n}x ${f.route} -- ${f.message ?? "(sin mensaje)"}`);
  }
  if (currentBg.length > 0) {
    console.log(`   Total: ${trend(currentBgTotal, previousBgTotal)}`);
  }

  // 4. ¿Endpoint con tasa de fallo anormal?
  console.log("\n4. ¿Algún endpoint con tasa de fallo anormal?");
  const rate = successRate(current);
  console.log(
    `   POST /api/chat -- tasa de éxito: ${rate === null ? "sin datos" : rate.toFixed(1) + "%"}` +
      (rate !== null && rate < 99 ? "  <-- por debajo del umbral (99%)" : ""),
  );
  const otherRoutes = new Map<string, number>();
  for (const e of current.errorsByRoute) {
    if (e.route && e.route !== "POST /api/chat") {
      otherRoutes.set(e.route, (otherRoutes.get(e.route) ?? 0) + e.n);
    }
  }
  if (otherRoutes.size === 0) {
    console.log("   Otras rutas: sin errores.");
  }
  for (const [route, n] of otherRoutes) {
    const prevN = previous.errorsByRoute
      .filter((e) => e.route === route)
      .reduce((s, e) => s + e.n, 0);
    console.log(`   ${route}: ${n} errores -- ${trend(n, prevN)}`);
  }
  console.log(
    "   (sin conteo de requests totales para rutas fuera de /api/chat -- solo error absoluto + tendencia, no una tasa)",
  );

  // 5. Tendencia general vs. período anterior
  console.log("\n5. ¿Tendencia general vs. el período anterior (misma duración)?");
  console.log(`   Mensajes completados: ${trend(current.messageSentCount, previous.messageSentCount)}`);
  console.log(`   Errores en /api/chat: ${trend(chatErrorCount(current), chatErrorCount(previous))}`);
  const p50Total = percentile(current.totalDurations, 50);
  const prevP50Total = percentile(previous.totalDurations, 50);
  console.log(
    `   P50 duración total: ${fmtMs(p50Total)} vs. período anterior ${fmtMs(prevP50Total)}`,
  );

  // Contexto adicional (no una pregunta operativa nueva, ya cubierto en OBSERVABILITY_PLAN.md)
  const knowledgeJobStatus = await db
    .select({ status: knowledgeJobs.status, n: sql<number>`count(*)::int` })
    .from(knowledgeJobs)
    .groupBy(knowledgeJobs.status);
  console.log(
    "\nKnowledge Engine jobs por estado (informativo -- P1-1 documenta que falla a propósito hoy, sin alerta):",
  );
  for (const row of knowledgeJobStatus) {
    console.log(`  ${row.status}: ${row.n}`);
  }

  const [{ n: appliedMigrations }] = await db
    .execute<{ n: number }>(sql`select count(*)::int as n from drizzle.__drizzle_migrations`)
    .then((r) => r as unknown as { n: number }[]);
  // Lee el journal desde `git show HEAD:...`, nunca del archivo en
  // disco. El objetivo de esta comprobación es comparar producción
  // contra el estado REALMENTE VERSIONADO (lo que un deploy desde
  // `main` aplicaría), no contra el working tree local -- un cambio
  // sin commitear (p. ej. una migración de un feature todavía no
  // aprobado, ver `0010_lively_bug`) nunca debe poder inflar este
  // conteo y disparar una falsa alarma de "pendientes". Esta
  // distinción (versionado vs. local) es la razón del diseño, no un
  // detalle incidental -- ver DEPLOY_RUNBOOK.md.
  const journalAtHead = execFileSync(
    "git",
    ["show", "HEAD:core/db/migrations/meta/_journal.json"],
    { cwd: import.meta.dirname + "/..", encoding: "utf8" },
  );
  const expectedMigrations = (JSON.parse(journalAtHead) as { entries: unknown[] }).entries.length;
  console.log(
    `Migraciones: ${appliedMigrations} aplicadas / ${expectedMigrations} esperadas (según git HEAD)` +
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
