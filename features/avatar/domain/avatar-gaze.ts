/**
 * Hacia dónde parece mirar el personaje -- semántico, nunca una
 * posición de píxeles ni el nombre de una superficie de UI concreta
 * ("dashboard"/"calendar" del boceto original). Un tipo de backend
 * nunca debe codificar layout de pantalla (mismo límite que
 * `PresenceFocusItem`, que expone `entities`/`type` pero nunca
 * coordenadas): `AvatarFocusRef` (`presence-avatar-state.ts`) lleva el
 * significado ("está mirando hacia ESTA recomendación real"), y cada
 * página decide dónde apunta eso en su propio layout.
 */
export const AVATAR_GAZE_TARGETS = ["user", "highlight", "away"] as const;

export type AvatarGazeTarget = (typeof AVATAR_GAZE_TARGETS)[number];
