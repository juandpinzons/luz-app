import type { Database } from "../../../core/db/client";
import type { LifeGraphContext } from "../../../core/life/life-graph-context";
import { createMemoryEngine } from "../../../core/memory-engine";
import { MIN_SCORE_WITH_UNDERSTANDING_SIGNAL } from "../../../core/memory-engine/ranking/deterministic-memory-ranking-strategy";
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

  // Auditoría de comportamiento (Presence Principles): dar continuidad
  // a partir de un dato solo porque existe, sin que represente
  // comprensión real, ya se identificó como el hallazgo transversal de
  // esa revisión. `retrieve()` ordena por rank descendente, así que
  // filtrar aquí nunca esconde una memoria mejor que quedó fuera del
  // límite — la separación entre "tiene señal real" y "no la tiene" es
  // más grande (26 puntos) que cualquier bono de recencia (máx. 4), o
  // sea que el orden ya garantiza que lo que califica siempre aparece
  // antes que lo que no. `rank` viene indefinido solo si `retrieve()`
  // alguna vez devolviera una memoria sin rankear — no debería ocurrir
  // (Capture → Rank es síncrono), pero se trata igual que "no califica"
  // en vez de asumir que sí, por prudencia.
  const memoriesWithRealSignal = relevantMemories.filter(
    (memory) => (memory.rank?.score ?? 0) >= MIN_SCORE_WITH_UNDERSTANDING_SIGNAL,
  );

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
    // Sin memorias con señal real de comprensión, `items` queda vacío
    // a propósito — nunca se rellena con lo mejor disponible aunque no
    // alcance la barra: forzar continuidad sobre algo superficial no es
    // continuidad real (ver FavorContinuityRule y build-morning-brief.ts,
    // los dos consumidores de este snapshot).
    memory: {
      items: memoriesWithRealSignal.map((memory) => ({
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
