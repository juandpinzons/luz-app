import { getAIProvider } from "../../../ai";
import type { Database } from "../../../core/db/client";
import { createContextEngine } from "../../../core/context-engine";
import {
  createConversationStrategyEngine,
  type ConversationStrategyDirective,
  type ConversationStrategyType,
} from "../../../core/conversation-strategy-engine";
import type { LifeGraphContext } from "../../../core/life/life-graph-context";
import { describeError } from "../../../core/observability/describe-error";
import { logger } from "../../../core/observability/logger";
import { recordEvent } from "../../../core/observability/record-event";
import { assembleRealitySnapshot } from "../../chat/services/assemble-reality-snapshot";

/**
 * Construcción híbrida (Sprint Alpha-1a): cada línea viene directamente
 * del Reality Snapshot, salvo `continuityLine` — la única generada por
 * IA, y solo a partir de lo que el snapshot ya trae. Nunca una segunda
 * fuente de datos, nunca un bloque completo generado por IA.
 *
 * `lifeLine` existió hasta el 2026-07-24 y nunca se renderizó en
 * `app/dashboard/page.tsx` (goals/projects/deadlines activos ya tienen
 * su propia sección en esa página) — retirado por redundante, no
 * reemplazado (ONBOARDING_PLAN.md, hallazgo #4).
 *
 * Desde 2026-07-25 (sprint "presencia real"): `continuityLine` ya no
 * elige entre "el insight más nuevo" o "la memoria más nueva" por
 * precedencia fija — reutiliza exactamente el mismo Context Engine +
 * Conversation Strategy Engine que ya decide, mensaje a mensaje, cómo
 * conversar en el chat (`features/chat/context-builder/build-context.ts`).
 * Antes, esta línea era más simple que la propia conversación: el chat
 * ya sabía distinguir "esto merece un recordatorio suave" de "esto
 * merece celebrarse" o "esto necesita un plan concreto" — el saludo
 * del Dashboard, el primer momento real del día con LUZ, no. Mismas
 * fuentes de siempre (`RealitySnapshot`), ningún engine ni tabla
 * nueva — solo un segundo consumidor de dos engines que ya existían.
 */
export interface MorningBrief {
  greetingLine: string;
  dateLine: string;
  /** `null` cuando no hay memoria relevante — se oculta, nunca se inventa. */
  continuityLine: string | null;
}

/**
 * LUZ es un producto en español, pensado para Colombia (`es-CO` ya se
 * usa en el resto del producto para formatear fechas) — pero el
 * servidor (Vercel) corre en UTC. Antes de esto, `dateLine` usaba
 * `now.getDay()` (día del servidor) y `greetingLine` decía siempre
 * "Buenos días" sin importar la hora real: de noche en Colombia, LUZ
 * seguía saludando como si fuera de mañana — exactamente el tipo de
 * detalle que rompe la sensación de presencia. Ambas se calculan
 * ahora en la hora real de Bogotá, sin aritmética manual de offset
 * (Colombia no tiene horario de verano, pero `Intl` es la forma
 * correcta de expresar "esta hora, en esa zona" de todas formas).
 */
const BOGOTA_TIME_ZONE = "America/Bogota";

const WEEKDAY_FORMAT = new Intl.DateTimeFormat("es-CO", {
  weekday: "long",
  timeZone: BOGOTA_TIME_ZONE,
});

const HOUR_FORMAT = new Intl.DateTimeFormat("es-CO", {
  hour: "numeric",
  hourCycle: "h23",
  timeZone: BOGOTA_TIME_ZONE,
});

function buildDateLine(now: Date): string {
  return `Hoy es ${WEEKDAY_FORMAT.format(now)}.`;
}

/**
 * 5am-12pm: mañana. 12pm-7pm: tarde. Resto: noche — mismos cortes que
 * cualquier persona usaría para saludar, no una convención técnica.
 * Exportada: `app/dashboard/page.tsx` la reutiliza para su saludo de
 * respaldo (cuando `buildMorningBrief` falla) — ese caso no debe
 * quedarse con el mismo "Buenos días" fijo que este archivo ya dejó
 * atrás.
 */
