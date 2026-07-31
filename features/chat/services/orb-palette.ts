/**
 * Pura, sin dependencias -- separada de `generate-welcome.ts` a
 * propósito: ese archivo importa `getAIProvider`/`assembleRealitySnapshot`,
 * que arrastran validación de variables de entorno
 * (`core/config/env.ts`) con solo importarlos. Sin esta separación,
 * hasta un script de ejemplo standalone que solo quiera probar la
 * asignación de paleta terminaría exigiendo una base de datos real --
 * mismo criterio de separación ya aplicado en
 * `features/chat/services/calendar-signals.ts` vs.
 * `get-calendar-signals-for-conversation.ts`.
 */

/**
 * Familia de tonos cálidos "de marca" (variaciones de `--color-luz`,
 * nunca un color frío/ajeno) -- cada persona ve siempre el mismo,
 * nunca uno que cambie entre visitas ni entre dispositivos. No
 * pretende decir nada sobre quién es la persona (a diferencia de
 * `warmth`/`anticipation` en `OrbVisualSignature`, que sí son señales
 * reales): es una identidad visual estable, el mismo tipo de decisión
 * que asignarle a cada persona un color de avatar consistente -- nunca
 * una afirmación sobre su vida.
 */
export const ORB_PALETTE_NAMES = ["amber", "rose_gold", "copper", "honey", "coral", "champagne"] as const;
export type OrbPaletteName = (typeof ORB_PALETTE_NAMES)[number];

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
 * Misión "esfera personalizable": antes, dos personas distintas en
 * cuentas nuevas (el caso común hoy -- casi nadie pasa de `spark`
 * todavía) se veían prácticamente idénticas, porque lo único que
 * distinguía el orbe (`warmth`/`rhythmMs`/`maturityStage`) depende de
 * historial real que una cuenta nueva simplemente no tiene aún. El
 * color sí puede diferenciar desde el primer día, sin esperar a que
 * la relación tenga historia.
 */
export function deriveOrbPalette(personId: string): OrbPaletteName {
  return ORB_PALETTE_NAMES[stableHashIndex(personId, ORB_PALETTE_NAMES.length)];
}
