import type { DomainMovement } from "../entities/domain-movement";
import type { PredictivePatternCandidate } from "../entities/predictive-pattern-candidate";

/** "Poco después" -- una ventana de tres semanas entre un movimiento y el siguiente para contar como el mismo episodio. */
const WINDOW_DAYS = 21;
const WINDOW_MS = WINDOW_DAYS * 24 * 60 * 60 * 1000;
/** Nunca un patrón a partir de una sola coincidencia -- mismo umbral de evidencia mínima que `DeterministicInsightValidationStrategy` (2 piezas distintas). */
const MIN_OCCURRENCES = 2;
const MAX_CANDIDATES = 3;

interface Accumulator {
  occurrences: number;
  lastObservedAt: Date;
  sampleFromBeliefId: PredictivePatternCandidate["sampleFromBeliefId"];
  sampleToBeliefId: PredictivePatternCandidate["sampleToBeliefId"];
}

/**
 * Pura, sin IO -- compara cada par de movimientos de dominios distintos
 * que ocurrieron dentro de `WINDOW_DAYS` uno del otro ("a lleva a b"),
 * cuenta cuántas veces se repite exactamente la misma combinación
 * (dominio origen + dirección, dominio destino + dirección), y solo
 * devuelve las que se repitieron al menos `MIN_OCCURRENCES` veces --
 * un patrón real, nunca una coincidencia aislada (instrucción explícita
 * del bloque: "identificar patrones repetitivos", no puntuales).
 */
export function detectDomainCoMovement(
  movements: DomainMovement[],
): PredictivePatternCandidate[] {
  const sorted = [...movements].sort((a, b) => a.changedAt.getTime() - b.changedAt.getTime());
  const acc = new Map<string, Accumulator>();
  // Un mismo movimiento (origen o destino) no puede aportar más de una
  // vez a la misma combinación -- sin esto, dos episodios reales
  // relativamente cercanos entre sí (p. ej. a los días 0/2 y 10/12,
  // ambos dentro de los mismos 21 días entre sí) se contaban también
  // como un tercer "cruce" espurio (día 0 con día 12), inflando
  // `occurrences` -- y por lo tanto `computePatternConfidence` y el
  // texto exacto que ve la persona en `describePattern`/
  // `describePendingPrediction` ("visto N veces") -- por encima de lo
  // que la evidencia real puede sostener (nunca más confirmaciones
  // independientes que instancias reales de cada lado).
  const usedIndicesByKey = new Map<string, Set<number>>();

  for (let i = 0; i < sorted.length; i += 1) {
    const from = sorted[i];
    if (!from) continue;

    for (let j = i + 1; j < sorted.length; j += 1) {
      const to = sorted[j];
      if (!to) continue;

      const delta = to.changedAt.getTime() - from.changedAt.getTime();
      if (delta <= 0) continue;
      if (delta > WINDOW_MS) break; // sorted ascendente: nada más adelante puede caer en la ventana.
      if (from.domain === to.domain) continue;

      const key = `${from.domain}|${from.direction}|${to.domain}|${to.direction}`;
      const usedIndices = usedIndicesByKey.get(key) ?? new Set<number>();
      if (usedIndices.has(i) || usedIndices.has(j)) continue;
      usedIndices.add(i);
      usedIndices.add(j);
      usedIndicesByKey.set(key, usedIndices);

      const existing = acc.get(key);
      if (existing) {
        existing.occurrences += 1;
        if (to.changedAt.getTime() > existing.lastObservedAt.getTime()) {
          existing.lastObservedAt = to.changedAt;
          existing.sampleFromBeliefId = from.beliefId;
          existing.sampleToBeliefId = to.beliefId;
        }
      } else {
        acc.set(key, {
          occurrences: 1,
          lastObservedAt: to.changedAt,
          sampleFromBeliefId: from.beliefId,
          sampleToBeliefId: to.beliefId,
        });
      }
    }
  }

  const candidates: PredictivePatternCandidate[] = [];
  for (const [key, value] of acc) {
    if (value.occurrences < MIN_OCCURRENCES) continue;
    const [fromDomain, fromDirection, toDomain, toDirection] = key.split("|") as [
      PredictivePatternCandidate["fromDomain"],
      PredictivePatternCandidate["fromDirection"],
      PredictivePatternCandidate["toDomain"],
      PredictivePatternCandidate["toDirection"],
    ];
    candidates.push({
      fromDomain,
      fromDirection,
      toDomain,
      toDirection,
      occurrences: value.occurrences,
      lastObservedAt: value.lastObservedAt,
      sampleFromBeliefId: value.sampleFromBeliefId,
      sampleToBeliefId: value.sampleToBeliefId,
    });
  }

  return candidates
    .sort((a, b) => b.occurrences - a.occurrences || b.lastObservedAt.getTime() - a.lastObservedAt.getTime())
    .slice(0, MAX_CANDIDATES);
}
