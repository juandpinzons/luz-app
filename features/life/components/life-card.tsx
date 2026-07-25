import Link from "next/link";
import { PresenceDot } from "@/components/ui/presence-dot";

interface LifeCardProps {
  href: string;
  title: string;
  statusLabel?: string;
  muted?: boolean;
  /**
   * Un goal/project cumplido no es lo mismo que uno abandonado —
   * antes ambos se atenuaban por igual (`muted`), como si terminar
   * algo y dejarlo a medias fueran el mismo tipo de "ya no importa".
   * `celebrated` marca lo primero con el acento `luz` en vez de
   * apagarlo: un logro se nota, no se desvanece.
   */
  celebrated?: boolean;
  /** Posición dentro de su franja — solo para escalonar la entrada, recortada por el llamador. */
  index?: number;
}

/** Misma forma visual para Goal/Project/Habit/Relationship (docs/product/ALPHA_EXPERIENCE_V1_DESIGN.md §5.1) — una tarjeta, no una tabla administrativa. */
export function LifeCard({
  href,
  title,
  statusLabel,
  muted = false,
  celebrated = false,
  index = 0,
}: LifeCardProps) {
  const border = celebrated
    ? "border-luz/30 hover:border-luz/60"
    : "border-zinc-800 hover:border-zinc-600";
  const opacity = muted ? "opacity-60 hover:opacity-100" : "";

  return (
    <Link
      href={href}
      style={{ animationDelay: `${index * 30}ms` }}
      className={`animate-fade-in flex items-center gap-2 rounded-xl border ${border} ${opacity} px-4 py-3 transition focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz`}
    >
      {celebrated && <PresenceDot />}
      <div>
        <p className="text-sm text-zinc-200">{title}</p>
        {statusLabel && <p className="mt-1 text-xs text-zinc-500">{statusLabel}</p>}
      </div>
    </Link>
  );
}
