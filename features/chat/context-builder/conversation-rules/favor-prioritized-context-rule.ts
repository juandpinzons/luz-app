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
    "Da continuidad a partir de ahí — no trates este mensaje como si fuera la primera vez que hablan.",
  life: "Tenlo presente si conecta con lo que la persona dice ahora — no lo menciones si no aporta nada a esta respuesta puntual.",
  signal:
    "Úsalo para responder con precisión si pregunta qué tiene pendiente o agendado — y para mostrar que sabes lo que está viviendo si conecta con lo que dice ahora. Nunca lo recites completo sin que venga a cuento.",
};

const RENDER_ORDER: RenderableSource[] = ["insight", "memory", "life", "signal"];

function isRenderableSource(source: ContextItemSource): source is RenderableSource {
  return source in SOURCE_INTRO;
}

function renderSection(source: RenderableSource, items: ContextItem[]): string {
  const lines = items.map((item) => `- ${item.label}`).join("\n");
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

    return RENDER_ORDER.map((source) => {
      const items = bySource.get(source);
      return items && items.length > 0 ? renderSection(source, items) : null;
    })
      .filter((section): section is string => section !== null)
      .join("\n\n");
  }
}
