import { createHmac, randomBytes } from "node:crypto";

/**
 * TOTP (RFC 6238, HOTP RFC 4226) sobre `node:crypto` únicamente -- sin
 * dependencia nueva, mismo criterio que `aes-gcm-cipher.ts`. Usado por
 * el MFA real de `/admin` (auditoría de privacidad, 2026-08-17):
 * SHA-1/6 dígitos/paso de 30s es el estándar que Google Authenticator,
 * Authy, 1Password, etc. ya esperan -- no hay razón para inventar algo
 * distinto que esas apps no puedan leer.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const STEP_SECONDS = 30;
const DIGITS = 6;
/** Secreto de 160 bits (20 bytes) -- el tamaño que RFC 4226 recomienda para HMAC-SHA1. */
const SECRET_BYTES = 20;

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(base32: string): Buffer {
  const clean = base32.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function hotp(secretBytes: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8);
  // `counter` cabe holgadamente en 32 bits (30s * 2^32 = miles de
  // millones de años) -- se escriben los 4 bytes altos en 0 a propósito,
  // sin BigInt, para no arrastrar esa dependencia hasta aquí.
  counterBuffer.writeUInt32BE(0, 0);
  counterBuffer.writeUInt32BE(counter, 4);

  const hmac = createHmac("sha1", secretBytes).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  return String(binCode % 10 ** DIGITS).padStart(DIGITS, "0");
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(SECRET_BYTES));
}

/**
 * Ventana de ±1 paso (30s) para tolerar desfase de reloj entre el
 * teléfono y el servidor -- mismo margen que la mayoría de apps de
 * autenticación asumen que el verificador acepta.
 */
export function verifyTotpCode(
  base32Secret: string,
  code: string,
  windowSteps = 1,
  now: number = Date.now(),
): boolean {
  if (!/^\d{6}$/.test(code)) return false;

  const secretBytes = base32Decode(base32Secret);
  const counter = Math.floor(now / 1000 / STEP_SECONDS);

  for (let i = -windowSteps; i <= windowSteps; i++) {
    if (hotp(secretBytes, counter + i) === code) return true;
  }
  return false;
}

export function buildOtpAuthUri(base32Secret: string, accountLabel: string, issuer = "LUZ"): string {
  const params = new URLSearchParams({
    secret: base32Secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountLabel)}?${params.toString()}`;
}
