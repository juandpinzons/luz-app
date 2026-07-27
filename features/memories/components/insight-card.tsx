import type { InsightExplanation } from "@/features/knowledge/services/explain-insight";

interface InsightCardProps {
  explanation: InsightExplanation;
  index?: number;
}

/**
 * Traduce `evidenceCount`/`spanDays`/`daysSinceMostRecentEvidence`
 * (ya calculados por `explainInsight`, nunca recalculados aquí) a una
 * frase -- responde "¿qué tan reciente y consistente es?" sin exponer
 * ningún número crudo. `null` solo si falta alguna fecha real (memoria
 * sin `occurredAt` ni `createdAt` resuelta) -- silencio, no una frase
 * a medias.
 */
function describeConsistency(explanation: InsightExplanation): string | null {
  const { evidenceCount, spanDays, daysSinceMostRecentEvidence } = explanation;
  if (spanDays === null || daysSinceMostRecentEvidence === null) {
    return null;
  }

  const recency =
    daysSinceMostRecentEvidence <= 0
      ? "hoy"
      : daysSinceMostRecentEvidence === 1
        ? "ayer"
        : daysSinceMostRecentEvidence < 30
          ? `hace ${daysSinceMostRecentEvidence} días`
          : `hace ${Math.round(daysSinceMostRecentEvidence / 30)} ${Math.round(daysSinceMostRecentEvidence / 30) === 1 ? "mes" : "meses"}`;

  if (spanDays === 0) {
    return `Lo he notado ${evidenceCount} veces, ${recency}.`;
  }

  const span =
    spanDays < 30
      ? `${spanDays} días`
      : `${Math.round(spanDays / 30)} ${Math.round(spanDays / 30) === 1 ? "mes" : "meses"}`;

  return `Lo he notado ${evidenceCount} veces a lo largo de ${span} — la más reciente, ${recency}.`;
}

/**
 * Comprensión ya validada (Knowledge Engine), no una memoria puntual --
 * mismo tratamiento visual que `MemoryCard` a propósito (misma familia
 * de tarjeta), con el acento `luz` en el borde para distinguirla de un
 * recuerdo cualquiera: esto no es algo que la persona dijo, es algo que
 * LUZ ya entendió a partir de varias cosas que dijo.
 */
export function InsightCard({ explanation, index = 0 }: InsightCardProps) {
  const consistency = describeConsistency(explanation);

  return (
    <li
      className="animate-fade-in rounded-lg border border-luz/25 bg-zinc-900/40 px-4 py-3 text-sm"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <p className="text-zinc-200">{explanation.reason}</p>

      {explanation.evidence.length > 0 && (
        <div className="mt-2 space-y-1 text-xs text-zinc-500">
          {explanation.evidence.map((item, contentIndex) => (
            <p key={contentIndex}>
              — algo que dijiste: &ldquo;{item.content}&rdquo;
            </p>
          ))}
        </div>
      )}

      {consistency && <p className="mt-2 text-xs text-zinc-600">{consistency}</p>}
    </li>
  );
}
