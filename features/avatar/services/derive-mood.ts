import type { ExperienceState } from "../../experience/domain/experience-state";
import type { IdentitySnapshot } from "../../identity-evolution/domain/identity-snapshot";
import type { NarrativeState } from "../../narrative/domain/narrative-state";
import type { PresenceState } from "../../presence/domain/presence-state";
import type { AvatarEmotion } from "../domain/avatar-emotion";
import type { AvatarGazeTarget } from "../domain/avatar-gaze";
import type { AvatarFocusRef, AvatarMoodSignal } from "../domain/avatar-mood-signal";

export interface DeriveMoodInput {
  readonly presence: PresenceState;
  readonly experience: ExperienceState;
  readonly narrative: NarrativeState;
  readonly identity: IdentitySnapshot;
  readonly now?: Date;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Cinco reglas, en orden de prioridad -- solo UNA gana, nunca una
 * mezcla. Cada una ya reutiliza una decisión que otro módulo tomó
 * primero (mismo criterio anti-duplicación que `derive-tone.ts`/
 * `toPresenceContinuitySignal`): esta función nunca vuelve a evaluar
 * urgencia, importancia o momentum desde cero, solo LEE lo que
 * Presence/Experience/Narrative/Identity ya decidieron y elige cuál de
 * esas decisiones debería liderar la cara del personaje ahora mismo.
 *
 * Orden deliberado: una urgencia crítica real siempre gana (algo
 * necesita a la persona AHORA); después una celebración real (las
 * buenas noticias se reconocen antes que una preocupación moderada,
 * personalidad "cálida" > "alarmista"); después urgencia alta; después
 * curiosidad (algo nuevo emergiendo); por último, calidez de fondo. Sin
 * ninguna de las cinco, `calm` -- nunca un estado fabricado (Principio
 * 1 del motor).
 */
export function deriveMood(input: DeriveMoodInput): AvatarMoodSignal {
  const asOf = input.now ?? new Date();
  const { presence, experience, narrative, identity } = input;

  const base = (emotion: AvatarEmotion, intensity: number, gaze: AvatarGazeTarget, focusRef: AvatarFocusRef | null, reason: string): AvatarMoodSignal => ({
    emotion,
    intensity: clamp01(intensity),
    gaze,
    focusRef,
    reason,
    asOf,
  });

  // 1. Urgencia crítica real -- Presence ya decidió que algo necesita a la persona ahora.
  if (presence.urgency === "critical" && presence.attentionNeeded.length > 0) {
    const top = presence.attentionNeeded[0]!;
    return base(
      "attentive",
      1,
      "highlight",
      { kind: "presence_focus", title: top.title },
      `Presencia marcó urgencia crítica: "${top.title}" entre ${presence.attentionNeeded.length} recomendación(es) real(es) pendiente(s).`,
    );
  }

  // 2. Celebración real -- Narrative o Experience ya encontraron algo que merece reconocimiento.
  if (narrative.celebrationCandidates.length > 0) {
    const top = [...narrative.celebrationCandidates].sort((a, b) => b.score - a.score)[0]!;
    return base(
      "celebrating",
      Math.max(0.6, top.score / 4),
      "highlight",
      { kind: "narrative_thread", title: top.title },
      `Narrative encontró un momento real de celebración: "${top.title}".`,
    );
  }
  if (experience.primary?.category === "celebration") {
    const card = experience.primary;
    return base(
      "celebrating",
      Math.max(0.6, card.importance / 4),
      "highlight",
      { kind: "experience_card", title: card.title },
      `Experience eligió una celebración real como protagonista del día: "${card.title}".`,
    );
  }

  // 3. Urgencia alta real -- misma fuente que 1, un escalón menos intenso.
  if (presence.urgency === "high" && presence.attentionNeeded.length > 0) {
    const top = presence.attentionNeeded[0]!;
    return base(
      "attentive",
      0.6,
      "highlight",
      { kind: "presence_focus", title: top.title },
      `Presencia marcó urgencia alta: "${top.title}".`,
    );
  }

  // 4. Curiosidad real -- una identidad emergiendo/renaciendo, o un eco temporal real en Narrative.
  if (identity.emergingThemes.length > 0) {
    const top = identity.emergingThemes[0]!;
    return base(
      "curious",
      clamp01(top.weight / 100),
      "highlight",
      { kind: top.unitKind === "theme" ? "identity_theme" : "identity_dimension", title: top.label },
      `Identity Evolution detectó "${top.label}" en momentum "${top.momentum}".`,
    );
  }
  if (narrative.currentActiveStory?.echo) {
    const title = narrative.currentActiveStory.current.title;
    return base(
      "curious",
      0.5,
      "highlight",
      { kind: "narrative_thread", title },
      `Narrative detectó un eco temporal real en "${title}" (hace ${narrative.currentActiveStory.echo.intervalMonths} meses).`,
    );
  }

  // 5. Calidez de fondo -- Presence ya decidió que hay algo bueno que reconocer, o la identidad principal está en un momentum real y positivo.
  if (presence.encouragement) {
    return base("happy", 0.5, "user", null, `Presencia ya preparó un reconocimiento real: "${presence.encouragement}".`);
  }
  if (identity.primaryIdentity && (identity.primaryIdentity.momentum === "stable" || identity.primaryIdentity.momentum === "emerging" || identity.primaryIdentity.momentum === "renewing")) {
    return base(
      "happy",
      0.45,
      "user",
      null,
      `"${identity.primaryIdentity.label}" lidera la identidad actual en momentum "${identity.primaryIdentity.momentum}".`,
    );
  }

  return base("calm", 0.25, "user", null, "Sin señal real que active otra expresión -- estado de reposo.");
}
