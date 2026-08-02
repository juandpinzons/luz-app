/**
 * La expresión de fondo del personaje -- "cómo se siente LUZ respecto a
 * la vida de esta persona ahora mismo", derivada de evidencia real
 * (`services/derive-mood.ts`), nunca de una sola conversación. Cinco
 * valores, no seis: el boceto original de la misión incluía
 * `"thinking"` como emoción, pero pensar es una ACTIVIDAD (qué está
 * haciendo LUZ ahora mismo -- generando una respuesta), no una
 * disposición (cómo se siente respecto a la vida de la persona) --
 * movido a `AvatarAnimation`. Ver README, "Por qué `emotion` !=
 * boceto original" para el razonamiento completo.
 */
export const AVATAR_EMOTIONS = ["calm", "happy", "curious", "attentive", "celebrating"] as const;

export type AvatarEmotion = (typeof AVATAR_EMOTIONS)[number];
