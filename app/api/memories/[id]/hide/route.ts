import { NextResponse } from "next/server";
import { z } from "zod";
import { getLifeGraphContext } from "@/auth/user-context";
import { db } from "@/core/db/client";
import { createEntityId } from "@/core/life";
import { DrizzleMemoryRepository } from "@/core/memory-engine";
import { createRequestId, logger } from "@/core/observability/logger";
import { recordEvent } from "@/core/observability/record-event";

const memoryIdSchema = z.string().uuid();
const bodySchema = z.object({ hidden: z.boolean() });

/**
 * Segunda capa de memoria (auditoría de arquitectura, 2026-08-16):
 * oculta/muestra una memoria de las pantallas de la persona
 * (`/memories`, `/dashboard`, `/life`) sin que LUZ deje de saberla —
 * ver `core/db/schema/memory.ts`, columna `hidden_from_user`. Nunca
 * borra nada, siempre reversible desde `?view=hidden` en `/memories`.
 *
 * Mismo patrón de ownership que `GET /api/conversations/[id]`:
 * `MemoryRepository.getById()` ya escopa por `lifeGraphId`, así que un
 * id que no existe y un id de otra persona caen en el mismo 404, sin
 * distinguir el motivo. POST siempre, mismo criterio que el resto de
 * la app (cero rutas PATCH/PUT/DELETE reales hoy).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = createRequestId();
  const startedAt = Date.now();
  const route = "POST /api/memories/[id]/hide";

  const context = await getLifeGraphContext();
  if (!context) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const parsedId = memoryIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Recuerdo no encontrado." }, { status: 404 });
  }

  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Falta el campo 'hidden'." }, { status: 400 });
  }

  try {
    const memoryRepository = new DrizzleMemoryRepository(db);
    const memoryId = createEntityId(parsedId.data);
    const existing = await memoryRepository.getById(context, memoryId);

    if (!existing) {
      return NextResponse.json({ error: "Recuerdo no encontrado." }, { status: 404 });
    }

    await memoryRepository.setHiddenFromUser(context, memoryId, parsedBody.data.hidden);

    logger.log({
      event: "api.request_completed",
      requestId,
      route,
      memoryId,
      hidden: parsedBody.data.hidden,
      status: 200,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({ ok: true, hidden: parsedBody.data.hidden });
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
    await recordEvent(db, { type: "error", route, message });

    return NextResponse.json({ error: "No se pudo actualizar el recuerdo." }, { status: 500 });
  }
}
