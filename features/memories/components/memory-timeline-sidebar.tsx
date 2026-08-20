import Link from "next/link";
import type { MemoryMonthBucket } from "../services/get-memory-timeline-index";

interface MemoryTimelineSidebarProps {
  months: MemoryMonthBucket[];
  activeMonth?: string;
}

/**
 * Franja horizontal de meses con recuerdos ("desplazarse por fechas",
 * pedido del Founder) -- franja horizontal, no columna lateral fija:
 * esta página no tiene layout de dos columnas en ningún otro lugar, y
 * una columna fija se vería apretada en el shell móvil de iOS
 * (decisión confirmada con el Founder antes de construir esto).
 * Server Component puro, navegación por `<Link>` -- mismo patrón sin
 * JS de cliente que `?view=hidden`/`?view=all`/búsqueda ya usan en
 * esta página. Click sobre el mes ya activo lo deselecciona (vuelve a
 * `/memories`), mismo criterio que un filtro tipo chip.
 */
export function MemoryTimelineSidebar({ months, activeMonth }: MemoryTimelineSidebarProps) {
  if (months.length === 0) return null;

  return (
    <nav
      aria-label="Línea de tiempo de recuerdos"
      className="animate-fade-in mt-4 flex gap-2 overflow-x-auto pb-2"
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
