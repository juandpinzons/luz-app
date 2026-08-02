import { LIFE_DOMAIN_LABEL, type LifeDomainType } from "../../../core/life";
import type { RealitySnapshot } from "../../../core/reality";

export interface ConversationChapter {
  domain: LifeDomainType;
  label: string;
}

/**
 * "Qué capítulo está viviendo" (redesign del pipeline conversacional,
 * Beta) -- computado, nunca persistido: el dominio de vida (`core/life`
 * "wheel of life") con más actividad activa ahora mismo, derivado cada
 * vez de `RealitySnapshot.life`, ya presente en cada turno. Deliberadamente
 * NO un modelo de "arco"/Journey nuevo -- `docs/foundations/HUMAN_RELATIONSHIP_MODEL.md`
 * §9 y `docs/product/ALPHA_EXPERIENCE_V1_DESIGN.md` §1.4 ya marcan esa
 * representación (progreso, reveses, cierre narrativo) como sin
 * resolver y fuera de alcance -- esto responde "qué merece atención
 * hoy" a partir de datos reales que ya existen, sin inventar una
 * entidad nueva para hacerlo.
 *
 * `null` si no hay ningún goal/project/habit activo todavía -- ausencia
 * real representada como ausencia, mismo criterio que el resto de
 * `RealitySnapshot`.
 */
export function deriveConversationChapter(
  snapshot: RealitySnapshot,
): ConversationChapter | null {
  const countsByDomain = new Map<LifeDomainType, number>();
  const bump = (domain: LifeDomainType | undefined): void => {
    if (!domain) return;
    countsByDomain.set(domain, (countsByDomain.get(domain) ?? 0) + 1);
  };

  for (const goal of snapshot.life.activeGoals) bump(goal.domain);
  for (const project of snapshot.life.activeProjects) bump(project.domain);
  for (const habit of snapshot.life.activeHabits) bump(habit.domain);

  if (countsByDomain.size === 0) {
    return null;
  }

  // Empate desempatado por nombre de dominio -- 100% determinístico
  // entre corridas, mismo criterio que `apply-rotation.ts`.
  const [dominant] = [...countsByDomain.entries()].sort((a, b) => {
    const countDelta = b[1] - a[1];
    return countDelta !== 0 ? countDelta : a[0].localeCompare(b[0]);
  });

  if (!dominant) {
    return null;
  }

  const [domain] = dominant;
  return { domain, label: LIFE_DOMAIN_LABEL[domain] };
}
