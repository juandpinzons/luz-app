import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Token de sesión MFA firmado (HMAC-SHA256), separado de la sesión de
 * Auth.js -- confirma "este admin pasó el desafío TOTP hace menos de
 * `SESSION_HOURS`", nunca reemplaza el login real. Reutiliza
 * `AUTH_SECRET` (ya obligatorio en producción, mismo archivo lo lee
 * `process.env` directo -- ver `.env.example`) en vez de pedir una
 * llave nueva solo para esto.
 *
 * Formato: `${adminUserId}.${expiresAtEpochMs}.${hmacHex}` -- sin
 * cifrar (no hay nada secreto en el payload, solo autenticado) para
 * que verificar no necesite descifrar, solo comparar el HMAC.
 */

const SESSION_HOURS = 12;

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET no está configurado -- requerido para firmar la sesión de MFA.");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function createAdminMfaSessionToken(adminUserId: string): string {
  const expiresAt = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  const payload = `${adminUserId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminMfaSessionToken(token: string | undefined, adminUserId: string): boolean {
  if (!token) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [tokenUserId, expiresAtRaw, mac] = parts;

  if (tokenUserId !== adminUserId) return false;

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  const expectedMac = sign(`${tokenUserId}.${expiresAtRaw}`);
  const macBuffer = Buffer.from(mac, "hex");
  const expectedBuffer = Buffer.from(expectedMac, "hex");
  if (macBuffer.length !== expectedBuffer.length) return false;

  return timingSafeEqual(macBuffer, expectedBuffer);
}

export const ADMIN_MFA_COOKIE_NAME = "luz_admin_mfa";
