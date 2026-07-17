import { NextResponse } from "next/server";
import { getLifeGraphContext, getUserContext } from "@/auth/user-context";
import { sendMessage } from "@/features/chat/services/send-message";
import { sendMessageRequestSchema } from "@/features/chat/types";
import type { LifeGraphContext } from "@/core/life/life-graph-context";

/**
 * Respuestas reales medidas en producción llegan hasta ~22s (mensajes
 * largos/complejos) — el límite por defecto de Vercel (10s) las corta a
 * mitad de camino. 60s es el máximo permitido en el plan Hobby.
 */
export const maxDuration = 60;

/**
 * Controlador delgado (decisión CTO #1 y #11): solo resuelve la
 * identidad, parsea/valida la petición y delega en `features/chat`.
 * Ninguna lógica de negocio vive aquí.
 *
 * El proxy (`proxy.ts`, antes `middleware.ts` — renombrado en Next.js
 * 16) ya bloquea esta ruta sin sesión, pero se vuelve a comprobar aquí:
 * una ruta nunca debe asumir que el proxy es la única línea de defensa.
 */
export async function POST(request: Request): Promise<Response> {
  const context = await getUserContext();

  if (!context) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  // Resuelve (y bootstrapea si hace falta) el LifeGraphContext de esta
  // Account. Desde Beta 1 Sprint B1, `sendMessage` lo usa para capturar
  // Memory real — pero sigue siendo tolerante a fallos: si esto no se
  // resuelve, el chat continúa igual, solo sin captura de Memory.
  let lifeGraphContext: LifeGraphContext | null = null;
  try {
    lifeGraphContext = await getLifeGraphContext();
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
      lifeGraphContext,
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
