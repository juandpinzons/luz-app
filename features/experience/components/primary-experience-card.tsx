import type { PresenceUrgencyLevel } from "../../presence/domain/presence-state";
import type { ExperienceCard } from "../domain/experience-state";
import { EXPERIENCE_CATEGORY_LABELS } from "../labels";

/** Mismo espíritu que `TONE_CEILING` en `derive-tone.ts`: el color es proporcional al tono, nunca decorativo por categoría. */
const TONE_BORDER: Record<PresenceUrgencyLevel, string> = {
  critical: "border-red-500/40",
  high: "border-amber-500/40",
  medium: "border-luz/25",
  low: "border-zinc-800",
};

interface PrimaryExperienceCardProps {
  card: ExperienceCard;
  tone: PresenceUrgencyLevel;
  /** `ExperienceState.isNewPrimary` -- "qué cambió desde la última visita" (Fase 1), pasado tal cual, nunca recalculado en la UI. */
  isNew: boolean;
}

/**
 * LA experiencia primaria de hoy -- una sola tarjeta, nunca una lista.
 * Todo lo demás en Home (`SecondaryExperienceList`, el calendario de
 * hoy, la memoria reciente) es deliberadamente más pequeño y muted:
 * "debe haber SIEMPRE una experiencia primaria; todo lo demás la
 * apoya" (Fase 1).
 */
export function PrimaryExperienceCard({ card, tone, isNew }: PrimaryExperienceCardProps) {
  return (
    <section className={`animate-fade-in mt-8 rounded-2xl border ${TONE_BORDER[tone]} bg-zinc-900/60 px-5 py-5`}>
      <div className="flex items-center gap-2">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {EXPERIENCE_CATEGORY_LABELS[card.category]}
        </p>
        {isNew && (
          <span className="rounded-full bg-luz/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-luz">
            Nuevo
          </span>
        )}
      </div>
      <p className="mt-2 text-lg text-zinc-100">{card.title}</p>
      <p className="mt-1 text-sm text-zinc-400">{card.detail}</p>
    </section>
  );
}
