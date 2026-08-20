import Link from "next/link";
import type { MemoryMonthBucket } from "../services/get-memory-timeline-index";

interface MemoryTimelineSidebarProps {
  months: MemoryMonthBucket[];
  activeMonth?: string;
}

/**
 * Columna vertical fija, solo md+ (`hidden md:flex`) -- pedida
 * explícitamente por el Founder tras ver primero una franja
 * horizontal ("Yes. actual vertical sidebar."). En pantallas angostas
 * (shell móvil de iOS) se usa `MemoryTimelineStrip` en su lugar, misma
 * data -- una columna fija ahí se vería apretada. `sticky` para que
 * quede visible mientras se hace scroll de una lista larga de
 * recuerdos; `self-start` para que no se estire a la altura completa
 * del contenedor flex (sin esto, `sticky` no tiene margen para
 * moverse). Server Component puro, navegación por `<Link>`.
 */
export function MemoryTimelineSidebar({ months, activeMonth }: MemoryTimelineSidebarProps) {
  if (months.length === 0) return null;

  return (
    <nav
      aria-label="Línea de tiempo de recuerdos"
      className="sticky top-10 hidden w-44 shrink-0 flex-col gap-2 self-start border-l border-zinc-800 pl-5 md:flex"
    >
      {months.map((bucket) => {
        const isActive = bucket.month === activeMonth;
        return (
          <Link
            key={bucket.month}
            href={isActive ? "/memories" : `/memories?month=${bucket.month}`}
            className={
              isActive
                ? "text-sm text-white"
                : "text-sm text-zinc-500 transition hover:text-zinc-300"
            }
          >
            {bucket.label} <span className="text-xs text-zinc-600">{bucket.count}</span>
          </Link>
        );
      })}
    </nav>
  );
}
