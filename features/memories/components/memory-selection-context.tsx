"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface MemorySelectionContextValue {
  selectedIds: ReadonlySet<string>;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  clear: () => void;
}

const MemorySelectionContext = createContext<MemorySelectionContextValue | null>(null);

/**
 * Pedido directo del Founder (2026-08-17): una "x" por recuerdo que
 * entra en modo selección -- varias tarjetas, repartidas en distintas
 * secciones de `/memories` (highlights, cronológico, ocultos), tienen
 * que compartir el mismo conjunto de seleccionados. `MemoryCard` sigue
 * siendo Server Component (nunca necesitó estado propio); solo el
 * botón "x" (`MemorySelectToggle`) y la barra de acción
 * (`MemorySelectionBar`) leen este contexto -- el árbol de datos real
 * (contenido, conexiones) sigue viniendo del servidor, esto solo
 * coordina qué ids están marcados.
 */
export function MemorySelectionProvider({ children }: { children: React.ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelectedIds(new Set()), []);
  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const value = useMemo(
    () => ({ selectedIds, isSelected, toggle, clear }),
    [selectedIds, isSelected, toggle, clear],
  );

  return <MemorySelectionContext.Provider value={value}>{children}</MemorySelectionContext.Provider>;
}

export function useMemorySelection(): MemorySelectionContextValue {
  const context = useContext(MemorySelectionContext);
  if (!context) {
    throw new Error("useMemorySelection debe usarse dentro de <MemorySelectionProvider>.");
  }
  return context;
}
