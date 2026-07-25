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

const WEEKDAYS = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
];

function buildDateLine(now: Date): string {
  return `Hoy es ${WEEKDAYS[now.getDay()]}.`;
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

  const firstName = personName.trim().split(/\s+/)[0];
  const greetingLine = firstName ? `Buenos días, ${firstName}.` : "Buenos días.";
  const dateLine = buildDateLine(new Date());

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
