import type { Memory } from "../../../core/memory-engine";

interface MemoryCardProps {
  memory: Memory;
  /** Contenido de memorias conectadas (`MemoryConnection`, ya real) ya resueltas — nunca una segunda consulta desde el componente. */
  connectedContents: string[];
  /** Títulos de Goal/Project que aparecen literalmente en `memory.content` (§3.2.1, misma búsqueda de texto, dirección inversa). */
  mentionedLifeTitles: string[];
  /** Posición dentro de la lista completa (no solo su grupo de tiempo) — solo para escalonar la entrada; recortada por el llamador para que una lista larga no tarde en aparecer. */
  index?: number;
}

/**
 * Memoria individual: contenido, conexiones (docs/product/
 * ALPHA_EXPERIENCE_V1_DESIGN.md §4.3). Ya no muestra `memory.type`
 * como etiqueta ("patrón"/"hecho"/"ritual"...) -- esa es la taxonomía
 * interna del Memory Engine, no algo que la persona necesite leer
 * sobre su propio recuerdo. La cita habla por sí sola.
 */
export function MemoryCard({
  memory,
  connectedContents,
  mentionedLifeTitles,
  index = 0,
}: MemoryCardProps) {
  return (
    <li
      className="animate-fade-in rounded-lg border border-zinc-800 px-4 py-3 text-sm"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <p className="text-zinc-300">&ldquo;{memory.content}&rdquo;</p>

      {(connectedContents.length > 0 || mentionedLifeTitles.length > 0) && (
        <div className="mt-2 space-y-1 text-xs text-zinc-500">
          {connectedContents.map((content, index) => (
            <p key={`connected-${index}`}>
              — también pensé en esto: &ldquo;{content}&rdquo;
            </p>
          ))}
          {mentionedLifeTitles.map((title) => (
            <p key={`mentions-${title}`}>— tiene que ver con {title}</p>
          ))}
        </div>
      )}
    </li>
  );
}
