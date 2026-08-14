import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/core/db/client";
import { conversations, lifeRelationships, memories, users } from "@/core/db/schema";
import { accountIdentities } from "@/auth/schema";
import { createEntityId } from "@/core/life/value-objects/entity-id";
import type { LifeGraphContext } from "@/core/life/life-graph-context";
import { GarminProvider } from "@/features/reality/providers/garmin";
import { importWearableExport } from "@/features/reality/application/import-wearable-export";
import { createMemoryEngine, type MemoryCaptureInput } from "@/core/memory-engine";
import { DrizzleBeliefRepository, type Belief } from "@/core/belief-engine";
import { DrizzleConceptRepository, type Concept } from "@/core/concept-graph";
import { DrizzleInsightRepository, type Insight } from "@/core/knowledge-engine";
import {
  DrizzleGoalRepository,
  DrizzleProjectRepository,
  DrizzleRelationshipRepository,
  findOrCreateGoal,
  findOrCreateProject,
  findOrCreateHabit,
  findOrCreateRelationship,
  type RelationshipType,
} from "@/core/life";

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

function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

/**
 * Semana sintética y sana, con un bajón real de sueño el día antes de
 * la presentación -- narrativa auténtica para el demo, no alarmante
 * ("dormí poco, pero no estoy ansioso, estoy listo"). Mismos datos que
 * `.scratch/seed-demo-account.ts`, reimplementados aquí porque esta
 * ruta corre en el runtime de Vercel, no localmente.
 */
function SYNTHETIC_WEARABLE_WEEK() {
  return [
    { calendarDate: isoDaysAgo(6), steps: 8500, restingHeartRate: 58, averageStressLevel: 30, sleepTimeSeconds: 420 * 60 },
    { calendarDate: isoDaysAgo(5), steps: 9200, restingHeartRate: 57, averageStressLevel: 28, sleepTimeSeconds: 410 * 60 },
    { calendarDate: isoDaysAgo(4), steps: 7800, restingHeartRate: 59, averageStressLevel: 35, sleepTimeSeconds: 400 * 60 },
    { calendarDate: isoDaysAgo(3), steps: 10200, restingHeartRate: 56, averageStressLevel: 25, sleepTimeSeconds: 430 * 60 },
    { calendarDate: isoDaysAgo(2), steps: 6500, restingHeartRate: 60, averageStressLevel: 45, sleepTimeSeconds: 380 * 60 },
    { calendarDate: isoDaysAgo(1), steps: 5200, restingHeartRate: 63, averageStressLevel: 58, sleepTimeSeconds: 330 * 60 },
    { calendarDate: isoDaysAgo(0), steps: 4100, restingHeartRate: 60, averageStressLevel: 48, sleepTimeSeconds: 340 * 60 },
  ];
}

/**
 * Siembra directa de las ramas de `/life` que solo se llenan vía
 * procesamiento asíncrono real (Belief/Concept/Insight -- Knowledge
 * Engine) o captura explícita (Goal/Project/Habit/Relationship) --
 * ninguna de las dos corre sobre las memorias insertadas en bloque más
 * arriba. Sin esto, la cuenta demo se ve con "Recuerdos: 275" y todo
 * lo demás en 0, y la estrategia de conversación (`buildContinuityLine`)
 * repite siempre la misma apertura por falta de señal real donde elegir.
 * Contenido genérico/positivo, coherente con las memorias ya sembradas
 * (constancia al correr, lectura de Zero to One, llamadas familiares,
 * nervios antes de presentar).
 */
