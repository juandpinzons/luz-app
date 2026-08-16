"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface MemoryCardActionsProps {
  memoryId: string;
  /** Si esta tarjeta se está mostrando dentro de la vista `?view=hidden` -- cambia el texto del toggle ("Mostrar de nuevo" vs "Ocultar de mi vista"), nunca el endpoint (el mismo `hide` route hace ambas direcciones). */
  isHidden: boolean;
}

/**
 * Dos acciones de la segunda capa de memoria (auditoría de
 * arquitectura, 2026-08-16): ocultar/mostrar (reversible, un toggle
 * simple -- mismo patrón que `app/calendar/disconnect-button.tsx`) y
 * eliminar (irreversible, confirmación en dos pasos en línea -- mismo
 * patrón que `components/delete-account-button.tsx`, nunca
 * `window.confirm()`).
 */
export function MemoryCardActions({ memoryId, isHidden }: MemoryCardActionsProps) {
  const router = useRouter();
  const [isToggling, setIsToggling] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggleHidden() {
    setIsToggling(true);
    setError(null);
    try {
      const response = await fetch(`/api/memories/${memoryId}/hide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: !isHidden }),
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

  async function handleConfirmDelete() {
    setIsDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/memories/${memoryId}/delete`, { method: "POST" });
      if (!response.ok) {
        throw new Error();
      }
      router.refresh();
    } catch {
      setError("No se pudo eliminar. Intenta de nuevo.");
      setIsDeleting(false);
      setIsConfirmingDelete(false);
    }
  }

  if (isConfirmingDelete) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-red-400">¿Eliminar para siempre?</span>
        <button
          type="button"
          onClick={handleConfirmDelete}
          disabled={isDeleting}
          className="rounded-full border border-red-800 px-2.5 py-1 text-red-400 transition hover:bg-red-950 disabled:opacity-50"
        >
          {isDeleting ? "Eliminando…" : "Sí, eliminar"}
        </button>
        <button
          type="button"
          onClick={() => setIsConfirmingDelete(false)}
          disabled={isDeleting}
          className="rounded-full border border-zinc-700 px-2.5 py-1 text-zinc-400 transition hover:text-white disabled:opacity-50"
        >
          Cancelar
        </button>
        {error && <span className="text-red-400">{error}</span>}
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-3 text-xs text-zinc-600">
      <button
        type="button"
        onClick={handleToggleHidden}
        disabled={isToggling}
        className="transition hover:text-zinc-300 disabled:opacity-40"
      >
        {isToggling ? "…" : isHidden ? "Mostrar de nuevo" : "Ocultar de mi vista"}
      </button>
      <button
        type="button"
        onClick={() => setIsConfirmingDelete(true)}
        className="transition hover:text-red-400"
      >
        Eliminar
      </button>
      {error && <span className="text-red-400">{error}</span>}
    </div>
  );
}
