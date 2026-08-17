/**
 * Techo absoluto de videos que este cimiento deja conocidos a la vez --
 * mismo espíritu de política de producto que `EMAIL_SYNC_HARD_CEILING`
 * (`email-sync-options.ts`): "últimos N", nunca el historial completo
 * de likes de la cuenta. Se hace cumplir en código, ver
 * `providers/youtube/youtube-provider.ts`.
 */
export const YOUTUBE_SYNC_HARD_CEILING = 10;
