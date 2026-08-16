import { env } from "../config/env";
import { decryptWithKey, encryptWithKey, loadCipherKey } from "./aes-gcm-cipher";

/**
 * Cifrado simétrico para la SUSTANCIA de lo que una persona dice o LUZ
 * deriva de ello -- memorias, creencias, insights, conceptos,
 * contradicciones, conclusiones de razonamiento, mensajes de
 * conversación, feedback, embeddings.content, y los tokens OAuth de
 * Auth.js (ver `auth/encrypted-adapter.ts`). ADR-0024.
 *
 * Llave DISTINTA de `secret-cipher.ts` (`CONTENT_ENCRYPTION_KEY`, no
 * `CALENDAR_CREDENTIALS_ENCRYPTION_KEY`) -- a propósito: comprometer
 * una no debe comprometer la otra. Nunca vive en un `.env` local que
 * un humano con acceso de desarrollo pueda leer para descifrar
 * contenido real; solo en el entorno de runtime de producción
 * desplegado (ver ADR-0024, Decisión 2).
 *
 * Mismo formato/algoritmo que `secret-cipher.ts` (AES-256-GCM,
 * `iv:authTag:ciphertext` empaquetado en base64) vía el primitivo
 * compartido `aes-gcm-cipher.ts` -- ninguna librería ni formato nuevo
 * que auditar.
 */

function loadKey(): Buffer {
  return loadCipherKey(env.CONTENT_ENCRYPTION_KEY, "CONTENT_ENCRYPTION_KEY");
}

export function encryptContent(plaintext: string): string {
  return encryptWithKey(plaintext, loadKey());
}

export function decryptContent(packed: string): string {
  return decryptWithKey(packed, loadKey());
}

/**
 * Variantes null-safe -- varios campos en alcance (`Concept.description`
 * no, pero sí p.ej. futuros campos opcionales) pueden ser `null`/`undefined`
 * en la fila; cifrar/descifrar "nada" no tiene sentido y cada llamador
 * tendría que repetir el mismo `if` si esto no existiera aquí.
 */
export function encryptContentOrNull(plaintext: string | null | undefined): string | null {
  return plaintext == null ? null : encryptContent(plaintext);
}

export function decryptContentOrNull(packed: string | null | undefined): string | null {
  return packed == null ? null : decryptContent(packed);
}
