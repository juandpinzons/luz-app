/**
 * "LUZ está pensando" antes de que llegue el primer token real del
 * streaming (ADR-0017) — tres puntos, nunca un spinner: un spinner
 * comunica una operación técnica en curso; esto debe leerse como una
 * pausa antes de hablar, no como una carga de datos.
 */
export function TypingIndicator() {
  return (
    <div
      role="status"
      aria-label="LUZ está pensando"
      className="mr-auto flex w-fit animate-fade-in items-center gap-1.5 rounded-2xl bg-zinc-800 px-5 py-3"
    >
      <span className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-zinc-400 [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-zinc-400 [animation-delay:180ms]" />
      <span className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-zinc-400 [animation-delay:360ms]" />
    </div>
  );
}
