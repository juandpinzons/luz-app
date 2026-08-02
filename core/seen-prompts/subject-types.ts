/**
 * `subjectType` conocidos hoy -- constantes compartidas para que quien
 * filtra (`assemble-reality-snapshot.ts`) y quien marca visto
 * (`build-context.ts`) nunca puedan desincronizarse por un string
 * distinto escrito a mano en cada lado.
 */
export const SEEN_PROMPT_SUBJECT_TYPES = {
  intentionFollowup: "intention_followup",
  goalClosure: "goal_closure",
} as const;
