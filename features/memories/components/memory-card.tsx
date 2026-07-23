import type { Memory } from "../../../core/memory-engine";
import { MEMORY_TYPE_LABELS } from "../labels";

interface MemoryCardProps {
  memory: Memory;
  /** Contenido de memorias conectadas (`MemoryConnection`, ya real) ya resueltas — nunca una segunda consulta desde el componente. */
  connectedContents: string[];
  /** Títulos de Goal/Project que aparecen literalmente en `memory.content` (§3.2.1, misma búsqueda de texto, dirección inversa). */
  mentionedLifeTitles: string[];
}

/** Memoria individual: contenido, tipo, conexiones (docs/product/ALPHA_EXPERIENCE_V1_DESIGN.md §4.3). */
export function MemoryCard({
  memory,
  connectedContents,
  mentionedLifeTitles,
}: MemoryCardProps) {
  return (
    <li className="rounded-lg border border-zinc-800 px-4 py-3 text-sm">
      <div className="flex items-start justify-between gap-3">
        <p className="text-zinc-300">&ldquo;{memory.content}&rdquo;</p>
        <span className="flex-shrink-0 rounded-full border border-zinc-800 px-2 py-0.5 text-xs text-zinc-500">
          {MEMORY_TYPE_LABELS[memory.type]}
        </span>
      </div>

      {(connectedContents.length > 0 || mentionedLifeTitles.length > 0) && (
        <div className="mt-2 space-y-1 text-xs text-zinc-500">
          {connectedContents.map((content, index) => (
            <p key={`connected-${index}`}>
              ⟶ conectada con: &ldquo;{content}&rdquo;
            </p>
          ))}
          {mentionedLifeTitles.map((title) => (
            <p key={`mentions-${title}`}>⟶ menciona: {title}</p>
          ))}
        </div>
      )}
    </li>
  );
}
