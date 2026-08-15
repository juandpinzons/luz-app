import { count, eq, max } from "drizzle-orm";
import { z } from "zod";
import { getAIProvider } from "../../../ai";
import type { AIMessage } from "../../../ai/provider";
import type { Database } from "../../../core/db/client";
import { conversationMessages } from "../../../core/db/schema";
import type { LifeGraphContext } from "../../../core/life/life-graph-context";
import { renderIdentityAsSystemPrompt } from "../../../core/persona";
import { recordEvent } from "../../../core/observability/record-event";
import { buildOrbVisualState } from "../../orb/application/build-orb-state";
import type { OrbVisualState } from "../../orb/domain/orb-visual-state";
import { assembleRealitySnapshot } from "./assemble-reality-snapshot";
import { getCalendarContextForConversation } from "./get-calendar-signals-for-conversation";
import { gatherOrbLifeSignals } from "./orb-life-signals";

export interface WelcomeSignature {
  /** 1-3 palabras para el trazo del ritual de apertura -- reemplaza el "Welcome" fijo. */
  cue: string;
  /** 1-2 frases, la primera cosa que la persona lee al llegar. */
  greeting: string;
  orb: OrbVisualState;
}

/**
 * Investigación real 2026-08-15: `greeting` truncaba visiblemente a
 * mitad de frase en producción -- reproducido de verdad, no
 * hipotético: de 6 generaciones reales de prueba, 1 llegó a
 * exactamente 220 (el tope anterior) y terminó en "...en el cuerpo y
 * en la cabeza, la" -- la salida estructurada de OpenAI corta la
 * cadena para cumplir `maxLength` del schema en vez de dejar que el
 * modelo termine la frase antes. La instrucción de longitud (ver
 * `SYSTEM_PROMPT_SUFFIX`) ahora es explícita en caracteres, apuntando
 * bien por debajo de este tope -- 140 es la meta real, 220 queda como
 * margen de seguridad para que ese tope casi nunca se alcance, nunca
 * el objetivo en sí.
 */
const GREETING_TARGET_CHARS = 140;
const GREETING_MAX_CHARS = 220;

const welcomeSchema = z.object({
  cue: z.string().min(1).max(24),
  greeting: z.string().min(1).max(GREETING_MAX_CHARS),
});

const SYSTEM_PROMPT_SUFFIX = `Vas a escribir el primer momento de una conversación nueva -- lo primero que esta persona lee al llegar, antes de escribir una sola palabra.

Escribe dos cosas:
- "cue": una palabra o frase muy corta (1-3 palabras), el trazo inicial de un gesto de apertura -- nunca literalmente "Welcome" ni "Bienvenido/a", nunca un saludo genérico.
- "greeting": UNA frase completa, en español, que abra la conversación con presencia real -- una segunda frase corta SOLO si de verdad hace falta, nunca por costumbre. Apunta a no más de ${GREETING_TARGET_CHARS} caracteres (el límite real es ${GREETING_MAX_CHARS}, pero quedarte cerca de ahí es señal de que se te fue de largo) -- mejor una frase corta y precisa que dos genéricas. Nunca una pregunta de menú ("¿en qué puedo ayudarte?"), nunca genérica, nunca la misma estructura dos veces. Puede notar la hora, el tiempo que pasó, o algo concreto y real de lo que ya sabes de la persona -- solo si de verdad aporta, nunca forzado. Si no hay nada real que mencionar, un momento de presencia simple basta -- eso también es honesto.

Nunca inventes datos que no te dieron. Nunca prometas nada. Varía el tono y el ritmo cada vez -- esto debe sentirse escrito ahora, no recitado. Termina siempre la frase que empezaste -- nunca la dejes a medias.`;

export interface GenerateWelcomeInput {
  isFirstEverConversation: boolean;
  /** `null` si no hay mensaje previo (persona nueva) o si es la primera conversación. */
  msSinceLastMessage: number | null;
  totalMessageCount: number;
}

