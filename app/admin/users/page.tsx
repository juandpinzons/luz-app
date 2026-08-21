import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq, sql } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/core/db/client";
import { accountIdentities } from "@/auth/schema";
import { conversationMessages, conversations, memories, users } from "@/core/db/schema";
import { isAdmin } from "../is-admin";
import { requireAdminMfa } from "../require-mfa";

/**
 * Punto de entrada del reporte "qué sabe/recuerda LUZ de cada usuario"
 * (pedido directo del Founder, 2026-08-06 -- ver conversación). Lista
 * liviana con lo mínimo para decidir a quién entrar en detalle; el
 * conocimiento real vive en `/admin/users/[id]`, no aquí.
 */
export default async function AdminUsersPage() {
  const session = await auth();

  if (!session?.user?.id || !isAdmin(session.user.email)) {
    redirect("/login");
  }
  await requireAdminMfa(session.user.id);

  // Antes: un solo query con 3 leftJoin uno-a-muchos (memories,
  // conversations, conversationMessages) sin relación entre sí,
  // agrupado al final -- Postgres calcula el producto cruzado de los
  // tres antes del GROUP BY. Con datos sintéticos (pocas filas) no se
  // notaba; con datos reales (47 usuarios, 210 conversaciones, 1623
  // mensajes -- y la cuenta del Founder con órdenes de magnitud más
  // memorias que cualquier otra) el fan-out multiplicaba a cientos de
  // miles de filas intermedias por usuario, dejando la página sin
  // cargar en la práctica. Subqueries escalares correlacionadas: cada
  // conteo se agrega en su propia tabla, sin cruzarse con las otras.
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
      lifeGraphId: accountIdentities.lifeGraphId,
      memoryCount: sql<number>`(
        select count(*)::int from ${memories}
        where ${memories.lifeGraphId} = ${accountIdentities.lifeGraphId}
      )`,
      conversationCount: sql<number>`(
        select count(*)::int from ${conversations}
        where ${conversations.userId} = ${users.id}
      )`,
      messageCount: sql<number>`(
        select count(*)::int from ${conversationMessages}
        where ${conversationMessages.userId} = ${users.id}
      )`,
      lastMessageAt: sql<string | null>`(
        select max(${conversationMessages.createdAt}) from ${conversationMessages}
        where ${conversationMessages.userId} = ${users.id}
      )`,
    })
    .from(users)
    .leftJoin(accountIdentities, eq(accountIdentities.accountId, users.id))
    .orderBy(desc(users.createdAt));

  return (
    <main className="min-h-screen bg-black px-8 py-10 text-white">
      <div className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-light tracking-wide">
            LUZ — Qué sabe de cada usuario
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {rows.length} usuarios · memoria, conocimiento e interacción real, no lo que LUZ dice de sí misma en el chat
          </p>
        </div>
        <Link
          href="/admin"
          className="rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-600 hover:text-white"
        >
          ← Operación
        </Link>
      </div>

      <div className="mt-8 overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500">
              <th className="px-4 py-3 font-normal">Usuario</th>
              <th className="px-4 py-3 font-normal">Desde</th>
              <th className="px-4 py-3 font-normal">Memorias</th>
              <th className="px-4 py-3 font-normal">Conversaciones</th>
              <th className="px-4 py-3 font-normal">Mensajes</th>
              <th className="px-4 py-3 font-normal">Última actividad</th>
              <th className="px-4 py-3 font-normal" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-zinc-900 last:border-0">
                <td className="px-4 py-3">
                  <div>{row.name ?? "—"}</div>
                  <div className="text-zinc-500">{row.email}</div>
                </td>
                <td className="px-4 py-3 text-zinc-400">
                  {row.createdAt.toISOString().slice(0, 10)}
                </td>
                <td className="px-4 py-3">{row.memoryCount}</td>
                <td className="px-4 py-3">{row.conversationCount}</td>
                <td className="px-4 py-3">{row.messageCount}</td>
                <td className="px-4 py-3 text-zinc-400">
                  {row.lastMessageAt
                    ? new Date(row.lastMessageAt).toISOString().slice(0, 16).replace("T", " ")
                    : "sin mensajes"}
                </td>
                <td className="px-4 py-3">
                  {row.lifeGraphId ? (
                    <Link
                      href={`/admin/users/${row.id}`}
                      className="text-zinc-300 underline hover:text-white"
                    >
                      Ver todo →
                    </Link>
                  ) : (
                    <span className="text-zinc-600">sin LifeGraph</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
