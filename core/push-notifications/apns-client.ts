/**
 * Cliente HTTP/2 aislado para Apple Push Notification service (APNs)
 * -- misión "shell nativo iOS", 2026-08-18. Única responsabilidad:
 * hablar con `api(.sandbox).push.apple.com`. No decide a quién
 * enviarle nada ni qué hacer con un token inválido -- eso es trabajo
 * de `send-push-notification.ts`. Mismo reparto de responsabilidad que
 * `gmail-client.ts`/`youtube-client.ts`.
 *
 * Autenticación por token (.p8 + Team ID + Key ID, RFC 7519 firmado
 * ES256) -- nunca certificados (expiran cada año, requieren renovación
 * manual en el portal de Apple; un token firmado por este cliente no
 * expira nunca por sí solo). Usa `node:http2`/`node:crypto` directo,
 * sin librería nueva -- mismo criterio que el resto del repo (`randomBytes`
 * de `node:crypto` ya se usa así en las rutas OAuth), y el JWT de APNs
 * es lo bastante simple (dos claims, firma ES256 en formato IEEE
 * P1363) para no justificar una dependencia nueva.
 *
 * Requiere runtime Node real (HTTP/2), nunca Edge -- ninguna ruta que
 * importe esto debe declarar `export const runtime = "edge"`.
 */

import { connect } from "node:http2";
import { sign } from "node:crypto";
import { env } from "../config/env";
import type { PushEnvironment } from "./domain";

const APNS_PRODUCTION_HOST = "https://api.push.apple.com";
const APNS_SANDBOX_HOST = "https://api.sandbox.push.apple.com";

/** APNs rechaza un token de autenticación de más de 1h -- se refresca bien antes de ese límite, y Apple además limita cuántos tokens nuevos se pueden pedir por hora, así que reusar el firmado es lo correcto, no solo una optimización. */
const AUTH_TOKEN_MAX_AGE_MS = 50 * 60 * 1000;

export class ApnsNotConfiguredError extends Error {
  constructor() {
    super("ApnsClient: APNS_KEY_ID/APNS_TEAM_ID/APNS_PRIVATE_KEY/APNS_BUNDLE_ID no están configurados.");
    this.name = "ApnsNotConfiguredError";
  }
}

/** Razones de APNs (https://developer.apple.com/documentation/usernotifications/handling-notification-responses-from-apns) que significan "este token nunca va a funcionar de nuevo" -- el llamador debe borrarlo, nunca reintentar. */
const PERMANENTLY_INVALID_REASONS = new Set(["BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"]);

export class ApnsDeliveryError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reason: string,
  ) {
    super(message);
    this.name = "ApnsDeliveryError";
  }
}

export function isApnsTokenPermanentlyInvalid(error: unknown): boolean {
  return error instanceof ApnsDeliveryError && PERMANENTLY_INVALID_REASONS.has(error.reason);
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

let cachedAuthToken: { jwt: string; signedAt: number } | null = null;

/**
 * `dsaEncoding: "ieee-p1363"` es el detalle que importa acá -- el
 * default de `crypto.sign()` para llaves EC es DER, pero JWS (RFC 7518
 * §3.4) exige la firma como `r || s` concatenados sin envoltura ASN.1.
 * Sin este flag, la firma es sintácticamente válida pero APNs la
 * rechaza en silencio como inválida.
 */
function buildAuthToken(): string {
  if (cachedAuthToken && Date.now() - cachedAuthToken.signedAt < AUTH_TOKEN_MAX_AGE_MS) {
    return cachedAuthToken.jwt;
  }
  if (!env.APNS_KEY_ID || !env.APNS_TEAM_ID || !env.APNS_PRIVATE_KEY) {
    throw new ApnsNotConfiguredError();
  }

  const header = base64url(JSON.stringify({ alg: "ES256", kid: env.APNS_KEY_ID }));
  const payload = base64url(JSON.stringify({ iss: env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) }));
  const signingInput = `${header}.${payload}`;
  const signature = sign("sha256", Buffer.from(signingInput), {
    key: env.APNS_PRIVATE_KEY,
    dsaEncoding: "ieee-p1363",
  });
  const jwt = `${signingInput}.${base64url(signature)}`;

  cachedAuthToken = { jwt, signedAt: Date.now() };
  return jwt;
}

export interface ApnsPayload {
  readonly title: string;
  readonly body: string;
  readonly data?: Readonly<Record<string, unknown>>;
}

/**
 * Envía una notificación a un solo dispositivo. Nunca reintenta por su
 * cuenta (mismo criterio que `GmailClient.request()`: exactamente un
 * intento, el llamador decide qué hacer con el resultado) -- lanza
 * `ApnsDeliveryError` en cualquier respuesta que no sea 200,
 * `ApnsNotConfiguredError` si las credenciales no existen todavía
 * (antes de la inscripción del Founder en Apple Developer Program).
 */
export async function sendApnsNotification(
  deviceToken: string,
  environment: PushEnvironment,
  payload: ApnsPayload,
): Promise<void> {
  if (!env.APNS_BUNDLE_ID) {
    throw new ApnsNotConfiguredError();
  }

  const jwt = buildAuthToken();
  const host = environment === "production" ? APNS_PRODUCTION_HOST : APNS_SANDBOX_HOST;
  const body = JSON.stringify({
    aps: { alert: { title: payload.title, body: payload.body }, sound: "default" },
    ...(payload.data ?? {}),
  });

  const session = connect(host);
  try {
    const { status, reason } = await new Promise<{ status: number; reason?: string }>((resolve, reject) => {
      const req = session.request({
        ":method": "POST",
        ":path": `/3/device/${deviceToken}`,
        authorization: `bearer ${jwt}`,
        "apns-topic": env.APNS_BUNDLE_ID,
        "apns-push-type": "alert",
        "content-type": "application/json",
      });

      let status = 0;
      let responseBody = "";
      req.on("response", (headers) => {
        status = Number(headers[":status"]);
      });
      req.on("data", (chunk: Buffer) => {
        responseBody += chunk.toString("utf-8");
      });
      req.on("end", () => {
        if (status === 200) {
          resolve({ status });
          return;
        }
        try {
          const parsed = JSON.parse(responseBody) as { reason?: string };
          resolve({ status, reason: parsed.reason });
        } catch {
          resolve({ status, reason: undefined });
        }
      });
      req.on("error", reject);
      req.end(body);
    });

    if (status !== 200) {
      throw new ApnsDeliveryError(`ApnsClient: APNs devolvió ${status}.`, status, reason ?? "unknown");
    }
  } finally {
    session.close();
  }
}