/** Ventana para considerar una fecha límite "próxima" en el texto -- misma ventana que usa `deriveMaturity` (`features/orb/services/derive-maturity.ts`) para `anticipation`, nunca un segundo número inventado aparte. */
const UPCOMING_DEADLINE_DAYS = 3;

function timeOfDayBucket(nowInBogota: Date): string {
  const hour = nowInBogota.getHours();
  if (hour < 5) return "madrugada";
  if (hour < 12) return "mañana";
  if (hour < 18) return "tarde";
  return "noche";
}

function nowInBogota(): Date {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Bogota" }),
  );
}

function describeGap(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 30) return "hace muy poco, en esta misma sesión";
  const hours = Math.floor(minutes / 60);
  if (hours < 6) return `hace ${hours} ${hours === 1 ? "hora" : "horas"}`;
  const days = Math.floor(hours / 24);
  if (days < 1) return "hoy, antes";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  if (days < 30) return `hace ${Math.floor(days / 7)} semanas`;
  return "hace bastante tiempo";
}

function isWithinDays(date: Date, days: number): boolean {
  const diff = date.getTime() - Date.now();
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
}

/** La fecha límite activa más próxima entre goals/projects, si hay alguna -- para `MaturityInputs.nearestDeadlineAt` (`features/orb/services/derive-maturity.ts`), que decide por su cuenta si cuenta como "próxima". */
function nearestDeadline(snapshot: Awaited<ReturnType<typeof assembleRealitySnapshot>>): Date | null {
  const dates = [...snapshot.life.activeGoals, ...snapshot.life.activeProjects]
    .map((item) => item.dueDate)
    .filter((date): date is Date => date !== undefined);

  return dates.length === 0 ? null : new Date(Math.min(...dates.map((date) => date.getTime())));
}

/**
 * Genera la bienvenida completa de una conversación nueva -- texto Y
 * orbe, en la misma llamada, para que ambos deriven de exactamente la
 * misma foto de la realidad (`RealitySnapshot`), nunca de dos
 * consultas que puedan desincronizarse entre sí. Nunca puede romper
 * `/chat`: cualquier fallo del proveedor de IA cae a
 * `buildDeterministicFallback`, nunca una excepción hacia arriba.
 *
 * El orbe (`features/orb/`) se construye a partir de esta misma
 * `RealitySnapshot` más dos lecturas puntuales adicionales (calendario,
 * vía la misma caché que ya usa `assembleRealitySnapshot`; y
 * logros/reencuentros recientes, `orb-life-signals.ts`) -- nunca una
 * segunda foto de la realidad independiente.
 */
