const ELLIPSIS = "…";

/** Compartido entre `MemoryCard`/`InsightCard` -- una sola forma de recortar texto largo, nunca una por componente. */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}${ELLIPSIS}`;
}
