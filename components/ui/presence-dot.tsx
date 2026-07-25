/**
 * Señal mínima y persistente de que LUZ está presente — un punto que
 * respira (`animate-pulse-soft`, `app/globals.css`), nunca un ícono de
 * estado técnico tipo "en línea"/"conectado". Sprint "Identity,
 * Presence & Product Experience": antes el acento `--color-luz` vivía
 * en un solo lugar (el ring del ítem de navegación activo,
 * `components/app-shell.tsx`) — este es el segundo uso, deliberado,
 * no una casualidad de diseño.
 *
 * Decorativo (`aria-hidden`): el elemento que lo envuelve (el
 * wordmark, un enlace) ya se anuncia por su cuenta a un lector de
 * pantalla — este punto no aporta información adicional.
 */
export function PresenceDot({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-1.5 w-1.5 flex-shrink-0 animate-pulse-soft rounded-full bg-luz ${className}`}
    />
  );
}
