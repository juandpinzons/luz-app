import type { Database } from "../../../core/db/client";
import {
  listActiveGoals,
  listActiveHabits,
  listActiveProjects,
  type EntityId,
  type LifeGraphContext,
} from "../../../core/life";
import { createMemoryEngine } from "../../../core/memory-engine";
import { MIN_SCORE_WITH_UNDERSTANDING_SIGNAL } from "../../../core/memory-engine/ranking/deterministic-memory-ranking-strategy";
import type { LifeStateItem, RealitySnapshot } from "../../../core/reality";

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

/**
 * `core/reality` es kernel compartido: nunca importa el tipo `Goal`/
 * `Project`/`Habit` de `core/life`, así que esta traducción a la forma
 * neutral `LifeStateItem` vive aquí — la frontera anti-corrupción que
 * ADR-0013 exige, nunca dentro de `core/reality` ni de ningún engine.
 */
function toLifeStateItem(entity: {
  id: EntityId;
  title: string;
}): LifeStateItem {
  return { id: entity.id, title: entity.title };
}

export async function assembleRealitySnapshot(
  db: Database,
  context: LifeGraphContext,
): Promise<RealitySnapshot> {
  const [relevantMemories, activeGoals, activeProjects, activeHabits] =
    await Promise.all([
      createMemoryEngine(db).retrieve(context, {
        limit: RELEVANT_MEMORY_LIMIT,
      }),
      listActiveGoals(db, context),
      listActiveProjects(db, context),
      listActiveHabits(db, context),
    ]);

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
    // Persistencia real de Nivel 1 (Goal/Project/Habit) — `core/life`
    // ya tiene repositorios Drizzle para las tres. Si de verdad no hay
    // ninguna activa, los arreglos siguen vacíos — la ausencia real
    // sigue representándose como ausencia (REALITY_SNAPSHOT_V1.md:
    // "absence must be represented as absence"), ya no por un límite
    // de la implementación.
    life: {
      activeGoals: activeGoals.map(toLifeStateItem),
      activeProjects: activeProjects.map(toLifeStateItem),
      activeHabits: activeHabits.map(toLifeStateItem),
    },
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
