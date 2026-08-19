import { createPublicKey, verify as verifySignature } from "node:crypto";

const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
const APPLE_ISSUER = "https://appleid.apple.com";
/** Apple rota sus llaves con poca frecuencia -- 24h de caché es generoso; un `kid` que no aparece en el caché fuerza un refetch inmediato de todas formas (ver `getSigningKey`), así que esto nunca deja una rotación real sin cubrir. */
const JWKS_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Debe ser IDÉNTICO a `appId` en `native/capacitor.config.ts`. El flujo
 * NATIVO de Sign in with Apple (`ASAuthorizationAppleIDProvider`, vía
 * `@capacitor-community/apple-sign-in` -- a diferencia del flujo WEB
 * con una Services ID separada) firma el claim `aud` del identityToken
 * con el Bundle ID de la app. No es secreto (es público en cualquier
 * IPA/binario), así que vive como constante acá, no como variable de
 * entorno -- deliberadamente NO reutiliza `env.APNS_BUNDLE_ID`: ese
 * campo es opcional a propósito (gateado detrás de que el Founder
 * complete Apple Developer Program), y verificar identityTokens de
 * Apple no depende de ninguna credencial de esa inscripción todavía --
 * son las llaves PÚBLICAS de Apple, sin autenticación de por medio.
 */
const APPLE_APP_BUNDLE_ID = "com.joinluz.app";

interface AppleJwk {
  kty: string;
  kid: string;
  n: string;
  e: string;
}

interface AppleJwksResponse {
  keys: AppleJwk[];
}

let cachedJwks: { keys: AppleJwk[]; fetchedAt: number } | null = null;

async function fetchJwks(): Promise<AppleJwk[]> {
  const response = await fetch(APPLE_JWKS_URL);
  if (!response.ok) {
    throw new Error(`AppleAuth: /auth/keys devolvió ${response.status}.`);
  }
  const body = (await response.json()) as AppleJwksResponse;
  return body.keys;
}

async function refreshJwksCache(): Promise<AppleJwk[]> {
  const keys = await fetchJwks();
  cachedJwks = { keys, fetchedAt: Date.now() };
  return keys;
}

async function getSigningKey(kid: string): Promise<AppleJwk> {
  const snapshot = cachedJwks;
  const isFresh = snapshot !== null && Date.now() - snapshot.fetchedAt < JWKS_CACHE_TTL_MS;
  const keys = isFresh ? snapshot.keys : await refreshJwksCache();

  let key = keys.find((candidate) => candidate.kid === kid);
  if (!key) {
    // El `kid` no está en el caché -- puede ser una rotación real de
    // Apple entre medio del TTL, no solo un caché desactualizado. Un
    // solo refetch inmediato antes de rendirse.
    key = (await refreshJwksCache()).find((candidate) => candidate.kid === kid);
  }
  if (!key) {
    throw new AppleIdentityTokenError("No se encontró la llave de firma de Apple para este token.");
  }
  return key;
}

function base64UrlDecode(segment: string): Buffer {
  return Buffer.from(segment, "base64url");
}

export class AppleIdentityTokenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppleIdentityTokenError";
  }
}

export interface AppleIdentity {
  /** Identificador estable de Apple para esta persona -- equivalente a `profile.sub` de Google, la clave real de `accounts.provider_account_id`. */
  readonly sub: string;
  /** Puede ser una dirección de reenvío privado de Apple ("Hide My Email") -- funciona igual para identidad, nunca se distingue del email real en este dominio. */
  readonly email: string | null;
  readonly emailVerified: boolean;
}

interface AppleIdentityTokenPayload {
  iss?: string;
  aud?: string;
  exp?: number;
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
}

/**
 * Verifica un `identityToken` de Sign in with Apple (JWS compacto,
 * RS256) contra las llaves públicas reales de Apple -- nunca confía en
 * el `sub`/`email` que el propio dispositivo ya trae en JS aparte (ver
 * `apple-sign-in-button.tsx`): esos campos vienen del mismo cliente que
 * podría estar comprometido, el JWT firmado por Apple es la única
 * fuente de verdad. Sin librería nueva -- mismo criterio que
 * `apns-client.ts`: `node:crypto` ya construye una llave pública
 * directo desde un JWK (`createPublicKey({key, format: "jwk"})`, Node
 * 12+), y verificar un JWS de tres segmentos no amerita una dependencia
 * aparte.
 */
export async function verifyAppleIdentityToken(identityToken: string): Promise<AppleIdentity> {
  const segments = identityToken.split(".");
  if (segments.length !== 3) {
    throw new AppleIdentityTokenError("Formato de identityToken inválido.");
  }
  const [headerB64, payloadB64, signatureB64] = segments;

  let header: { alg?: string; kid?: string };
  let payload: AppleIdentityTokenPayload;
  try {
    header = JSON.parse(base64UrlDecode(headerB64).toString("utf-8"));
    payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf-8"));
  } catch {
    throw new AppleIdentityTokenError("No se pudo decodificar el identityToken.");
  }

  if (header.alg !== "RS256" || !header.kid) {
    throw new AppleIdentityTokenError("Algoritmo de firma inesperado.");
  }

  const jwk = await getSigningKey(header.kid);
  const publicKey = createPublicKey({
    key: { kty: jwk.kty, n: jwk.n, e: jwk.e },
    format: "jwk",
  });

  const signatureValid = verifySignature(
    "RSA-SHA256",
    Buffer.from(`${headerB64}.${payloadB64}`),
    publicKey,
    base64UrlDecode(signatureB64),
  );
  if (!signatureValid) {
    throw new AppleIdentityTokenError("Firma inválida.");
  }

  if (payload.iss !== APPLE_ISSUER) {
    throw new AppleIdentityTokenError("Emisor inesperado.");
  }
  if (payload.aud !== APPLE_APP_BUNDLE_ID) {
    throw new AppleIdentityTokenError("Audiencia inesperada.");
  }
  if (!payload.exp || payload.exp * 1000 < Date.now()) {
    throw new AppleIdentityTokenError("Token expirado.");
  }
  if (!payload.sub) {
    throw new AppleIdentityTokenError("El token no trae `sub`.");
  }

  return {
    sub: payload.sub,
    email: payload.email ?? null,
    emailVerified: payload.email_verified === true || payload.email_verified === "true",
  };
}
