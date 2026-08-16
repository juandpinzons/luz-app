import { env } from "../config/env";
import { decryptWithKey, encryptWithKey, loadCipherKey } from "./aes-gcm-cipher";

/**
 * Cifrado simétrico para secretos que este dominio necesita GUARDAR y
 * volver a leer en texto plano (a diferencia de una contraseña de
 * usuario, que solo se compara con hash) -- el caso concreto que lo
 * exige es `AppleCalendarCredentials.appSpecificPassword`
 * (`features/reality/providers/apple/`): CalDAV usa Basic Auth en cada
 * request, así que la contraseña real hace falta en cada sincronización,
 * no solo en el momento de conectar. Guardarla en texto plano sería
 * justo el tipo de vulnerabilidad real (exposición de datos sensibles)
 * que las reglas de este proyecto piden evitar activamente.
 *
 * AES-256-GCM vía `aes-gcm-cipher.ts` (ADR-0024 extrajo el primitivo
 * genérico de aquí para compartirlo con `content-cipher.ts` -- misma
 * implementación, llave distinta). Firma pública sin cambios: ningún
 * llamador existente necesita tocarse por este refactor.
 */

function loadKey(): Buffer {
  return loadCipherKey(env.CALENDAR_CREDENTIALS_ENCRYPTION_KEY, "CALENDAR_CREDENTIALS_ENCRYPTION_KEY");
}

export function encryptSecret(plaintext: string): string {
  return encryptWithKey(plaintext, loadKey());
}

export function decryptSecret(packed: string): string {
  return decryptWithKey(packed, loadKey());
}
