import type { Memory } from "../../memory-engine";
import type { DetectedLoopCandidate } from "./detected-loop-candidate";

/**
 * Regla de apertura determinista para `Memory` -- misión: "user
 * expresses concern" / "explicit intention" / "question requiring
 * future answer" derivados de una conversación. Se apoya ÚNICAMENTE en
 * `Memory.type`, ya clasificado de forma determinista por
 * `DeterministicMemoryClassifier` (Memory Engine) antes de que este
 * módulo la vea -- Continuity nunca vuelve a interpretar el contenido
 * ni llama IA por su cuenta (misión: "Do not rely on LLM reasoning").
 *
 * `"intention"` -> `explicit_intention` (una intención explícita
 * todavía sin resolver). `"event"` -> `significant_life_event` --
 * `core/life` define un `LifeEvent` propio (`entities/life-event.ts`)
 * pero, verificado contra el código real, NO tiene persistencia
 * todavía (sin tabla, sin implementación Drizzle, confirmado por
 * `features/life/services/get-life-timeline.ts`: "no persiste
 * todavía") -- Memory ya captura eventos de vida reales HOY vía este
 * `type`, así que es la fuente real disponible para el origen
 * `life_event` de la misión, no un rodeo. El día que `LifeEvent` tenga
 * persistencia real, una regla `detectFromLifeEvent` puede sumarse sin
 * tocar esta.
 *
 * Ningún otro `MemoryType` abre un loop hoy -- `"relationship"` ya
 * tiene su propia regla de origen (`detectRelationshipMilestone`,
 * `./detect-from-relationship.ts`); `"goal"` se cubre indirectamente
 * (`LifeCaptureService` ya convierte esa Memory en un `Goal` real, que
 * sí dispara `detectGoalDeadline`); `"fact"`/`"pattern"`/`"ritual"`/
 * `"preference"` son demasiado ambiguos para justificar seguimiento
 * sin evidencia adicional -- abrir un loop ahí sería inventar
 * urgencia, no detectarla.
 */
export function detectFromMemory(memory: Memory, now: Date = new Date()): DetectedLoopCandidate | null {
  if (memory.status !== "active") return null;
  if (memory.type !== "intention" && memory.type !== "event") return null;

  const reason = memory.type === "intention" ? "explicit_intention" : "significant_life_event";

  return {
    trigger: {
      origin: "memory",
      reason,
      sourceId: memory.id,
      detectedAt: now,
      summary: memory.content,
    },
    title: memory.content,
    priority: "medium",
    relatedEntities: [{ kind: "memory", id: memory.id, title: memory.content }],
  };
}
