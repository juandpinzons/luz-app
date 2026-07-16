import { NextResponse } from "next/server";
import { DEMO_USER_ID } from "@/core/db/seed";
import { sendMessage } from "@/features/chat/services/send-message";
import { sendMessageRequestSchema } from "@/features/chat/types";

/**
 * Controlador delgado (decisión CTO #1 y #11): solo parsea/valida la
 * petición y delega en `features/chat`. Ninguna lógica de negocio vive
 * aquí.
 *
 * NOTA: usa `DEMO_USER_ID` porque la autenticación (decisión CTO #9)
 * todavía no está implementada. Reemplazar por el usuario de la sesión
 * en cuanto exista Auth.js.
 */
export async function POST(request: Request): Promise<Response> {
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
      userId: DEMO_USER_ID,
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
