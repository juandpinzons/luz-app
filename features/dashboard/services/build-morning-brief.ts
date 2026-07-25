import { getAIProvider } from "../../../ai";
import type { Database } from "../../../core/db/client";
import type { LifeGraphContext } from "../../../core/life/life-graph-context";
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
 * Desde 2026-07-25 (Knowledge Engine desplegado, ver
 * FIRST_MESSAGE_IDENTITY_PLAN.md): si existe un Insight ya validado,
 * tiene precedencia sobre la memoria puntual para esta línea —
 * representa comprensión acumulada a través de varias conversaciones,
 * no solo la última cosa relevante que se dijo. Sin insight validado,
 * se preserva el comportamiento anterior exacto (memoria más
 * relevante). Sin ninguno de los dos, `continuityLine` sigue siendo
 * `null` — la ausencia real nunca se disfraza.
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

async function buildContinuityLine(
  lastMemoryContent: string,
): Promise<string> {
  const reply = await getAIProvider().generateReply([
    {
      role: "system",
      content:
        "Escribe UNA sola frase breve, cálida y natural que retome la " +
        "última conversación con esta persona e invite a continuar. No " +
        "inventes ningún dato que no esté en el texto que recibes. Sin " +
        "comillas, sin markdown.",
    },
    {
      role: "user",
      content: `Última memoria relevante: "${lastMemoryContent}"`,
    },
  ]);

  return reply.trim();
}

/**
 * Distinto prompt que `buildContinuityLine`: un Insight ya es una
 * interpretación ("qué significa"), no un hecho crudo que reinterpretar
 * -- pedirle a la IA que lo retome como comprensión acumulada, nunca
 * que lo anuncie como un descubrimiento nuevo o una lista.
 */
async function buildInsightContinuityLine(
  insightDescription: string,
): Promise<string> {
  const reply = await getAIProvider().generateReply([
    {
      role: "system",
      content:
        "Ya entendiste algo real sobre esta persona a partir de varias " +
        "conversaciones, no solo una. Escribe UNA sola frase breve, " +
        "cálida y natural que lo deje ver de forma sutil e invite a " +
        "continuar — nunca lo anuncies como un descubrimiento ni lo " +
        "repitas como una lista o un dato suelto. No inventes nada que " +
        "no esté en el texto que recibes. Sin comillas, sin markdown.",
    },
    {
      role: "user",
      content: `Lo que ya entendiste: "${insightDescription}"`,
    },
  ]);

  return reply.trim();
}

export async function buildMorningBrief(
  db: Database,
  lifeGraphContext: LifeGraphContext,
  personName: string,
): Promise<MorningBrief> {
  const snapshot = await assembleRealitySnapshot(db, lifeGraphContext);

  const now = new Date();
  const firstName = personName.trim().split(/\s+/)[0];
  const greeting = timeOfDayGreeting(now);
  const greetingLine = firstName ? `${greeting}, ${firstName}.` : `${greeting}.`;
  const dateLine = buildDateLine(now);

  const topInsight = snapshot.insights.items[0];
  const topMemory = snapshot.memory.items[0];
  let continuityLine: string | null = null;

  try {
    if (topInsight) {
      continuityLine = await buildInsightContinuityLine(topInsight.description);
    } else if (topMemory) {
      continuityLine = await buildContinuityLine(topMemory.content);
    }
  } catch (error) {
    console.error(
      "[build-morning-brief] no se pudo generar el cierre con IA:",
      error,
    );
    continuityLine = null;
  }

  return { greetingLine, dateLine, continuityLine };
}
