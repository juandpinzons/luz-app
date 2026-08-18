import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

/**
 * Un solo punto de entrada para haptics en toda la app -- nunca
 * `Capacitor.isNativePlatform()` repetido por cada llamador. No-op
 * silencioso fuera de la app nativa (`@capacitor/haptics` sí tiene una
 * implementación web, pero dispararla en un navegador normal no aporta
 * nada real y sería ruido).
 */
export async function triggerLightHaptic(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return;
  }
  try {
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Nunca debe romper la acción real (enviar un mensaje) por un fallo de haptics.
  }
}
