import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getUserContext } from "@/auth/user-context";
import { db } from "@/core/db/client";
import { getConversationDetail } from "@/features/conversations/services/get-conversation-detail";

const conversationIdSchema = z.string().uuid();

/**
 * Detalle de una conversación (Sprint Alpha-1b) — mismo formato visual
 * que `/chat` (mismas clases de burbuja) a propósito, para que se
 * sienta como el mismo hilo y no una vista distinta.
 *
 * Alpha-1b la definió "solo lectura" — sin editar, borrar ni renombrar
 * el historial ya existente, y eso sigue igual. El sprint de
 * conversaciones persistentes agrega "Continuar esta conversación":
 * ya no es un callejón sin salida, se puede retomar donde quedó, vía
 * /chat?conversationId=. Evolución explícita de esa decisión, no una
 * reversión silenciosa.
 *
 * `startedAt` viaja en el mismo enlace (fecha real de esta
 * conversación, ya disponible aquí) porque ni `GET /api/chat` ni
 * `GET /api/conversations/[id]` la exponen — este sprint de UX
 * deliberadamente no toca esas rutas. `/chat` la usa solo para el
 * indicador "Retomando una conversación de..."; si llega a faltar o
 * viene inválida, cae a un texto genérico en vez de romperse.
 *
 * Autorización: `getConversationDetail` devuelve `null` tanto si el id
 * no existe como si existe pero es de otro usuario — en ambos casos
 * esta página responde 404 (`notFound()`), sin distinguir el motivo,
 * para no revelar si la conversación de alguien más existe. Un `id`
 * que ni siquiera tiene forma de UUID también cae en 404 antes de
 * tocar la base de datos (evita un error 500 de Postgres por tipo
 * inválido en la columna `uuid`).
 */
export default async function ConversationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await getUserContext();

  if (!context) {
    redirect("/login");
  }

  const { id } = await params;
  const parsedId = conversationIdSchema.safeParse(id);

  if (!parsedId.success) {
    notFound();
  }

  const conversation = await getConversationDetail(
    db,
    context,
    parsedId.data,
  );

  if (!conversation) {
    notFound();
  }

  return (
    <main className="flex h-screen flex-col bg-black text-white">
      <header className="flex items-center justify-between border-b border-zinc-800 px-8 py-5">
        <h1 className="text-xl font-light tracking-[0.25em]">LUZ</h1>
        <Link
          href="/conversations"
          className="text-sm text-zinc-500 underline decoration-zinc-700 underline-offset-4 transition hover:text-zinc-300"
        >
          Historial
        </Link>
      </header>

      <section className="min-h-0 flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          {conversation.messages.map((message, index) => (
            <div
              key={index}
              className={
                message.role === "user"
                  ? "ml-auto w-fit max-w-[80%] rounded-2xl bg-white px-5 py-3 text-black"
                  : "mr-auto w-fit max-w-[80%] rounded-2xl bg-zinc-800 px-5 py-3 text-white"
              }
            >
              {message.content}
            </div>
          ))}

          <div className="pt-6 text-center">
            <Link
              href={`/chat?conversationId=${conversation.id}&startedAt=${encodeURIComponent(conversation.createdAt.toISOString())}`}
              className="inline-block rounded-full bg-white px-8 py-3 font-medium text-black transition hover:bg-zinc-200"
            >
              Continuar esta conversación
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
