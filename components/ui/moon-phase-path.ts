/**
 * "La media luna" -- la luna no produce luz, la recibe y la devuelve;
 * el mismo gesto que LUZ hace con lo que la persona ya trae. `phase`
 * es la fracción iluminada (0 = luna nueva/toda oscura, 1 = luna
 * llena/toda dorada) -- el mismo path que arma el ícono real de iOS
 * (`native/ios/App/App/Assets.xcassets/AppIcon.appiconset/`, generado
 * una sola vez a un `phase` fijo porque el ícono del sistema operativo
 * no puede animarse en vivo) y el favicon/opengraph de la web (que sí
 * pueden recalcularse en cada request).
 *
 * `phase` fijo en 0.62 hoy -- "más de la mitad, hacia el lado
 * brillante" (pedido del Founder), no atado todavía a ninguna señal
 * real de "qué tanto te conoce LUZ" (ninguna existe hoy calculada así
 * en el dominio). Conectar `phase` a una señal real del LifeGraph es
 * trabajo aparte, deliberadamente no inventado acá.
 */
export function buildMoonPhasePath(cx: number, cy: number, r: number, phase: number): string {
  const clampedPhase = Math.max(0, Math.min(1, phase));
  const rx = Math.abs(2 * clampedPhase - 1) * r;
  const bulgesLeft = clampedPhase > 0.5;

  return `M ${cx},${cy - r} A ${r},${r} 0 0 1 ${cx},${cy + r} A ${rx},${r} 0 0 ${bulgesLeft ? 1 : 0} ${cx},${cy - r} Z`;
}

export const MOON_DARK_HALF = "#3f3856";
export const MOON_GOLD_HALF = "#e3b168";
export const MOON_BACKGROUND = "#241f36";
/** Fase por defecto usada hoy en el ícono estático (iOS/favicon/opengraph) -- ver docblock arriba. */
export const DEFAULT_MOON_PHASE = 0.62;
