/**
 * Pura, sin dependencias -- todo lo que dependa de esto (incluyendo un
 * script de ejemplo standalone) nunca debe arrastrar validación de
 * variables de entorno ni acceso a base de datos con solo importarla.
 */

/**
 * Familia de tonos cálidos "de marca" (variaciones de `--color-luz`,
 * nunca un color frío/ajeno) -- cada persona ve siempre el mismo,
 * nunca uno que cambie entre visitas ni entre dispositivos. No
 * pretende decir nada sobre quién es la persona (a diferencia de
 * `warmth`/`anticipation` en `OrbState`, que sí son señales reales):
 * es una identidad visual estable, el mismo tipo de decisión que
 * asignarle a cada persona un color de avatar consistente -- nunca una
 * afirmación sobre su vida.
 */
export const ORB_PALETTE_NAMES = ["amber", "rose_gold", "copper", "honey", "coral", "champagne"] as const;
export type OrbPaletteName = (typeof ORB_PALETTE_NAMES)[number];

/**
 * RGB real de cada tono, "227, 177, 104" (formato listo para interpolar
 * dentro de `rgb(...)`/`rgba(..., alpha)`) -- única fuente de verdad,
 * nunca duplicada en el renderer. `amber` es literalmente
 * `--color-luz` (`app/globals.css`): quien no tiene todavía una
 * paleta real (estado neutral/fallback) ve exactamente el mismo orbe
 * de siempre, nunca un color nuevo por accidente.
 */
export const ORB_PALETTE_RGB: Record<OrbPaletteName, string> = {
  amber: "227, 177, 104",
  rose_gold: "224, 158, 149",
  copper: "214, 141, 92",
  honey: "222, 186, 96",
  coral: "222, 139, 118",
  champagne: "206, 193, 158",
};

/**
 * Hash determinístico y estable (mismo `personId` -> mismo índice,
 * siempre) -- no es criptográfico, no necesita serlo: el único
 * requisito real es "mismo input, mismo output, distribución
 * razonable entre las opciones", nunca aleatoriedad entre cargas.
 */
function stableHashIndex(value: string, length: number): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash % length;
}

/**
 * Identidad visual estable de una persona: antes, dos personas
 * distintas en cuentas nuevas (el caso común -- casi nadie pasa de
 * `spark` todavía) se veían prácticamente idénticas, porque lo único
 * que distinguía el orbe (`warmth`/`rhythmMs`/`maturityStage`) depende
 * de historial real que una cuenta nueva simplemente no tiene aún. El
 * color sí puede diferenciar desde el primer día, sin esperar a que la
 * relación tenga historia.
 */
export function deriveOrbPalette(personId: string): OrbPaletteName {
  return ORB_PALETTE_NAMES[stableHashIndex(personId, ORB_PALETTE_NAMES.length)];
}
