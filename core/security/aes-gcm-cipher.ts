import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Primitivo genérico AES-256-GCM, parametrizado por llave -- extraído
 * de `secret-cipher.ts` (ADR-0024) para que `secret-cipher.ts` (llave
 * de credenciales de conector) y `content-cipher.ts` (llave de
 * contenido) compartan una sola implementación auditada en vez de
 * duplicar la lógica de cifrado. Ningún módulo fuera de `core/security/`
 * debe importar esto directamente -- siempre a través de un wrapper con
 * nombre de dominio (`encryptSecret`/`encryptContent`), nunca "cifra
 * esto con esta llave" genérico esparcido por el resto del código.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH_BYTES = 12;
export const CIPHER_KEY_LENGTH_BYTES = 32;

export function loadCipherKey(base64Key: string, envVarName: string): Buffer {
  const key = Buffer.from(base64Key, "base64");

  if (key.length !== CIPHER_KEY_LENGTH_BYTES) {
    // No debería pasar nunca -- `core/config/env.ts` ya valida el largo
    // al arrancar. Si esto se lanza, es porque algo construyó `env` sin
    // pasar por esa validación.
    throw new Error(
      `${envVarName} debe decodificar a ${CIPHER_KEY_LENGTH_BYTES} bytes en base64, decodificó a ${key.length}.`,
    );
  }

  return key;
}

/** Empaquetado como `iv:authTag:ciphertext`, cada parte en base64. */
export function encryptWithKey(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptWithKey(packed: string, key: Buffer): string {
  const parts = packed.split(":");
  if (parts.length !== 3) {
    throw new Error("decryptWithKey: formato inválido -- se esperaban 3 partes separadas por ':'.");
  }
  const [ivPart, authTagPart, ciphertextPart] = parts;

  const iv = Buffer.from(ivPart, "base64");
  const authTag = Buffer.from(authTagPart, "base64");
  const ciphertext = Buffer.from(ciphertextPart, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf-8");
}
