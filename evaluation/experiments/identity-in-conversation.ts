import { buildBaselineRealitySnapshot } from "../fixtures/baseline-reality-snapshot";
import type { Experiment } from "../types";

/**
 * Primer experimento del arnés (Prioridad 1, Identidad --
 * `METADATA_INVENTORY_V1.md`, Incremento 3). Un solo factor: si
 * `RealitySnapshot.concepts` está poblado o vacío -- exactamente lo
 * que `FavorPrioritizedContextRule` empezó a renderizar. Todo lo demás
 * (memoria, vida activa, mensaje) es el mismo objeto base, copiado, no
 * reescrito por variante -- así una diferencia real en la respuesta
 * solo puede explicarse por ese único factor.
 */
export function buildIdentityInConversationExperiment(): Experiment {
  const baseline = buildBaselineRealitySnapshot();

  return {
    name: "identity-in-conversation",
    question:
      "¿La sección de Identidad (Concepts) que FavorPrioritizedContextRule ahora renderiza cambia de forma perceptible cómo LUZ responde, o es indistinguible de no tenerla?",
    baseline,
    userMessage: "la verdad hoy no tengo muchas ganas de entrenar, no sé si valga la pena seguir",
    variants: [
      {
        name: "sin-identidad",
        factor: "Concepts vacío -- mismo snapshot, sin la sección de identidad de fondo",
        buildSnapshot: (snapshot) => ({ ...snapshot, concepts: { items: [] } }),
      },
      {
        name: "con-identidad",
        factor: "Concepts poblado -- Disciplina, Cambio de hábitos (contenido real del fixture base)",
        buildSnapshot: (snapshot) => snapshot,
      },
    ],
  };
}