async function seedUnderstanding(context: LifeGraphContext) {
  const now = new Date();
  const conceptRepo = new DrizzleConceptRepository(db);
  const beliefRepo = new DrizzleBeliefRepository(db);
  const insightRepo = new DrizzleInsightRepository(db);

  const concepts: Omit<Concept, "id">[] = [
    { lifeGraphId: context.lifeGraphId, label: "Disciplina", domain: "health", createdAt: now, updatedAt: now },
    { lifeGraphId: context.lifeGraphId, label: "Curiosidad", domain: "personal_growth", createdAt: now, updatedAt: now },
    { lifeGraphId: context.lifeGraphId, label: "Resiliencia", domain: "career", createdAt: now, updatedAt: now },
  ];
  for (const concept of concepts) {
    await conceptRepo.save(context, { ...concept, id: createEntityId(crypto.randomUUID()) });
  }

  const beliefs: Omit<Belief, "id">[] = [
    {
      lifeGraphId: context.lifeGraphId,
      subjectPersonId: context.personId,
      statement: "Prioriza el crecimiento personal incluso cuando compite con el descanso inmediato.",
      domain: "personal_growth",
      category: "life_domain",
      status: "active",
      confidence: { score: 68, assignedAt: now },
      firstObservedAt: now,
      lastReinforcedAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      lifeGraphId: context.lifeGraphId,
      subjectPersonId: context.personId,
      statement: "El vínculo con su familia es un ancla estable en medio de la presión de emprender.",
      domain: "relationships",
      category: "life_domain",
      status: "active",
      confidence: { score: 72, assignedAt: now },
      firstObservedAt: now,
      lastReinforcedAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      lifeGraphId: context.lifeGraphId,
      subjectPersonId: context.personId,
      statement: "Se exige mucho a sí mismo antes de los momentos que más le importan.",
      domain: "career",
      category: "life_domain",
      status: "active",
      confidence: { score: 65, assignedAt: now },
      firstObservedAt: now,
      lastReinforcedAt: now,
      createdAt: now,
      updatedAt: now,
    },
  ];
  for (const belief of beliefs) {
    await beliefRepo.save(context, { ...belief, id: createEntityId(crypto.randomUUID()) });
  }

  const insights: Omit<Insight, "id">[] = [
    {
      lifeGraphId: context.lifeGraphId,
      type: "pattern",
      description: "Corre tres veces por semana de forma consistente, siempre temprano en la mañana.",
      confidence: { score: 70, assignedAt: now },
      status: "validated",
      createdAt: now,
      updatedAt: now,
      validatedAt: now,
    },
    {
      lifeGraphId: context.lifeGraphId,
      type: "preference",
      description: "Cocinar los domingos es su forma preferida de desconectarse antes de una semana exigente.",
      confidence: { score: 62, assignedAt: now },
      status: "validated",
      createdAt: now,
      updatedAt: now,
      validatedAt: now,
    },
    {
      lifeGraphId: context.lifeGraphId,
      type: "fact",
      description: "Está preparando el pitch y la ronda pre-seed de LUZ en paralelo a Colombia Tech Week.",
      confidence: { score: 75, assignedAt: now },
      status: "validated",
      createdAt: now,
      updatedAt: now,
      validatedAt: now,
    },
    {
      lifeGraphId: context.lifeGraphId,
      type: "recommendation",
      description: "Un ritual corto de descompresión (respiración, meditación breve) antes de dormir podría ayudarle en semanas de alta exigencia.",
      confidence: { score: 58, assignedAt: now },
      status: "validated",
      createdAt: now,
      updatedAt: now,
      validatedAt: now,
    },
  ];
  for (const insight of insights) {
    await insightRepo.save(context, { ...insight, id: createEntityId(crypto.randomUUID()) });
  }

  const goalRepo = new DrizzleGoalRepository(db);
  const projectRepo = new DrizzleProjectRepository(db);

  await findOrCreateGoal(db, context, { title: "Cerrar la ronda pre-seed de LUZ", domain: "finances" });
  await findOrCreateGoal(db, context, { title: "Correr una media maratón antes de fin de año", domain: "health" });
  const goalCompleted = await findOrCreateGoal(db, context, { title: "Terminar la arquitectura V1 del producto", domain: "career" });
  await goalRepo.update(context, goalCompleted.id, { status: "completed" });

  await findOrCreateProject(db, context, { title: "Beta pública de LUZ", domain: "career" });
  const projectCompleted = await findOrCreateProject(db, context, { title: "Preparar el pitch de Colombia Tech Week", domain: "career" });
  await projectRepo.update(context, projectCompleted.id, { status: "completed" });

  await findOrCreateHabit(db, context, { title: "Correr martes, jueves y sábado", domain: "health" });
  await findOrCreateHabit(db, context, { title: "Llamar a la familia los domingos", domain: "relationships" });

  return {
    concepts: concepts.length,
    beliefs: beliefs.length,
    insights: insights.length,
    goals: 3,
    projects: 2,
    habits: 2,
  };
}

/**
 * Reemplaza TODAS las relaciones existentes de la cuenta por esta
 * lista exacta -- a pedido del Founder, nunca se acumula sobre lo que
 * `seedUnderstanding` haya sembrado antes. `type` usa el vocabulario
 * cerrado de `RelationshipType` (no tiene "papá"/"hermano"/
 * "co-founder" como valores propios); el rol específico que pidió se
 * guarda en `notes`, campo real de `Relationship` para exactamente
 * esto.
 */
const REAL_RELATIONSHIPS: { name: string; type: RelationshipType; role: string }[] = [
  { name: "Verónica", type: "partner", role: "Novia" },
  { name: "Alfredo", type: "family", role: "Papá" },
  { name: "Alejandro", type: "colleague", role: "Co-founder" },
  { name: "Juanma", type: "friend", role: "Mejor amigo" },
  { name: "Fernando", type: "colleague", role: "Compañero de trabajo" },
  { name: "Juan Felipe", type: "family", role: "Hermano" },
];

async function seedRelationships(context: LifeGraphContext) {
  await db.delete(lifeRelationships).where(eq(lifeRelationships.lifeGraphId, context.lifeGraphId));

  const relationshipRepo = new DrizzleRelationshipRepository(db);
  for (const entry of REAL_RELATIONSHIPS) {
    const created = await findOrCreateRelationship(db, context, {
      otherPersonName: entry.name,
      type: entry.type,
    });
    await relationshipRepo.update(context, created.id, { notes: entry.role });
  }

  return { relationships: REAL_RELATIONSHIPS.length };
}

