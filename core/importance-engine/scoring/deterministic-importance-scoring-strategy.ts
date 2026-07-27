import type { ImportanceSignals } from "./importance-signals";

const RECENCY_WINDOW_DAYS = 60;

export interface ImportanceScoreResult {
  score: number;
  reason: string;
}

/**
 * Determinista, sin IA -- mismo criterio que
 * `DeterministicContextScoringStrategy`: combina señales ya calculadas
 * por otros engines, nunca re-interpreta evidencia cruda. Evidencia
 * acumulada pesa más que cualquier otra señal (Principio 3: la
 * explicabilidad exige que "por qué importa esto" siempre se pueda
 * justificar con evidencia real, no con una intuición).
 */
export class DeterministicImportanceScoringStrategy {
  compute(signals: ImportanceSignals): ImportanceScoreResult {
    const parts: string[] = [];

    const evidenceScore = Math.min(60, signals.evidenceCount * 12);
    parts.push(`${signals.evidenceCount} evidencia(s) (+${evidenceScore})`);

    const confidenceScore =
      signals.confidence !== undefined ? Math.round(signals.confidence * 0.2) : 0;
    if (signals.confidence !== undefined) {
      parts.push(`confianza ${signals.confidence} (+${confidenceScore})`);
    }

    const connectionScore = Math.min(15, (signals.connectionCount ?? 0) * 5);
    if (signals.connectionCount) {
      parts.push(`${signals.connectionCount} conexión(es) (+${connectionScore})`);
    }

    const recencyScore =
      signals.recencyDays === undefined
        ? 0
        : Math.max(
            0,
            Math.round(10 * (1 - Math.min(signals.recencyDays, RECENCY_WINDOW_DAYS) / RECENCY_WINDOW_DAYS)),
          );
    if (signals.recencyDays !== undefined) {
      parts.push(`actividad hace ${Math.round(signals.recencyDays)}d (+${recencyScore})`);
    }

    const contradictionScore = signals.involvedInOpenContradiction ? 5 : 0;
    if (signals.involvedInOpenContradiction) {
      parts.push(`contradicción abierta (+${contradictionScore})`);
    }

    const total = Math.max(
      0,
      Math.min(
        100,
        evidenceScore + confidenceScore + connectionScore + recencyScore + contradictionScore,
      ),
    );

    return { score: total, reason: parts.join(", ") };
  }
}
