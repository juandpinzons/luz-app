import Link from "next/link";

interface LifeCardProps {
  href: string;
  title: string;
  statusLabel?: string;
  muted?: boolean;
  /** Posición dentro de su franja — solo para escalonar la entrada, recortada por el llamador. */
  index?: number;
}

/** Misma forma visual para Goal/Project/Habit/Relationship (docs/product/ALPHA_EXPERIENCE_V1_DESIGN.md §5.1) — una tarjeta, no una tabla administrativa. */
export function LifeCard({
  href,
  title,
  statusLabel,
  muted = false,
  index = 0,
}: LifeCardProps) {
  return (
    <Link
      href={href}
      style={{ animationDelay: `${index * 30}ms` }}
      className={
        muted
          ? "animate-fade-in block rounded-xl border border-zinc-800 px-4 py-3 opacity-60 transition hover:opacity-100 hover:border-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
          : "animate-fade-in block rounded-xl border border-zinc-800 px-4 py-3 transition hover:border-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
      }
    >
      <p className="text-sm text-zinc-200">{title}</p>
      {statusLabel && <p className="mt-1 text-xs text-zinc-500">{statusLabel}</p>}
    </Link>
  );
}
