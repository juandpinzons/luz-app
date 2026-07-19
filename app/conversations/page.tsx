import Link from "next/link";
import { redirect } from "next/navigation";
import { getUserContext } from "@/auth/user-context";
import { db } from "@/core/db/client";
import { listConversations } from "@/features/conversations/services/list-conversations";

const DATE_FORMAT = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function formatDate(date: Date): string {
  return DATE_FORMAT.format(date);
}

function formatRelativeTime(date: Date): string {
  const diffMinutes = Math.floor((Date.now() - date.getTime()) / 60_000);

  if (diffMinutes < 1) return "hace un momento";
  if (diffMinutes < 60) return `hace ${diffMinutes} min`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "ayer";
  if (diffDays < 30) return `hace ${diffDays} días`;

  const diffMonths = Math.floor(diffDays / 30);
  return `hace ${diffMonths} ${diffMonths === 1 ? "mes" : "meses"}`;
}

/**
 * Historial de conversaciones (Sprint Alpha-1b) — solo lectura, solo
 * lo del usuario autenticado. `listConversations` ya filtra por
 * `userId`; esta página no vuelve a decidir qué mostrar, solo lo
 * presenta.
 */
export default async function ConversationsPage() {
  const context = await getUserContext();

  if (!context) {
    redirect("/login");
  }

  const conversations = await listConversations(db, context);

  return (
    <main className="min-h-screen bg-black px-6 py-10 text-white">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-light tracking-[0.25em]">HISTORIAL</h1>
          <Link
            href="/dashboard"
            className="text-sm text-zinc-500 underline decoration-zinc-700 underline-offset-4 transition hover:text-zinc-300"
          >
            Volver
          </Link>
        </div>

        {conversations.length === 0 ? (
          <p className="mt-16 text-center text-zinc-500">
            Todavía no tienes conversaciones.
          </p>
        ) : (
          <div className="mt-8 space-y-3">
            {conversations.map((conversation) => (
              <Link
                key={conversation.id}
                href={`/conversations/${conversation.id}`}
                className="block rounded-lg border border-zinc-800 px-5 py-4 transition hover:border-zinc-600"
              >
                <p className="text-sm text-zinc-300">
                  {conversation.previewText}
                </p>
                <p className="mt-2 text-xs text-zinc-500">
                  {formatDate(conversation.createdAt)} ·{" "}
                  {conversation.messageCount}{" "}
                  {conversation.messageCount === 1 ? "mensaje" : "mensajes"} ·
                  última actividad{" "}
                  {formatRelativeTime(conversation.lastMessageAt)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
