import Link from "next/link";
import type { Memory } from "../../../core/memory-engine";
import { MemoryCardActions } from "./memory-card-actions";
import { MemorySelectToggle } from "./memory-select-toggle";
import { truncateText } from "./truncate-text";

interface MemoryCardProps {
  memory: Memory;
  /** Contenido de memorias conectadas (`MemoryConnection`, ya real) ya resueltas — nunca una segunda consulta desde el componente. */
  connectedContents: string[];
  /** Títulos de Goal/Project que aparecen literalmente en `memory.content` (§3.2.1, misma búsqueda de texto, dirección inversa). */
  mentionedLifeTitles: string[];
  /**
   * Resuelto por el llamador (`resolveConversationIdsForMessages`,
   * por lote -- nunca una consulta por tarjeta) solo cuando
   * `memory.source === "conversation"` y el `sourceId` sí pertenece a
   * esta persona. `undefined` cuando no aplica (memoria de otro
   * origen, o la conversación no se pudo resolver) -- en ese caso no
   * se muestra ningún enlace, nunca uno roto.
   */
  conversationId?: string;
  /** Posición dentro de la lista completa (no solo su grupo de tiempo) — solo para escalonar la entrada; recortada por el llamador para que una lista larga no tarde en aparecer. */
  index?: number;
  /**
   * `false` por defecto para no romper otros llamadores de esta
   * tarjeta. Cuando es `true`, muestra la "x" (`MemorySelectToggle`,
   * selección múltiple para ocultar/eliminar -- auditoría de
   * interfaz, 2026-08-17) y, si además `isHidden`, el toggle de
   * restaurar (`MemoryCardActions`).
   */
  showActions?: boolean;
  /** Vista `?view=hidden` de `/memories` -- solo cambia si además de la "x" se muestra "Mostrar de nuevo". */
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
  conversationId,
  index = 0,
  showActions = false,
  isHidden = false,
}: MemoryCardProps) {
  const shownConnections = connectedContents.slice(0, MAX_CONNECTED_CONTENTS_SHOWN);
  const hiddenConnectionCount = connectedContents.length - shownConnections.length;

  return (
    <li
      className="animate-fade-in relative rounded-lg border border-zinc-800 px-4 py-3 pr-10 text-sm"
      style={{ animationDelay: `${index * 30}ms` }}
    >
      {showActions && <MemorySelectToggle memoryId={memory.id} />}

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

      {conversationId && (
        <p className="mt-2 text-xs">
          <Link
            href={`/conversations/${conversationId}`}
            className="text-zinc-500 underline decoration-zinc-700 underline-offset-4 hover:text-zinc-300"
          >
            Ver conversación →
          </Link>
        </p>
      )}

      {showActions && isHidden && <MemoryCardActions memoryId={memory.id} />}
    </li>
  );
}
