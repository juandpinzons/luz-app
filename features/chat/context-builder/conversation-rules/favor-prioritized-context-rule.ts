import type { ContextItem, ContextItemSource } from "../../../../core/context-engine";
import type {
  ConversationRule,
  ConversationRuleInput,
} from "./conversation-rule";

type RenderableSource = Extract<ContextItemSource, "insight" | "memory" | "life" | "signal">;

/**
 * Encabezado por fuente, en el orden en que se renderizan — el mismo
 * orden que su peso base en `DeterministicContextScoringStrategy`:
 * insight (interpretación acumulada) antes que memory (un hecho
 * puntual) antes que life (estado estructural, no específico de este
 * mensaje) antes que signal (la fuente con menos peso por default).
 * `signal` se agrega aquí (misión "conecta calendario con
 * conversación") ahora que `assembleRealitySnapshot` sí puede
 * llenarlo -- Calendar Foundation, vía `calendar-signals.ts`; sigue
 * siendo la única fuente real de "signal" hoy (document/email/sensor
 * siguen sin Connectors, ADR-0015), así que el texto está pensado para
 * calendario -- revisar esta copia el día que otra fuente real llegue.
 */
const SOURCE_INTRO: Record<RenderableSource, string> = {
  insight:
    "Ya entendiste algo más profundo sobre esta persona a partir de varias conversaciones, no solo esta:",
  memory: "Ya existe memoria relevante de esta persona:",
  life: "Esto es parte de lo que esta persona está trabajando activamente ahora mismo (sus metas, proyectos o hábitos activos):",
  signal: "Esto es lo que sabes de su calendario ahora mismo:",
};

const SOURCE_GUIDANCE: Record<RenderableSource, string> = {
  insight:
    'Déjalo influir en cómo respondes, de forma natural — nunca lo repitas como una lista ni lo anuncies como un dato que "descubriste". Solo si de verdad ayuda a esta respuesta puntual.',
  memory:
    'Da continuidad a partir de ahí — no trates este mensaje como si fuera la primera vez que hablan. Cada una trae, entre paréntesis, cuándo pasó de verdad -- úsalo para hablar del tiempo con naturalidad ("hace unas semanas...", "el mes pasado...") en vez de un genérico "mencionaste". Nunca leas el paréntesis literal ni lo cites como una fecha exacta.',
  life: "Tenlo presente si conecta con lo que la persona dice ahora — no lo menciones si no aporta nada a esta respuesta puntual.",
  signal:
    "Úsalo para responder con precisión si pregunta qué tiene pendiente o agendado — y para mostrar que sabes lo que está viviendo si conecta con lo que dice ahora. Nunca lo recites completo sin que venga a cuento.",
};

const RENDER_ORDER: RenderableSource[] = ["insight", "memory", "life", "signal"];

function isRenderableSource(source: ContextItemSource): source is RenderableSource {
  return source in SOURCE_INTRO;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Incremento 2 ("hacer evidente que LUZ aprende con el tiempo"): sin
 * esto, cada memoria llegaba al modelo como un hecho plano, sin fecha
 * -- LUZ no tenía cómo decir "hace unas semanas" en vez de un genérico
 * "mencionaste", aunque el dato (`RealitySnapshot.memory.items[].occurredAt`)
 * siempre existió, solo que `ContextItem` nunca lo carga (ver docblock
 * de `ConversationRuleInput.realitySnapshot`). Mismos cortes que ya
 * usa el resto de la app (`app/life/page.tsx`, `dashboard-activity-summary.tsx`)
 * -- reimplementado aquí, no importado, mismo criterio ya establecido
 * en `select-contextual-memories.ts` para no cruzar límites de
 * `features/*` por una función de un párrafo.
 */
function formatRelativeTime(date: Date, now: Date): string {
  const diffDays = Math.floor((now.getTime() - date.getTime()) / DAY_MS);

  if (diffDays <= 0) return "hoy";
  if (diffDays === 1) return "ayer";
  if (diffDays < 7) return `hace ${diffDays} días`;
  if (diffDays < 30) {
    const weeks = Math.round(diffDays / 7);
    return weeks === 1 ? "hace una semana" : `hace ${weeks} semanas`;
  }
  const months = Math.round(diffDays / 30);
  return months === 1 ? "hace un mes" : `hace ${months} meses`;
}

function renderSection(
  source: RenderableSource,
  items: ContextItem[],
  memoryDateById: ReadonlyMap<string, Date>,
): string {
  const now = new Date();
  const lines = items
    .map((item) => {
      if (source !== "memory" || !item.sourceId) {
        return `- ${item.label}`;
      }
      const occurredAt = memoryDateById.get(item.sourceId);
      return occurredAt ? `- (${formatRelativeTime(occurredAt, now)}) ${item.label}` : `- ${item.label}`;
    })
    .join("\n");
  return `${SOURCE_INTRO[source]}\n${lines}\n${SOURCE_GUIDANCE[source]}`;
}

/**
 * Reemplaza `FavorContinuityRule` y `FavorInsightAwarenessRule`
 * (Fase II, Context Engine): esas dos reglas decidían cada una por su
 * cuenta si su propia fuente "aplicaba" y volcaban SIEMPRE su lista
 * completa, sin comparar contra las demás fuentes ni contra un techo
 * conjunto — dos decisiones de relevancia independientes, no una.
 *
 * Esta regla no decide relevancia: solo traduce a instrucción lo que
 * `ContextEngine.build()` ya decidió que merece atención
 * (`Context.contextItems`, ya cruzado entre life/memory/insight y ya
 * recortado por `DeterministicContextPrioritizationStrategy`). Agrupa
 * por fuente porque cada una necesita una postura distinta frente al
 * modelo (un hecho puntual no se trata igual que una interpretación
 * acumulada ni que el estado de vida activo), pero la pregunta "esto
 * es relevante" ya no se responde aquí.
 */
export class FavorPrioritizedContextRule implements ConversationRule {
  readonly id = "favor-prioritized-context";

  applies(input: ConversationRuleInput): boolean {
    return input.contextItems.some((item) => isRenderableSource(item.source));
  }

  directive(input: ConversationRuleInput): string {
    const bySource = new Map<RenderableSource, ContextItem[]>();
    for (const item of input.contextItems) {
      if (!isRenderableSource(item.source)) {
        continue;
      }
      const group = bySource.get(item.source) ?? [];
      group.push(item);
      bySource.set(item.source, group);
    }

    // Incremento 2: `RealitySnapshot.memory.items` ya trae `occurredAt`
    // real -- `ContextItem` no lo carga, así que se busca por `id` en
    // vez de duplicar el dato en un tipo que Context Engine no conoce.
    const memoryDateById = new Map<string, Date>();
    for (const memory of input.realitySnapshot.memory.items) {
      if (memory.occurredAt) {
        memoryDateById.set(memory.id, memory.occurredAt);
      }
    }

    return RENDER_ORDER.map((source) => {
      const items = bySource.get(source);
      return items && items.length > 0 ? renderSection(source, items, memoryDateById) : null;
    })
      .filter((section): section is string => section !== null)
      .join("\n\n");
  }
}
