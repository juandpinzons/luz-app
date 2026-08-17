import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { accountIdentities } from "@/auth/schema";
import { db } from "@/core/db/client";
import { persons } from "@/core/db/schema";
import { adminAccessLog } from "@/core/db/schema/admin-access-log";
import { DrizzleLifeGraphRepository } from "@/core/life/repositories/drizzle-life-graph.repository";
import { createEntityId } from "@/core/life/value-objects/entity-id";
import { createRequestId, logger } from "@/core/observability/logger";
import { isAdmin } from "@/app/admin/is-admin";

const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({ justification: z.string().min(10) });

/**
 * Camino de "derecho al olvido" para un tercero mencionado en
 * conversación (auditoría de privacidad, 2026-08-17) -- LUZ-POL-003
 * flagged esto como una categoría de sujeto de datos sin ningún
 * mecanismo de derechos. La persona mencionada no tiene cuenta propia,
 * así que no puede pedirlo ella misma vía la app; esto es lo más
 * honesto que se puede ofrecer hoy: un admin, con justificación
 * obligatoria y registrado en `admin_access_log` (mismo patrón de
 * break-glass que `/admin/users/[id]`), puede borrar el registro de
 * esa persona a pedido.
 *
 * Guard crítico: NUNCA permite borrar el Person que es el dueño
 * (`owner`) de un LifeGraph -- `life_graphs.owner_person_id` usa
 * `onDelete: "set null"` (no cascade), así que borrar al owner por
 * accidente dejaría el LifeGraph con `ownerPersonId: null`, un estado
 * que el dominio no modela (`toLifeGraph()` lanza si lo encuentra) y
 * rompería la cuenta completa. `life_relationships` sí cascadea
 * correctamente desde `persons` (`onDelete: "cascade"` en ambas
 * direcciones), así que no hace falta limpiarlas a mano aquí.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const requestId = createRequestId();
  const startedAt = Date.now();
  const route = "POST /api/admin/persons/[id]/delete";

  const session = await auth();
  if (!session?.user?.id || !session.user.email || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }

  const parsedParams = paramsSchema.safeParse(await params);
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedParams.success || !parsedBody.success) {
    return NextResponse.json(
      { error: "Se requiere un id válido y una justificación de al menos 10 caracteres." },
      { status: 400 },
    );
  }

  const personId = createEntityId(parsedParams.data.id);

  try {
    const [personRow] = await db
      .select({ id: persons.id, lifeGraphId: persons.lifeGraphId })
      .from(persons)
      .where(eq(persons.id, personId))
      .limit(1);

    if (!personRow) {
      return NextResponse.json({ error: "No existe esa persona." }, { status: 404 });
    }

    const lifeGraph = await new DrizzleLifeGraphRepository(db).getById(
      createEntityId(personRow.lifeGraphId),
    );
    if (lifeGraph?.ownerPersonId === personId) {
      return NextResponse.json(
        { error: "No se puede borrar al dueño del LifeGraph por esta vía -- usar borrado de cuenta." },
        { status: 400 },
      );
    }

    const [identity] = await db
      .select({ accountId: accountIdentities.accountId })
      .from(accountIdentities)
      .where(eq(accountIdentities.lifeGraphId, personRow.lifeGraphId))
      .limit(1);

    await db.delete(persons).where(eq(persons.id, personId));

    await db.insert(adminAccessLog).values({
      adminUserId: session.user.id,
      adminEmail: session.user.email,
      // `viewedUserId` es el titular de la cuenta (mismo significado que
      // en /admin/users/[id]), no el tercero borrado -- el tercero no
      // tiene cuenta propia que "ver".
      viewedUserId: identity?.accountId ?? personRow.lifeGraphId,
      justification: `[borrado de tercero ${personId}] ${parsedBody.data.justification}`,
      route,
    });

    logger.log({
      event: "api.request_completed",
      requestId,
      route,
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

    return NextResponse.json({ error: "No se pudo borrar el registro." }, { status: 500 });
  }
}
