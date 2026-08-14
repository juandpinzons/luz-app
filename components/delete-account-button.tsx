"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Confirmación en dos pasos, en línea -- nunca un `confirm()` nativo
 * del navegador (WhatsApp y otros navegadores integrados lo manejan de
 * forma inconsistente, ver P2-4 del backlog) ni un modal aparte. Borrado
 * real e irreversible (`deleteAccount`, `/api/account/delete`), así que
 * el primer estado es deliberadamente discreto -- nunca compite
 * visualmente con "Cerrar sesión".
 */
export function DeleteAccountButton() {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setIsDeleting(true);
    setError(null);
    try {
      const response = await fetch("/api/account/delete", { method: "POST" });
      if (!response.ok) {
        throw new Error();
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("No se pudo eliminar tu cuenta. Intenta de nuevo.");
      setIsDeleting(false);
      setIsConfirming(false);
    }
  }

  if (!isConfirming) {
    return (
      <button
        type="button"
        onClick={() => setIsConfirming(true)}
        className="whitespace-nowrap text-xs text-zinc-600 transition hover:text-red-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-luz"
      >
        Eliminar mi cuenta
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 whitespace-nowrap text-xs">
      <span className="text-red-400">¿Borrar todo, para siempre?</span>
      <button
        type="button"
        onClick={handleConfirm}
        disabled={isDeleting}
        className="rounded-full border border-red-800 px-2.5 py-1 text-red-400 transition hover:bg-red-950 disabled:opacity-50"
      >
        {isDeleting ? "Eliminando…" : "Sí, eliminar"}
      </button>
      <button
        type="button"
        onClick={() => setIsConfirming(false)}
        disabled={isDeleting}
        className="rounded-full border border-zinc-700 px-2.5 py-1 text-zinc-400 transition hover:text-white disabled:opacity-50"
      >
        Cancelar
      </button>
      {error && <span className="text-red-400">{error}</span>}
    </div>
  );
}