export async function generateWelcome(
  db: Database,
  lifeGraphContext: LifeGraphContext,
  input: GenerateWelcomeInput,
): Promise<WelcomeSignature> {
  const snapshot = await assembleRealitySnapshot(db, lifeGraphContext);

  const [calendar, lifeSignals] = await Promise.all([
    getCalendarContextForConversation(db, lifeGraphContext),
    gatherOrbLifeSignals(db, lifeGraphContext),
  ]);

  const orb = buildOrbVisualState({
    personId: lifeGraphContext.personId,
    now: new Date(),
    maturity: {
      totalMessageCount: input.totalMessageCount,
      hasCommunicationStyleSignal: snapshot.communicationStyle.items.length > 0,
      hasGrowingBelief: snapshot.growingBeliefs.items.length > 0,
      hasPendingCuriosityQuestion: snapshot.curiosity.pendingQuestion !== null,
      nearestDeadlineAt: nearestDeadline(snapshot),
    },
    moment: {
      mostRecentMemoryAt: snapshot.memory.items[0]?.occurredAt ?? null,
      msSinceLastMessage: input.msSinceLastMessage,
      calendar,
      mostRecentCompletionAt: lifeSignals.mostRecentCompletionAt,
      mostRecentRelationshipTouchAt: lifeSignals.mostRecentRelationshipTouchAt,
    },
  });

  const facts: string[] = [
    `Momento del día: ${timeOfDayBucket(nowInBogota())}.`,
    input.isFirstEverConversation
      ? "Esta es la primera conversación de esta persona con LUZ -- nunca antes ha hablado contigo."
      : input.msSinceLastMessage !== null
        ? `Último mensaje: ${describeGap(input.msSinceLastMessage)}.`
        : "Ya se conocen, pero no hay una marca de tiempo de la última vez.",
  ];

  if (snapshot.growingBeliefs.items[0]) {
    facts.push(
      `Hipótesis en formación sobre esta persona (no confirmada, solo para tu propio contexto, nunca la afirmes como hecho): ${snapshot.growingBeliefs.items[0].statement}`,
    );
  }
  if (snapshot.curiosity.pendingQuestion) {
    facts.push(
      `Hay una pregunta genuina pendiente que LUZ ya tenía preparada: ${snapshot.curiosity.pendingQuestion.question}`,
    );
  }
  const upcoming = [...snapshot.life.activeGoals, ...snapshot.life.activeProjects].find(
    (item) => item.dueDate && isWithinDays(item.dueDate, UPCOMING_DEADLINE_DAYS),
  );
  if (upcoming) {
    facts.push(`Algo real está por vencer pronto: "${upcoming.title}".`);
  }
  if (snapshot.communicationStyle.items[0]) {
    facts.push(
      `Cómo prefiere que le hables: ${snapshot.communicationStyle.items[0].statement}`,
    );
  }
  if (snapshot.memory.items[0]) {
    facts.push(`Algo reciente y real que sabes de su vida: ${snapshot.memory.items[0].content}`);
  }

  const messages: AIMessage[] = [
    {
      role: "system",
      content: `${renderIdentityAsSystemPrompt()}\n\n${SYSTEM_PROMPT_SUFFIX}`,
    },
    { role: "user", content: facts.join("\n") },
  ];

  try {
    const { cue, greeting } = await getAIProvider().generateStructured(messages, {
      name: "chat_welcome",
      schema: welcomeSchema,
    });
    return { cue: cue.trim(), greeting: greeting.trim(), orb };
  } catch (error) {
    await recordEvent(db, {
      type: "error",
      route: "background.welcome",
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      ...buildDeterministicFallback(input, timeOfDayBucket(nowInBogota())),
      orb,
    };
  }
}

/**
 * Red de seguridad, no el camino normal -- solo corre si el proveedor
 * de IA falla. Sigue variando por señal real (momento del día, si es
 * la primera vez) en vez de un único string fijo, para que incluso una
 * falla se sienta como parte de la misma experiencia, nunca como un
 * mensaje de error genérico.
 */
function buildDeterministicFallback(
  input: GenerateWelcomeInput,
  bucket: string,
): Omit<WelcomeSignature, "orb"> {
  if (input.isFirstEverConversation) {
    return { cue: "Empecemos", greeting: "Aquí estoy. Cuéntame lo que quieras, sin apuro." };
  }

  const byBucket: Record<string, WelcomeSignature["cue"]> = {
    madrugada: "Aquí sigo",
    mañana: "Buen día",
    tarde: "Sigo aquí",
    noche: "Aquí estoy",
  };

  return { cue: byBucket[bucket] ?? "Aquí estoy", greeting: "Sigo aquí, a tu ritmo." };
}

/**
 * Conteo real de mensajes de este usuario en toda su historia --
 * misma consulta (indexada) que ya usa `app/admin/page.tsx`, nunca
 * inventado ni derivado del `RealitySnapshot` (que solo trae una
 * muestra acotada, no un total).
 */
export async function countTotalMessages(db: Database, userId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(conversationMessages)
    .where(eq(conversationMessages.userId, userId));

  return row?.count ?? 0;
}

/** Marca de tiempo del último mensaje real de este usuario, en cualquier conversación -- `null` si nunca ha escrito ninguno. */
export async function getLastMessageAt(db: Database, userId: string): Promise<Date | null> {
  const [row] = await db
    .select({ lastAt: max(conversationMessages.createdAt) })
    .from(conversationMessages)
    .where(eq(conversationMessages.userId, userId));

  return row?.lastAt ?? null;
}