/**
 * Memorias que nombran explícitamente a las personas reales de
 * `REAL_RELATIONSHIPS` -- material concreto y variado para que
 * `ConversationStrategyEngine` (`buildContinuityLine`,
 * `features/dashboard/services/build-morning-brief.ts`) tenga más de
 * un "reason" real donde elegir en vez de repetir siempre la misma
 * postura. NO resuelve del todo "un tema distinto en cada refresh" --
 * `buildContinuityLine` pasa `recentStrategyTypes: []` fijo (el
 * Dashboard todavía no comparte el historial de diversidad que sí usa
 * el chat, ver su propio comentario en ese archivo), así que la
 * selección sigue siendo determinística dado el mismo snapshot. Tocar
 * ese cableado de diversidad es un cambio real al motor compartido,
 * deliberadamente NO hecho acá bajo esta ventana de tiempo -- más
 * señal real es la mitigación segura disponible ahora mismo.
 */
const RELATIONSHIP_MEMORIES: { content: string; type: MemoryCaptureInput["type"]; daysAgoOccurred: number }[] = [
  {
    content: "Con Alejandro nos juntamos cada semana para revisar cómo va LUZ.",
    type: "ritual",
    daysAgoOccurred: 10,
  },
  {
    content: "Alejandro y yo nos reunimos la semana pasada para revisar cómo va la ronda pre-seed.",
    type: "event",
    daysAgoOccurred: 7,
  },
  {
    content: "Quiero comprarle rosas a Verónica esta semana -- ha sido un pilar increíble mientras preparo todo esto.",
    type: "intention",
    daysAgoOccurred: 2,
  },
  {
    content: "Fernando me ayudó a revisar los últimos detalles técnicos antes del evento.",
    type: "event",
    daysAgoOccurred: 3,
  },
  {
    content: "Juanma me escribió deseándome suerte para la presentación.",
    type: "event",
    daysAgoOccurred: 1,
  },
  {
    content: "Mi hermano Juan Felipe siempre me dice que confíe más en mi instinto.",
    type: "fact",
    daysAgoOccurred: 14,
  },
];

async function seedRelationshipMemories(context: LifeGraphContext) {
  const engine = createMemoryEngine(db);
  for (const entry of RELATIONSHIP_MEMORIES) {
    await engine.capture(context, {
      content: entry.content,
      type: entry.type,
      source: "manual",
      occurredAt: daysAgo(entry.daysAgoOccurred),
    });
  }
  return { relationshipMemories: RELATIONSHIP_MEMORIES.length };
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
    | { sourceEmail?: string; targetEmail?: string; action?: string }
    | null;

  if (body?.action === "seed_wearable") {
    if (!body.targetEmail) {
      return NextResponse.json({ error: "targetEmail es requerido" }, { status: 400 });
    }
    const target = await resolveAccount(body.targetEmail);
    if (!target) {
      return NextResponse.json(
        { error: `sin cuenta/LifeGraph: ${body.targetEmail} -- esa cuenta debe iniciar sesión en la app al menos una vez primero` },
        { status: 404 },
      );
    }
    const { daysImported } = await importWearableExport(
      db,
      target.context,
      new GarminProvider(),
      JSON.stringify(SYNTHETIC_WEARABLE_WEEK()),
    );
    return NextResponse.json({ wearableDaysSeeded: daysImported });
  }

  if (body?.action === "seed_understanding") {
    if (!body.targetEmail) {
      return NextResponse.json({ error: "targetEmail es requerido" }, { status: 400 });
    }
    const target = await resolveAccount(body.targetEmail);
    if (!target) {
      return NextResponse.json(
        { error: `sin cuenta/LifeGraph: ${body.targetEmail} -- esa cuenta debe iniciar sesión en la app al menos una vez primero` },
        { status: 404 },
      );
    }
    const result = await seedUnderstanding(target.context);
    return NextResponse.json(result);
  }

  if (body?.action === "seed_relationships") {
    if (!body.targetEmail) {
      return NextResponse.json({ error: "targetEmail es requerido" }, { status: 400 });
    }
    const target = await resolveAccount(body.targetEmail);
    if (!target) {
      return NextResponse.json(
        { error: `sin cuenta/LifeGraph: ${body.targetEmail} -- esa cuenta debe iniciar sesión en la app al menos una vez primero` },
        { status: 404 },
      );
    }
    const result = await seedRelationships(target.context);
    return NextResponse.json(result);
  }

  if (body?.action === "seed_relationship_memories") {
    if (!body.targetEmail) {
      return NextResponse.json({ error: "targetEmail es requerido" }, { status: 400 });
    }
    const target = await resolveAccount(body.targetEmail);
    if (!target) {
      return NextResponse.json(
        { error: `sin cuenta/LifeGraph: ${body.targetEmail} -- esa cuenta debe iniciar sesión en la app al menos una vez primero` },
        { status: 404 },
      );
    }
    const result = await seedRelationshipMemories(target.context);
    return NextResponse.json(result);
  }

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
