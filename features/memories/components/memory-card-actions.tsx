"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface MemoryCardActionsProps {
  memoryId: string;
}

/**
 * Restaurar un recuerdo ya oculto -- única acción que queda acá tras
 * la auditoría de selección múltiple (2026-08-17): "ocultar" y
 * "eliminar" ahora viven en el flujo unificado de la "x" +
 * `MemorySelectionBar` (mismas dos rutas, `/hide` y `/delete`, pero
 * disparadas en lote desde ahí). Restaurar es la única dirección que
 * ESE flujo no cubre (solo avanza hacia más restricción, nunca hacia
 * atrás) -- se queda como un toggle simple, de un solo tap, sin
 * confirmación, igual que siempre fue.
 */
export function MemoryCardActions({ memoryId }: MemoryCardActionsProps) {
  const router = useRouter();
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUnhide() {
    setIsToggling(true);
    setError(null);
    try {
      const response = await fetch(`/api/memories/${memoryId}/hide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: false }),
      });
      if (!response.ok) {
        throw new Error();
      }
      router.refresh();
    } catch {
      setError("No se pudo actualizar. Intenta de nuevo.");
    } finally {
      setIsToggling(false);
    }
  }

  return (
    <div className="mt-2 flex items-center gap-3 text-xs text-zinc-600">
      <button
        type="button"
        onClick={handleUnhide}
        disabled={isToggling}
        className="transition hover:text-zinc-300 disabled:opacity-40"
      >
        {isToggling ? "…" : "Mostrar de nuevo"}
      </button>
      {error && <span className="text-red-400">{error}</span>}
    </div>
  );
}
