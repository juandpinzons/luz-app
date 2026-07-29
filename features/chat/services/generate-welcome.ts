import { count, eq, max } from "drizzle-orm";
import { z } from "zod";
import { getAIProvider } from "../../../ai";
import type { AIMessage } from "../../../ai/provider";
import type { Database } from "../../../core/db/client";
import { conversationMessages } from "../../../core/db/schema";
import type { LifeGraphContext } from "../../../core/life/life-graph-context";
import { renderIdentityAsSystemPrompt } from "../../../core/persona";
import { recordEvent } from "../../../core/observability/record-event";
import { assembleRealitySnapshot } from "./assemble-reality-snapshot";

/**
 * Debajo de esto, la relación apenas empieza -- el orbe se muestra
 * "spark" (pequeño, tenue). Encima de `RADIANT_THRESHOLD`, hay una
 * historia real detrás -- "radiant" (pleno, con una segunda capa de
 * luz). Umbrales sobre mensajes reales, nunca inventados: el mismo
 * conteo que ya usa `app/admin/page.tsx` para "Mensajes".
 */
const STEADY_THRESHOLD = 15;
const RADIANT_THRESHOLD = 100;
/** Ventana para considerar una fecha límite "próxima" -- ni tan corta que casi nunca aplique, ni tan larga que deje de sentirse inminente. */
const UPCOMING_DEADLINE_DAYS = 3;

export type OrbMaturityStage = "spark" | "steady" | "radiant";

/**
 * Todo lo que la interfaz necesita para pintar el orbe -- nunca un
 * color arbitrario ni aleatorio, cada campo se deriva de una señal
 * real (ver `deriveOrbSignature`). Deliberadamente no incluye un
 * `hue`: la luz de LUZ es siempre la misma (`--color-luz`, ámbar de
 * marca) -- lo que cambia con el tiempo y la persona es su calidez y
 * su ritmo, nunca su identidad de color.
 */
export interface OrbVisualSignature {
  maturityStage: OrbMaturityStage;
  /** 0 (apenas empezando) a 1 (relación asentada) -- intensidad/saturación del brillo. */
  warmth: number;
  /** Duración de un ciclo de respiración, en ms -- más corto cuando hay algo real que LUZ tiene presente. */
  rhythmMs: number;
  /** Hay una hipótesis en formación, una pregunta pendiente o algo por vencer pronto -- nunca decorativo, siempre trazable a una señal real. */
  anticipation: boolean;
}

export interface WelcomeSignature {
  /** 1-3 palabras para el trazo del ritual de apertura -- reemplaza el "Welcome" fijo. */
  cue: string;
  /** 1-2 frases, la primera cosa que la persona lee al llegar. */
  greeting: string;
  orb: OrbVisualSignature;
}

const welcomeSchema = z.object({
  cue: z.string().min(1).max(24),
  greeting: z.string().min(1).max(220),
});

const SYSTEM_PROMPT_SUFFIX = `Vas a escribir el primer momento de una conversación nueva -- lo primero que esta persona lee al llegar, antes de escribir una sola palabra.

Escribe dos cosas:
- "cue": una palabra o frase muy corta (1-3 palabras), el trazo inicial de un gesto de apertura -- nunca literalmente "Welcome" ni "Bienvenido/a", nunca un saludo genérico.
- "greeting": una o dos frases, en español, que abran la conversación con presencia real -- nunca una pregunta de menú ("¿en qué puedo ayudarte?"), nunca genérica, nunca la misma estructura dos veces. Puede notar la hora, el tiempo que pasó, o algo concreto y real de lo que ya sabes de la persona -- solo si de verdad aporta, nunca forzado. Si no hay nada real que mencionar, un momento de presencia simple basta -- eso también es honesto.

Nunca inventes datos que no te dieron. Nunca prometas nada. Varía el tono, el largo y el ritmo cada vez -- esto debe sentirse escrito ahora, no recitado.`;

export interface GenerateWelcomeInput {
  isFirstEverConversation: boolean;
  /** `null` si no hay mensaje previo (persona nueva) o si es la primera conversación. */
  msSinceLastMessage: number | null;
  totalMessageCount: number;
}

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

/**
 * Deliberadamente determinista y sin IO extra: reutiliza exactamente
 * lo que `assembleRealitySnapshot` ya trajo, nunca una segunda
 * consulta. `hue` no existe a propósito -- ver docblock de
 * `OrbVisualSignature`.
 */
function deriveOrbSignature(
  totalMessageCount: number,
  snapshot: Awaited<ReturnType<typeof assembleRealitySnapshot>>,
): OrbVisualSignature {
  const maturityStage: OrbMaturityStage =
    totalMessageCount >= RADIANT_THRESHOLD
      ? "radiant"
      : totalMessageCount >= STEADY_THRESHOLD
        ? "steady"
        : "spark";

  const messageWarmth = Math.min(totalMessageCount / RADIANT_THRESHOLD, 1);
  const understandingWarmth = snapshot.communicationStyle.items.length > 0 ? 0.15 : 0;
  const warmth = Math.min(0.25 + messageWarmth * 0.6 + understandingWarmth, 1);

  const hasUpcomingDeadline = [
    ...snapshot.life.activeGoals,
    ...snapshot.life.activeProjects,
  ].some((item) => item.dueDate && isWithinDays(item.dueDate, UPCOMING_DEADLINE_DAYS));

  const anticipation =
    snapshot.growingBeliefs.items.length > 0 ||
    snapshot.curiosity.pendingQuestion !== null ||
    hasUpcomingDeadline;

  return {
    maturityStage,
    warmth,
    rhythmMs: anticipation ? 3200 : 4200,
    anticipation,
  };
}

/**
 * Genera la bienvenida completa de una conversación nueva -- texto Y
 * orbe, en la misma llamada, para que ambos deriven de exactamente la
 * misma foto de la realidad (`RealitySnapshot`), nunca de dos
 * consultas que puedan desincronizarse entre sí. Nunca puede romper
 * `/chat`: cualquier fallo del proveedor de IA cae a
 * `buildDeterministicFallback`, nunca una excepción hacia arriba.
 */
export async function generateWelcome(
  db: Database,
  lifeGraphContext: LifeGraphContext,
  input: GenerateWelcomeInput,
): Promise<WelcomeSignature> {
  const snapshot = await assembleRealitySnapshot(db, lifeGraphContext);
  const orb = deriveOrbSignature(input.totalMessageCount, snapshot);

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
