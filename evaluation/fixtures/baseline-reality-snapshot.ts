import { createEntityId } from "../../core/life";
import type { RealitySnapshot } from "../../core/reality";

/**
 * Snapshot sintético, no datos reales de ninguna cuenta -- este
 * archivo se corre repetidamente y queda en el repo, así que no debe
 * contener nada de una persona real (mismo criterio que ya aplicó
 * `METADATA_INVENTORY_V1.md` al no citar contenido sensible). Diseñado
 * para que cada sección de `RealitySnapshot` tenga algo real que un
 * experimento pueda variar, sin inventar riqueza que un experimento
 * dado no necesite -- cada campo vacío es una decisión, no un
 * descuido (ver `assemble-reality-snapshot.ts`: "ausencia real
 * representada como ausencia").
 *
 * `LIFE_GRAPH_ID`/`PERSON_ID` son UUIDs de prueba fijos -- mismo
 * patrón que `smoke/conversation-strategy.test.ts`'s `FIXTURE_LIFE_GRAPH`.
 */
export const FIXTURE_LIFE_GRAPH_ID = createEntityId(
  "00000000-0000-0000-0000-0000000000e1",
);
export const FIXTURE_PERSON_ID = createEntityId(
  "00000000-0000-0000-0000-0000000000e2",
);

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export function buildBaselineRealitySnapshot(): RealitySnapshot {
  return {
    lifeGraphId: FIXTURE_LIFE_GRAPH_ID,
    capturedAt: new Date(),
    life: {
      activeGoals: [
        {
          id: createEntityId("00000000-0000-0000-0000-000000000101"),
          title: "Correr una media maratón",
          domain: "health",
          dueDate: daysAgo(-21),
        },
      ],
      activeProjects: [],
      activeHabits: [],
    },
    memory: {
      items: [
        {
          id: createEntityId("00000000-0000-0000-0000-000000000201"),
          content: "empecé a entrenar para la media maratón, corrí 8km sin parar",
          occurredAt: daysAgo(9),
        },
        {
          id: createEntityId("00000000-0000-0000-0000-000000000202"),
          content: "decidí retomar el hábito de leer antes de dormir en vez de usar el celular",
          occurredAt: daysAgo(2),
        },
      ],
    },
    insights: { items: [] },
    signals: { signals: [] },
    knowledgeGaps: { domains: [] },
    reasoning: { items: [] },
    curiosity: { pendingQuestion: null },
    contradictions: { items: [] },
    communicationStyle: { items: [] },
    growingBeliefs: { items: [] },
    fadingBeliefs: { items: [] },
    reopenCandidates: { items: [] },
    closures: { items: [] },
    // El campo que el primer experimento (`identity-in-conversation.ts`)
    // varía -- presente aquí con contenido real de fixture para que
    // "sin identidad" tenga que vaciarlo explícitamente (`withoutConcepts`),
    // nunca al revés (más fácil olvidar agregar algo que quitarlo).
    concepts: {
      items: [
        { id: createEntityId("00000000-0000-0000-0000-000000000301"), label: "Disciplina", domain: "personal_growth" },
        { id: createEntityId("00000000-0000-0000-0000-000000000302"), label: "Cambio de hábitos", domain: "personal_growth" },
      ],
    },
  };
}
