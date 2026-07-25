interface InsightCardProps {
  description: string;
  evidenceContents: string[];
  index?: number;
}

/**
 * Comprensión ya validada (Knowledge Engine), no una memoria puntual --
 * mismo tratamiento visual que `MemoryCard` a propósito (misma familia
 * de tarjeta), con el acento `luz` en el borde para distinguirla de un
 * recuerdo cualquiera: esto no es algo que la persona dijo, es algo que
 * LUZ ya entendió a partir de varias cosas que dijo.
 */
export function InsightCard({
  description,
  evidenceContents,
  index = 0,
}: InsightCardProps) {
  return (
    <li
      className="animate-fade-in rounded-lg border border-luz/25 bg-zinc-900/40 px-4 py-3 text-sm"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <p className="text-zinc-200">{description}</p>

      {evidenceContents.length > 0 && (
        <div className="mt-2 space-y-1 text-xs text-zinc-500">
          {evidenceContents.map((content, contentIndex) => (
            <p key={contentIndex}>
              — algo que dijiste: &ldquo;{content}&rdquo;
            </p>
          ))}
        </div>
      )}
    </li>
  );
}
