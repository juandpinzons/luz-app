import type { Database } from "../../../core/db/client";
import type { LifeGraphContext } from "../../../core/life/life-graph-context";
import { createMemoryEngine } from "../../../core/memory-engine";
import type { RealitySnapshot } from "../../../core/reality";

/**
 * Ensamblador mínimo de `RealitySnapshot` (Beta 1 Roadmap, Sprint B2;
 * ADR-0013). Vive en `features/chat/`, no en `core/reality` ni en
 * ningún engine — ADR-0013 exige exactamente esto: "un futuro
 * ensamblador de aplicación... nunca dentro de core/reality o de
 * ningún engine". `core/chat` es hoy su único consumidor; si un
 * segundo consumidor real lo necesita, promoverlo a un lugar
 * compartido es la decisión de ese momento, no de este.
 *
 * Efímero a propósito: no escribe nada en base de datos, no persiste
 * nada, existe solo durante el ciclo de esta función. Cada llamada
 * ensambla desde cero — nunca se cachea entre requests.
 */

const RELEVANT_MEMORY_LIMIT = 5;

export async function assembleRealitySnapshot(
  db: Database,
  context: LifeGraphContext,
): Promise<RealitySnapshot> {
  const relevantMemories = await createMemoryEngine(db).retrieve(context, {
    limit: RELEVANT_MEMORY_LIMIT,
  });

  return {
    lifeGraphId: context.lifeGraphId,
    capturedAt: new Date(),
    // `core/life` no tiene todavía repositorios Drizzle para
    // Goal/Project/Habit (solo LifeGraph y Person) — vacío es la
    // representación honesta de esa ausencia, no un placeholder a
    // ocultar (REALITY_SNAPSHOT_V1.md: "absence must be represented
    // as absence"). Beta 1 Roadmap ya señala este límite conocido.
    life: { activeGoals: [], activeProjects: [], activeHabits: [] },
    // Retrieval estructurado (ADR-0004), ordenado por rank — la mitad
    // semántica (PR-020) no existe todavía. "Relevante" hoy significa
    // "lo más valioso ya capturado", no "lo más similar a este mensaje".
    memory: {
      items: relevantMemories.map((memory) => ({
        id: memory.id,
        content: memory.content,
        occurredAt: memory.occurredAt,
      })),
    },
    // Sin Connectors implementados todavía (ADR-0015) — vacío,
    // indefinidamente, tal como ADR-0013 ya esperaba.
    signals: { signals: [] },
  };
}
