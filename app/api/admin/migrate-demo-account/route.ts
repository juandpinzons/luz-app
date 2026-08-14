import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { conversations, memories, users } from "@/core/db/schema";
import { accountIdentities } from "@/auth/schema";
import { createEntityId } from "@/core/life/value-objects/entity-id";
import type { LifeGraphContext } from "@/core/life/life-graph-context";

/**
 * HERRAMIENTA DE EMERGENCIA, DE UN SOLO USO -- Colombia Tech Week,
 * 2026-08-14. Copia la memoria "positiva" real de una cuenta a una
 * cuenta demo nueva (ya logueada, para que su LifeGraph exista),
 * excluyendo lo ya marcado `suppressed` y cualquier memoria que
 * contenga una palabra clave de la lista de bloqueo de abajo. Existe
 * porque el Founder solo tiene el teléfono en mano (sin terminal) y la
 * `DATABASE_URL` de producción es una variable "Sensitive" de Vercel,
 * ilegible incluso vía `vercel env pull` -- esta ruta corre DENTRO del
 * runtime de Vercel, que sí la tiene resuelta.
 *
 * BORRAR ESTE ARCHIVO apenas termine el evento -- no es un endpoint
 * admin permanente, es un parche de una noche.
 */
export const maxDuration = 60;

const SEED_TOKEN = "c6d3cd894c637d8f6aa528c3cefcb1f7852a275ec4f87e76";

/**
 * Aproximación por palabra clave a "no es positivo" -- no reemplaza
 * una revisión humana, es la mejor defensa posible bajo la ventana de
 * tiempo real (evento en curso). Incluye los términos ya confirmados
 * en el incidente en vivo (keta, empeñar, cadena, pulsera) más un
 * colchón de riesgo genérico.
 */
const SENSITIVE_KEYWORDS = [
  "keta",
  "ketamina",
  "empeñ",
  "empen",
  "cadena",
  "pulsera",
  "droga",
  "cocain",
  "cocaín",
  "trauma",
  "suicid",
  "autolesi",
];

function containsSensitiveKeyword(content: string): boolean {
  const lower = content.toLowerCase();
  return SENSITIVE_KEYWORDS.some((keyword) => lower.includes(keyword));
}

async function resolveAccount(
  email: string,
): Promise<{ userId: string; context: LifeGraphContext } | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) return null;

  const [identity] = await db
    .select()
    .from(accountIdentities)
    .where(eq(accountIdentities.accountId, user.id))
    .limit(1);
  if (!identity) return null;

  return {
    userId: user.id,
    context: {
      lifeGraphId: createEntityId(identity.lifeGraphId),
      personId: createEntityId(identity.personId),
    },
  };
}

export async function POST(request: Request) {
  if (request.headers.get("x-seed-token") !== SEED_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { sourceEmail?: string; targetEmail?: string }
    | null;
  if (!body?.sourceEmail || !body?.targetEmail) {
    return NextResponse.json({ error: "sourceEmail y targetEmail son requeridos" }, { status: 400 });
  }

  const source = await resolveAccount(body.sourceEmail);
  if (!source) {
    return NextResponse.json({ error: `sin cuenta/LifeGraph: ${body.sourceEmail}` }, { status: 404 });
  }

  const target = await resolveAccount(body.targetEmail);
  if (!target) {
    return NextResponse.json(
      { error: `sin cuenta/LifeGraph: ${body.targetEmail} -- esa cuenta debe iniciar sesión en la app al menos una vez primero` },
      { status: 404 },
    );
  }

  const sourceMemories = await db
    .select()
    .from(memories)
    .where(
      and(
        eq(memories.lifeGraphId, source.context.lifeGraphId),
        eq(memories.status, "active"),
        eq(memories.suppressed, false),
      ),
    );

  const safeMemories = sourceMemories.filter((row) => !containsSensitiveKeyword(row.content));
  const skippedForKeyword = sourceMemories.length - safeMemories.length;

  const now = new Date();
  if (safeMemories.length > 0) {
    await db.insert(memories).values(
      safeMemories.map((row) => ({
        lifeGraphId: target.context.lifeGraphId,
        personId: null,
        type: row.type,
        content: row.content,
        source: row.source,
        sourceId: null,
        status: "active" as const,
        suppressed: false,
        rankScore: row.rankScore,
        rankedAt: row.rankedAt,
        occurredAt: row.occurredAt,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }

  // Solo el CONTEO importa para el stat de "conversaciones" del
  // dashboard -- título/categoría nunca se copian (podrían contener el
  // mismo tipo de contenido sensible que una memoria), y no se copian
  // mensajes: nadie navega a leer transcripciones viejas en un demo en
  // vivo, y hacerlo bien (filtrar mensaje por mensaje) no cabe en esta
  // ventana de tiempo.
  const sourceConversations = await db
    .select({ createdAt: conversations.createdAt, updatedAt: conversations.updatedAt })
    .from(conversations)
    .where(eq(conversations.userId, source.userId));

  if (sourceConversations.length > 0) {
    await db.insert(conversations).values(
      sourceConversations.map((row) => ({
        userId: target.userId,
        title: null,
        category: null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
    );
  }

  const earliestDate = safeMemories
    .map((row) => row.occurredAt ?? row.createdAt)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return NextResponse.json({
    memoriesCopied: safeMemories.length,
    memoriesSkippedForSensitiveKeyword: skippedForKeyword,
    conversationsReplicated: sourceConversations.length,
    earliestMemoryDate: earliestDate ?? null,
  });
}
