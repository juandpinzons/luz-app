import { NextResponse } from "next/server";
import { z } from "zod";
import { getLifeGraphContext } from "@/auth/user-context";
import { db } from "@/core/db/client";
import { createEntityId } from "@/core/life";
import { DrizzleMemoryRepository } from "@/core/memory-engine";
import { createRequestId, logger } from "@/core/observability/logger";
import { recordEvent } from "@/core/observability/record-event";

const memoryIdSchema = z.string().uuid();

/**
 * Borrado real (auditoría de arquitectura, 2026-08-16) -- a diferencia
 * de `hide`, esto es irreversible: `MemoryRepository.delete()`
 * (`core/memory-engine/repositories/drizzle-memory.repository.ts`) ya
 * existía, escopado y probado, sin ningún llamador real hasta ahora.
 * Mismo patrón de ownership que `hide`/`GET /api/conversations/[id]`
 * -- `getById()` antes de borrar, nunca un DELETE ciego por id.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = createRequestId();
  const startedAt = Date.now();
  const route = "POST /api/memories/[id]/delete";

  const context = await getLifeGraphContext();
  if (!context) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const { id } = await params;
  const parsedId = memoryIdSchema.safeParse(id);
  if (!parsedId.success) {
    return NextResponse.json({ error: "Recuerdo no encontrado." }, { status: 404 });
  }

  try {
    const memoryRepository = new DrizzleMemoryRepository(db);
    const memoryId = createEntityId(parsedId.data);
    const existing = await memoryRepository.getById(context, memoryId);

    if (!existing) {
      return NextResponse.json({ error: "Recuerdo no encontrado." }, { status: 404 });
    }

    await memoryRepository.delete(context, memoryId);

    logger.log({
      event: "api.request_completed",
      requestId,
      route,
      memoryId,
      status: 200,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({ ok: true });
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

    return NextResponse.json({ error: "No se pudo eliminar el recuerdo." }, { status: 500 });
  }
}
