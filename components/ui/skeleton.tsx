/** Placeholder de carga genérico — un bloque que respira suavemente en vez de un spinner o texto fijo. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse-soft rounded-lg bg-zinc-900 ${className}`} />
  );
}
