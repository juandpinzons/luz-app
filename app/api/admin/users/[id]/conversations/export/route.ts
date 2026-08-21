import { NextResponse } from "next/server";
import { z } from "zod";
import { asc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/core/db/client";
import { adminAccessLog, conversationMessages, conversations, users } from "@/core/db/schema";
import { decryptContent } from "@/core/security/content-cipher";
import { createRequestId, logger } from "@/core/observability/logger";
import { isAdmin } from "@/app/admin/is-admin";
import { requireAdminMfa } from "@/app/admin/require-mfa";

const paramsSchema = z.object({ id: z.string().uuid() });

/**
 * Descarga de transcripciones completas y descifradas de una persona --
 * extensión de `/admin/users/[id]` (break-glass, ADR-0024 Decisión 3).
 * La página de detalle ya muestra título/categoría/conteo por
 * conversación sin descifrar nada; esta ruta es el paso explícito
 * siguiente que sí lee `content` en texto plano, así que lleva su
 * propio registro en `admin_access_log` (ruta distinta a la de la
 * página) -- nunca reutiliza el insert de la página para no perder
 * trazabilidad de que el contenido crudo, no solo el resumen, fue
 * leído. Mismo gate que el resto de `/admin/*`: isAdmin + MFA +
 * justificación obligatoria, registrada ANTES de descifrar nada.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = createRequestId();
  const startedAt = Date.now();
  const route = "GET /api/admin/users/[id]/conversations/export";

  const session = await auth();
  if (!session?.user?.id || !session.user.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  await requireAdminMfa(session.user.id);

  const parsedParams = paramsSchema.safeParse(await params);
  const justification = new URL(request.url).searchParams.get("justification")?.trim();
  if (!parsedParams.success || !justification || justification.length < 10) {
    return NextResponse.json(
      { error: "Se requiere un id válido y una justificación de al menos 10 caracteres." },
      { status: 400 },
    );
  }
  const userId = parsedParams.data.id;

  try {
    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) {
      return NextResponse.json({ error: "No existe esa persona." }, { status: 404 });
    }

    // Registrado ANTES de descifrar cualquier mensaje -- si este insert
    // falla, la petición falla con él, nunca hay lectura sin bitácora.
    await db.insert(adminAccessLog).values({
      adminUserId: session.user.id,
      adminEmail: session.user.email,
      viewedUserId: userId,
      justification: `[export de transcripciones] ${justification}`,
      route,
    });

    const userConversations = await db
      .select()
      .from(conversations)
      .where(eq(conversations.userId, userId))
      .orderBy(asc(conversations.createdAt));

    const exportedConversations = [];
    for (const conv of userConversations) {
      const messages = await db
        .select()
        .from(conversationMessages)
        .where(eq(conversationMessages.conversationId, conv.id))
        .orderBy(asc(conversationMessages.createdAt));

      exportedConversations.push({
        id: conv.id,
        title: conv.title,
        category: conv.category,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        messages: messages.map((m) => ({
          id: m.id,
          role: m.role,
          content: decryptContent(m.content),
          hasImage: m.imageData != null,
          createdAt: m.createdAt,
        })),
      });
    }

    logger.log({
      event: "api.request_completed",
      requestId,
      route,
      status: 200,
      durationMs: Date.now() - startedAt,
    });

    const payload = JSON.stringify(
      {
        user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt },
        exportedAt: new Date().toISOString(),
        exportedByAdminEmail: session.user.email,
        justification,
        conversationCount: exportedConversations.length,
        messageCount: exportedConversations.reduce((sum, c) => sum + c.messages.length, 0),
        conversations: exportedConversations,
      },
      null,
      2,
    );

    return new NextResponse(payload, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="luz-export-${userId}-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.log({
      event: "api.request_failed",
      severity: "error",
      requestId,
      route,
      status: 500,
      durationMs: Date.now() - startedAt,
      error: message,
    });
    return NextResponse.json({ error: "No se pudo exportar la conversación." }, { status: 500 });
  }
}
