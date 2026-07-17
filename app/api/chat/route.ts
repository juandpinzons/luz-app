import { NextResponse } from "next/server";
import { getLifeGraphContext, getUserContext } from "@/auth/user-context";
import { sendMessage } from "@/features/chat/services/send-message";
import { sendMessageRequestSchema } from "@/features/chat/types";

/**
 * Controlador delgado (decisión CTO #1 y #11): solo resuelve la
 * identidad, parsea/valida la petición y delega en `features/chat`.
 * Ninguna lógica de negocio vive aquí.
 *
 * El middleware (`middleware.ts`) ya bloquea esta ruta sin sesión, pero
 * se vuelve a comprobar aquí: una ruta nunca debe asumir que el
 * middleware es la única línea de defensa.
 */
export async function POST(request: Request): Promise<Response> {
  const context = await getUserContext();

  if (!context) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  // Resuelve (y bootstrapea si hace falta) el LifeGraphContext de esta
  // Account. Nada más abajo lo usa todavía —Milestone 1 termina en
  // identidad resuelta, consumirla es un milestone aparte— así que un
  // fallo aquí nunca debe romper el chat existente.
  try {
    await getLifeGraphContext();
  } catch (error) {
    console.error(
      "[api/chat] no se pudo resolver LifeGraphContext:",
      error,
    );
  }

  const body: unknown = await request.json();
  const parsed = sendMessageRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Solicitud inválida." },
      { status: 400 },
    );
  }

  try {
    const result = await sendMessage({
      context,
      conversationId: parsed.data.conversationId,
      message: parsed.data.message,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/chat] error:", error);

    return NextResponse.json(
      { error: "No se pudo procesar el mensaje." },
      { status: 500 },
    );
  }
}
