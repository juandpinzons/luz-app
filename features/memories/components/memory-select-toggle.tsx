"use client";

import { XIcon } from "@/components/ui/icons";
import { useMemorySelection } from "./memory-selection-context";

/**
 * La "x" de cada tarjeta (pedido directo del Founder) -- independiente
 * entre recuerdos: marcar uno no afecta a los demás, y marcar varios
 * es exactamente cómo se arma una selección múltiple. Nunca elimina
 * nada por sí sola -- solo agrega/quita el id de `MemorySelectionProvider`;
 * `MemorySelectionBar` es quien decide qué hacer con la selección.
 */
export function MemorySelectToggle({ memoryId }: { memoryId: string }) {
  const { isSelected, toggle } = useMemorySelection();
  const selected = isSelected(memoryId);

  return (
    <button
      type="button"
      onClick={() => toggle(memoryId)}
      aria-pressed={selected}
      aria-label={selected ? "Quitar de la selección" : "Seleccionar para eliminar"}
      className={
        selected
          ? "absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-950 text-red-400 ring-1 ring-red-800 transition"
          : "absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-zinc-600 transition hover:bg-zinc-900 hover:text-zinc-300"
      }
    >
      <XIcon className="h-3.5 w-3.5" />
    </button>
  );
}