export function timeOfDayGreeting(now: Date): string {
  const hour = Number(HOUR_FORMAT.format(now));
  if (hour >= 5 && hour < 12) return "Buenos días";
  if (hour >= 12 && hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

/**
 * Solo estas cinco posturas abren bien un día — cada una ya trae algo
 * concreto que reconocer o retomar (`Reason`/`PrimaryObjective`).
 * `listen` (nada domina hoy) y `clarify` (varias cosas empatadas, hace
 * falta preguntar cuál importa) no tienen nada que decir todavía sin
 * que la persona hable primero — mismo resultado que hoy: sin línea.
 * `challenge` (confrontar un patrón de postergación) queda fuera a
 * propósito: es la postura correcta a mitad de una conversación donde
 * la persona ya está presente, pero abrir el día confrontando algo
 * antes de que diga una palabra es justo el tipo de presión que
 * `PRESENCE_PRINCIPLES.md` pide nunca manufacturar.
 */
const OPENING_ELIGIBLE_STRATEGIES = new Set<ConversationStrategyType>([
  "remind",
  "follow_up",
  "celebrate",
  "encourage",
  "plan",
]);

/**
 * Un solo prompt para las cinco posturas elegibles — la postura ya
 * decidió QUÉ decir y CÓMO (`reason`/`primaryObjective`/`avoid`, ver
 * cada regla en `core/conversation-strategy-engine/rules`); esta
 * función solo la traduce a una frase, igual que `render-context.ts`
 * la traduce a un bloque de prompt para el chat — nunca reinterpreta
 * la decisión ni mezcla una postura con otra.
 */
async function buildStrategicContinuityLine(
  directive: ConversationStrategyDirective,
): Promise<string> {
  const reply = await getAIProvider().generateReply([
    {
      role: "system",
      content:
        "Escribe UNA sola frase breve, cálida y natural, en primera " +
        "persona (eres LUZ), que abra el día reflejando esto que ya " +
        "entendiste sobre esta persona. Es una apertura, no la " +
        "resolución completa del tema -- nunca la anuncies como una " +
        "notificación ni la trates como una lista de pendientes. No " +
        "inventes ningún dato que no esté en el texto que recibes. " +
        "Sin comillas, sin markdown.",
    },
    {
      role: "user",
      content:
        `Lo que ya entendiste: "${directive.reason}"\n` +
        `Qué lograr con esta frase: ${directive.primaryObjective}\n` +
        `Qué evitar: ${directive.avoid}`,
    },
  ]);

  return reply.trim();
}

export async function buildMorningBrief(
  db: Database,
  lifeGraphContext: LifeGraphContext,
  personName: string,
  /**
   * Cero conversaciones registradas todavía (ver `isFirstVisit` en
   * `app/dashboard/page.tsx`) -- la señal equivalente a
   * `isFirstContact` que ya usa `buildContext` para el chat, pero
   * medida sobre la relación completa con esta persona, no sobre un
   * hilo de conversación puntual (ese concepto no existe todavía
   * cuando se arma el saludo del Dashboard).
   */
  isFirstVisit: boolean,
): Promise<MorningBrief> {
  const snapshot = await assembleRealitySnapshot(db, lifeGraphContext);

  const now = new Date();
  const firstName = personName.trim().split(/\s+/)[0];
  const greeting = timeOfDayGreeting(now);
  const greetingLine = firstName ? `${greeting}, ${firstName}.` : `${greeting}.`;
  const dateLine = buildDateLine(now);

  let continuityLine: string | null = null;

  try {
    const context = await createContextEngine(db).build(snapshot, lifeGraphContext);
    const directive = createConversationStrategyEngine().select({
      realitySnapshot: snapshot,
      contextItems: context.items,
      isFirstContact: isFirstVisit,
      // El Dashboard todavía no comparte el historial de diversidad del
      // chat (`conversation-signal-log.ts`, `userId`-keyed) -- `[]`
      // preserva exactamente el comportamiento anterior a este redesign
      // (nunca en cooldown). Compartirlo con el chat es una extensión
      // futura razonable, fuera de alcance de este cambio.
      recentStrategyTypes: [],
    });

    if (OPENING_ELIGIBLE_STRATEGIES.has(directive.strategy)) {
      continuityLine = await buildStrategicContinuityLine(directive);
    }
  } catch (error) {
    // Mismo criterio que `life-capture-service.ts` (auditoría
    // 2026-07-25, OBSERVABILITY_PLAN.md): detalle completo solo a
    // consola vía `describeError`, nunca a `events.metadata`.
    const detail = describeError(error);
    logger.log({
      event: "background.morning_brief.failed",
      severity: "error",
      lifeGraphId: lifeGraphContext.lifeGraphId,
      ...detail,
    });
    await recordEvent(db, {
      type: "error",
      route: "background.morning_brief",
      message: error instanceof Error ? error.message : String(error),
      metadata: {
        lifeGraphId: lifeGraphContext.lifeGraphId,
        errorName: detail.errorName,
        errorCode: detail.errorCode,
      },
    });
    continuityLine = null;
  }

  return { greetingLine, dateLine, continuityLine };
}
