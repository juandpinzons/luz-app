import { redirect } from "next/navigation";
import { and, eq, gte, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/core/db/client";
import { env } from "@/core/config/env";
import {
  conversationMessages,
  conversations,
  events,
  users,
} from "@/core/db/schema";

/**
 * Dashboard interno de operación (Sprint de Observabilidad, Alpha).
 * Protegido por email, no por rol — no existe un sistema de roles en
 * el dominio y no vale la pena construir uno para una sola persona.
 * `ADMIN_EMAILS` vacío cierra el acceso para todos por defecto.
 *
 * Server Component: consulta la base directamente, sin pasar por
 * `/api/chat` — es una vista de operación, no un consumidor del
 * dominio de chat.
 */
function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = env.ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}

function startOfTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user || !isAdmin(session.user.email)) {
    redirect("/login");
  }

  const today = startOfTodayUTC();

  const [totalUsers] = await db.select({ count: sql<number>`count(*)` }).from(users);
  const [activeToday] = await db
    .select({ count: sql<number>`count(distinct ${conversationMessages.userId})` })
    .from(conversationMessages)
    .where(gte(conversationMessages.createdAt, today));
  const [totalConversations] = await db
    .select({ count: sql<number>`count(*)` })
    .from(conversations);
  const [totalMessages] = await db
    .select({ count: sql<number>`count(*)` })
    .from(conversationMessages);

  const [avgResponse] = await db
    .select({
      avgMs: sql<number>`avg((${events.metadata}->>'durationMs')::numeric)`,
    })
    .from(events)
    .where(eq(events.type, "message_sent"));

  const [errorsToday] = await db
    .select({ count: sql<number>`count(*)` })
    .from(events)
    .where(and(eq(events.type, "error"), gte(events.createdAt, today)));

  const recentErrors = await db
    .select()
    .from(events)
    .where(eq(events.type, "error"))
    .orderBy(sql`${events.createdAt} desc`)
    .limit(10);

  const buildVersion =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";
  const deploymentUrl = process.env.VERCEL_URL ?? "localhost";

  return (
    <main className="min-h-screen bg-black px-8 py-10 text-white">
      <h1 className="text-2xl font-light tracking-wide">LUZ — Admin</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Build {buildVersion} · {deploymentUrl}
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Usuarios totales" value={totalUsers?.count ?? 0} />
        <Stat label="Activos hoy" value={activeToday?.count ?? 0} />
        <Stat label="Conversaciones" value={totalConversations?.count ?? 0} />
        <Stat label="Mensajes" value={totalMessages?.count ?? 0} />
        <Stat
          label="Tiempo de respuesta prom."
          value={
            avgResponse?.avgMs
              ? `${(Number(avgResponse.avgMs) / 1000).toFixed(1)}s`
              : "—"
          }
        />
        <Stat label="Errores hoy" value={errorsToday?.count ?? 0} />
      </div>

      <h2 className="mt-10 text-lg font-light">Últimos errores</h2>
      <div className="mt-3 space-y-2">
        {recentErrors.length === 0 ? (
          <p className="text-zinc-500">Sin errores registrados.</p>
        ) : (
          recentErrors.map((e) => (
            <div
              key={e.id}
              className="rounded-lg border border-zinc-800 px-4 py-3 text-sm"
            >
              <div className="text-zinc-500">
                {e.createdAt.toISOString()} · {e.route ?? "sin ruta"}
              </div>
              <div className="mt-1 text-red-400">{e.message}</div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-zinc-800 p-4">
      <div className="text-2xl font-light">{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{label}</div>
    </div>
  );
}
