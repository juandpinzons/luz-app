import { getAIProvider } from "../../../ai";
import type { Database } from "../../../core/db/client";
import type { LifeGraphContext } from "../../../core/life/life-graph-context";
import { assembleRealitySnapshot } from "../../chat/services/assemble-reality-snapshot";

/**
 * Construcción híbrida (Sprint Alpha-1a): cada línea viene directamente
 * del Reality Snapshot, salvo `continuityLine` — la única generada por
 * IA, y solo a partir de la memoria real más relevante que ya trae el
 * snapshot. Nunca una segunda fuente de datos, nunca un bloque completo
 * generado por IA.
 *
 * `lifeLine` existió hasta el 2026-07-24 y nunca se renderizó en
 * `app/dashboard/page.tsx` (goals/projects/deadlines activos ya tienen
 * su propia sección en esa página) — retirado por redundante, no
 * reemplazado (ONBOARDING_PLAN.md, hallazgo #4).
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

export async function buildMorningBrief(
  db: Database,
  lifeGraphContext: LifeGraphContext,
  personName: string,
): Promise<MorningBrief> {
  const snapshot = await assembleRealitySnapshot(db, lifeGraphContext);

  const firstName = personName.trim().split(/\s+/)[0];
  const greetingLine = firstName ? `Buenos días, ${firstName}.` : "Buenos días.";
  const dateLine = buildDateLine(new Date());

  const topMemory = snapshot.memory.items[0];
  let continuityLine: string | null = null;

  if (topMemory) {
    try {
      continuityLine = await buildContinuityLine(topMemory.content);
    } catch (error) {
      console.error(
        "[build-morning-brief] no se pudo generar el cierre con IA:",
        error,
      );
      continuityLine = null;
    }
  }

  return { greetingLine, dateLine, continuityLine };
}
