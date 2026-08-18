"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMemorySelection } from "./memory-selection-context";

type View = "bar" | "choosing" | "confirming-delete";

async function hideMemory(id: string): Promise<Response> {
  return fetch(`/api/memories/${id}/hide`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hidden: true }),
  });
}

async function deleteMemory(id: string): Promise<Response> {
  return fetch(`/api/memories/${id}/delete`, { method: "POST" });
}

/**
 * Pedido directo del Founder (2026-08-17): al confirmar el borrado,
 * elegir la profundidad -- "primera capa" (ocultar, LUZ lo sigue
 * recordando) o "ambas capas" (eliminar, definitivo). Mismas dos rutas
 * que ya existían por tarjeta (`/api/memories/[id]/hide`, `/delete`),
 * ahora llamadas en paralelo para todos los ids seleccionados -- sin
 * endpoint de lote nuevo: los volúmenes reales de selección (unos
 * pocos recuerdos a la vez) no justifican esa complejidad.
 */
export function MemorySelectionBar() {
  const { selectedIds, clear } = useMemorySelection();
  const router = useRouter();
  const [view, setView] = useState<View>("bar");
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const count = selectedIds.size;
  if (count === 0) {
    return null;
  }

  async function runBatch(action: "hide" | "delete") {
    setIsWorking(true);
    setError(null);
    try {
      const ids = Array.from(selectedIds);
      const responses = await Promise.all(ids.map((id) => (action === "hide" ? hideMemory(id) : deleteMemory(id))));
      if (responses.some((response) => !response.ok)) {
        throw new Error();
      }
      clear();
      setView("bar");
      router.refresh();
    } catch {
      setError("No se pudo completar. Intenta de nuevo.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-6">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950/95 px-5 py-4 shadow-lg backdrop-blur">
        {view === "choosing" ? (
          <div className="space-y-2">
            <p className="text-sm text-zinc-300">
              {count === 1 ? "Este recuerdo" : `Estos ${count} recuerdos`} — ¿qué quieres hacer?
            </p>
            <button
              type="button"
              onClick={() => runBatch("hide")}
              disabled={isWorking}
              className="w-full rounded-xl border border-zinc-700 px-4 py-3 text-left transition hover:border-zinc-500 disabled:opacity-50"
            >
              <span className="block text-sm text-white">Ocultar</span>
              <span className="block text-xs text-zinc-500">
                Desaparece de tu vista, pero LUZ lo sigue recordando y usando en la conversación.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setView("confirming-delete")}
              disabled={isWorking}
              className="w-full rounded-xl border border-red-900 px-4 py-3 text-left transition hover:border-red-700 disabled:opacity-50"
            >
              <span className="block text-sm text-red-400">Eliminar definitivamente</span>
              <span className="block text-xs text-zinc-500">
                Se borra por completo, de las dos capas — no hay forma de deshacerlo.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setView("bar")}
              disabled={isWorking}
              className="w-full rounded-xl px-4 py-2 text-center text-xs text-zinc-500 transition hover:text-zinc-300 disabled:opacity-50"
            >
              {isWorking ? "Un momento…" : "Cancelar"}
            </button>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        ) : view === "confirming-delete" ? (
          // Segundo paso obligatorio antes de un borrado irreversible y
          // ahora en lote (auditoría de arquitectura, 2026-08-17) --
          // mismo criterio de dos pasos, nunca `window.confirm()`, que
          // ya usa `components/delete-account-button.tsx` y que el flujo
          // por tarjeta ya tenía antes de esta pantalla de selección
          // múltiple. Un solo tap para borrar varios recuerdos a la vez
          // era más riesgo del que el flujo original (uno a la vez)
          // aceptaba.
          <div className="space-y-2">
            <p className="text-sm text-red-400">
              ¿Eliminar {count === 1 ? "este recuerdo" : `estos ${count} recuerdos`} para siempre? No hay
              forma de deshacerlo.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => runBatch("delete")}
                disabled={isWorking}
                className="rounded-full border border-red-800 px-4 py-2 text-xs text-red-400 transition hover:bg-red-950 disabled:opacity-50"
              >
                {isWorking ? "Eliminando…" : "Sí, eliminar"}
              </button>
              <button
                type="button"
                onClick={() => setView("choosing")}
                disabled={isWorking}
                className="rounded-full border border-zinc-700 px-4 py-2 text-xs text-zinc-400 transition hover:text-white disabled:opacity-50"
              >
                Cancelar
              </button>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-zinc-300">
              {count} {count === 1 ? "recuerdo seleccionado" : "recuerdos seleccionados"}
            </span>
            <div className="flex flex-shrink-0 items-center gap-3">
              <button
                type="button"
                onClick={clear}
                className="text-xs text-zinc-500 transition hover:text-zinc-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setView("choosing")}
                className="rounded-full bg-white px-4 py-2 text-xs font-medium text-black transition hover:bg-zinc-200"
              >
                Eliminar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
