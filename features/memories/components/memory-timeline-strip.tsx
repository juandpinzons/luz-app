import Link from "next/link";
import type { MemoryMonthBucket } from "../services/get-memory-timeline-index";

interface MemoryTimelineStripProps {
  months: MemoryMonthBucket[];
  activeMonth?: string;
}

/**
 * Franja horizontal de meses -- fallback para pantallas angostas
 * (shell móvil de iOS, donde una columna lateral fija se ve apretada).
 * `md:hidden`: en md+ la navegación real es `MemoryTimelineSidebar`
 * (columna vertical, pedida explícitamente por el Founder tras ver
 * esta franja). Misma data (`months`), dos formas -- nunca dos
 * consultas. Server Component puro, navegación por `<Link>`.
 */
export function MemoryTimelineStrip({ months, activeMonth }: MemoryTimelineStripProps) {
  if (months.length === 0) return null;

  return (
    <nav
      aria-label="Línea de tiempo de recuerdos"
      className="animate-fade-in mt-4 flex gap-2 overflow-x-auto pb-2 md:hidden"
    >
      {months.map((bucket) => {
        const isActive = bucket.month === activeMonth;
        return (
          <Link
            key={bucket.month}
            href={isActive ? "/memories" : `/memories?month=${bucket.month}`}
            className={
              isActive
                ? "whitespace-nowrap rounded-full bg-white px-3 py-1.5 text-xs text-black transition"
                : "whitespace-nowrap rounded-full bg-zinc-900 px-3 py-1.5 text-xs text-zinc-400 ring-1 ring-zinc-800 transition hover:text-zinc-200"
            }
          >
            {bucket.label}{" "}
            <span className={isActive ? "text-zinc-500" : "text-zinc-600"}>{bucket.count}</span>
          </Link>
        );
      })}
    </nav>
  );
}
