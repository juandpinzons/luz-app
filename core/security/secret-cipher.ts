import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "../config/env";

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
 * AES-256-GCM vía `node:crypto` (sin dependencia nueva): autenticado
 * (`authTag` detecta cualquier manipulación del texto cifrado, no solo
 * confidencialidad) y ya viene con Node, no hace falta elegir ni auditar
 * una librería externa para algo tan sensible.
 *
 * Empaquetado como `iv:authTag:ciphertext`, cada parte en base64 --
 * un solo string de columna, sin tres columnas separadas que alguien
 * podría desalinear al leer/escribir.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
const KEY_LENGTH_BYTES = 32;

function loadKey(): Buffer {
  const key = Buffer.from(env.CALENDAR_CREDENTIALS_ENCRYPTION_KEY, "base64");

  if (key.length !== KEY_LENGTH_BYTES) {
    // No debería pasar nunca -- `core/config/env.ts` ya valida el largo
    // al arrancar. Si esto se lanza, es porque algo construyó `env`
    // sin pasar por esa validación.
    throw new Error(
      `CALENDAR_CREDENTIALS_ENCRYPTION_KEY debe decodificar a ${KEY_LENGTH_BYTES} bytes en base64, decodificó a ${key.length}.`,
    );
  }

  return key;
}

export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptSecret(packed: string): string {
  const parts = packed.split(":");
  if (parts.length !== 3) {
    throw new Error("decryptSecret: formato inválido -- se esperaban 3 partes separadas por ':'.");
  }
  const [ivPart, authTagPart, ciphertextPart] = parts;

  const key = loadKey();
  const iv = Buffer.from(ivPart, "base64");
  const authTag = Buffer.from(authTagPart, "base64");
  const ciphertext = Buffer.from(ciphertextPart, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf-8");
}
