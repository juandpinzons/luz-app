import type { Memory } from "../../../core/memory-engine";
import { MemoryCardActions } from "./memory-card-actions";
import { truncateText } from "./truncate-text";

interface MemoryCardProps {
  memory: Memory;
  /** Contenido de memorias conectadas (`MemoryConnection`, ya real) ya resueltas — nunca una segunda consulta desde el componente. */
  connectedContents: string[];
  /** Títulos de Goal/Project que aparecen literalmente en `memory.content` (§3.2.1, misma búsqueda de texto, dirección inversa). */
  mentionedLifeTitles: string[];
  /** Posición dentro de la lista completa (no solo su grupo de tiempo) — solo para escalonar la entrada; recortada por el llamador para que una lista larga no tarde en aparecer. */
  index?: number;
  /**
   * Segunda capa de memoria (auditoría de arquitectura, 2026-08-16) --
   * `false` por defecto para no romper los otros llamadores de esta
   * tarjeta (highlights, "ver todo"). Cuando es `true`, solo cambia el
   * texto del toggle en `MemoryCardActions` -- el mismo componente
   * sirve ambas vistas.
   */
  showActions?: boolean;
  isHidden?: boolean;
}

/** Antes se mostraba texto completo sin límite -- una memoria larga, con varias conexiones, ocupaba varias pantallas. La cita principal sigue siendo el contenido real (nunca un resumen generado), solo recortada si es larga. */
const CONTENT_MAX_LENGTH = 220;
const CONNECTED_CONTENT_MAX_LENGTH = 70;
/** Antes se listaban TODAS las conexiones completas -- con varias, la tarjeta dejaba de leerse como "un recuerdo" y pasaba a ser una lista. Una sola, con conteo de las demás, sigue mostrando que existe la conexión sin la sobrecarga. */
const MAX_CONNECTED_CONTENTS_SHOWN = 1;

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
  showActions = false,
  isHidden = false,
}: MemoryCardProps) {
  const shownConnections = connectedContents.slice(0, MAX_CONNECTED_CONTENTS_SHOWN);
  const hiddenConnectionCount = connectedContents.length - shownConnections.length;

  return (
    <li
      className="animate-fade-in rounded-lg border border-zinc-800 px-4 py-3 text-sm"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <p className="text-zinc-300">&ldquo;{truncateText(memory.content, CONTENT_MAX_LENGTH)}&rdquo;</p>

      {(shownConnections.length > 0 || mentionedLifeTitles.length > 0) && (
        <div className="mt-2 space-y-1 text-xs text-zinc-500">
          {shownConnections.map((content, contentIndex) => (
            <p key={`connected-${contentIndex}`}>
              — también pensé en esto: &ldquo;{truncateText(content, CONNECTED_CONTENT_MAX_LENGTH)}&rdquo;
              {hiddenConnectionCount > 0 && ` (+${hiddenConnectionCount} más)`}
            </p>
          ))}
          {mentionedLifeTitles.map((title) => (
            <p key={`mentions-${title}`}>— tiene que ver con {title}</p>
          ))}
        </div>
      )}

      {showActions && <MemoryCardActions memoryId={memory.id} isHidden={isHidden} />}
    </li>
  );
}
