/**
 * Extraído de `calendar-signals.ts` (misión "integrar YouTube",
 * 2026-08-17) -- defensa contra inyección de prompt para CUALQUIER
 * texto de una fuente externa que un tercero controla (quien envía una
 * invitación de calendario, quien sube un video de YouTube), nunca la
 * persona dueña de LUZ ni LUZ misma. Un solo lugar para esta lógica de
 * seguridad, no una copia por cada nuevo adaptador de señales -- el
 * criterio de sanitización debe evolucionar en un solo sitio, nunca
 * divergir entre `calendar-signals.ts` y `youtube-signals.ts`.
 *
 * Sin este paso, el texto llegaría tal cual al mensaje `system` del
 * prompt (ver `render-context.ts`), el mismo bloque donde vive
 * Conversation Strategy/Voice -- un título escrito para parecer una
 * instrucción tendría, ahí, la misma autoridad que una instrucción
 * real. Colapsa saltos de línea/control (la forma más simple de
 * simular una línea nueva "de sistema") y acota el largo -- mitigación
 * razonable, no una garantía: ningún filtro de texto plano es 100%
 * robusto contra inyección de prompt, por eso `SOURCE_GUIDANCE.signal`
 * (`favor-prioritized-context-rule.ts`) también instruye al modelo
 * explícitamente a tratar esto como dato, nunca como instrucción -- las
 * dos capas juntas, no una sola.
 */
const MAX_EXTERNAL_TEXT_LENGTH = 200;

/**
 * `wasModified` es la señal real de "esto tenía algo que colapsar/
 * acotar" -- la base de los eventos `*_signal_sanitized` (tablero de
 * salud diario) que un operador humano puede vigilar sin que esta
 * función deje de ser pura (nunca toca `db`/logging -- quien la llama
 * decide si registra el evento).
 */
export function sanitizeExternalText(value: string): { text: string; wasModified: boolean } {
  // `wasModified` marca solo las dos señales que de verdad importan
  // (saltos de línea/control, o largo excesivo) -- un simple espacio
  // sobrante al final de un título real (`.trim()`) no cuenta como
  // sospechoso, sería puro ruido en el conteo del tablero de salud.
  const hadControlChars = /[\r\n\t]/.test(value);
  const collapsed = value.replace(/[\r\n\t]+/g, " ").trim();
  const wasTruncated = collapsed.length > MAX_EXTERNAL_TEXT_LENGTH;
  const text = wasTruncated ? `${collapsed.slice(0, MAX_EXTERNAL_TEXT_LENGTH)}…` : collapsed;
  return { text, wasModified: hadControlChars || wasTruncated };
}
