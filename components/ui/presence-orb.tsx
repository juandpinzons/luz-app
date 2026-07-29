import type { OrbMaturityStage } from "@/features/chat/services/generate-welcome";

/**
 * Versión pequeña y estática (sin coreografía de apertura, sin texto)
 * de la esfera que ya vive en `ConversationOpeningRitual` (Auditoría de
 * Experiencia V1, hallazgo H4) -- deliberadamente un componente propio,
 * no un refactor de `WelcomeSphere`: esa esfera ya está en producción
 * dentro del ritual de `/chat`, y tocarla para generalizarla arriesgaba
 * ese camino ya validado por una ganancia mínima (duplicar ~10 líneas
 * de gradiente es más seguro que re-derivar un componente que M4/el
 * chat ya dependen de que funcione exactamente igual). Mismo lenguaje
 * visual (gradiente ámbar, `--color-luz`, `animate-sphere-breathe`,
 * respeta `prefers-reduced-motion` vía la misma regla global en
 * `app/globals.css`), pensada para vivir en línea dentro de texto
 * normal, no como overlay de pantalla completa.
 */
export interface PresenceOrbSignature {
  maturityStage: OrbMaturityStage;
  /** 0 (apenas empezando) a 1 (relación asentada). */
  warmth: number;
  /** Duración de un ciclo de respiración, en ms. */
  rhythmMs: number;
}

const SIZE_CLASS: Record<OrbMaturityStage, string> = {
  spark: "h-6 w-6",
  steady: "h-8 w-8",
  radiant: "h-10 w-10",
};

export function PresenceOrb({
  signature,
  className = "",
}: {
  signature: PresenceOrbSignature;
  className?: string;
}) {
  const glowAlpha = 0.18 + signature.warmth * 0.22;

  return (
    <span
      aria-hidden="true"
      className={`inline-block flex-shrink-0 animate-sphere-breathe rounded-full ${SIZE_CLASS[signature.maturityStage]} ${className}`}
      style={{
        background:
          "radial-gradient(circle at 35% 30%, #ffffff 0%, var(--color-luz) 55%, rgba(227, 177, 104, 0.15) 100%)",
        boxShadow: `0 0 ${16 + signature.warmth * 16}px 6px rgba(227, 177, 104, ${glowAlpha})`,
        animationDuration: `${signature.rhythmMs}ms`,
      }}
    />
  );
}
