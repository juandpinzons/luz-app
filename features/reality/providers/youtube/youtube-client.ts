/**
 * Cliente REST aislado para YouTube Data API v3
 * (https://developers.google.com/youtube/v3/docs). Única
 * responsabilidad: hablar HTTP/JSON con `www.googleapis.com/youtube/v3`.
 * No conoce `YoutubeVideo` -- eso es trabajo de `youtube-mapper.ts`. No
 * decide nada de negocio (cuántos videos traer) -- eso es trabajo de
 * `youtube-provider.ts`. Mismo reparto de responsabilidad que
 * `gmail-client.ts`.
 *
 * **Sin historial de reproducción** -- YouTube no expone el historial
 * de reproducción de una persona a aplicaciones de terceros desde 2016
 * (el campo `contentDetails.relatedPlaylists.watchHistory` sigue
 * existiendo en el esquema de `channels.list` por compatibilidad, pero
 * devuelve un valor placeholder fijo, nunca datos reales). El único
 * recurso real y estable que este cliente expone es
 * `videos.list(myRating=like)` -- documentado y activo, distinto del
 * atajo de "playlist relacionada" que Google deprecó junto con el
 * historial.
 */

import type { YoutubeCredentials } from "../../../../core/youtube-connections/domain";

export type { YoutubeCredentials };

const DEFAULT_BASE_URL = "https://www.googleapis.com/youtube/v3";
const DEFAULT_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/** Mismo margen que `gmail-client.ts` -- ver ese docblock. */
const EXPIRY_SKEW_MS = 60_000;

export interface YoutubeApiChannel {
  readonly id: string;
  readonly title: string;
}

export interface YoutubeApiVideoSnippet {
  readonly title?: string;
  readonly channelId?: string;
  readonly channelTitle?: string;
  readonly publishedAt?: string;
  readonly thumbnails?: {
    readonly high?: { readonly url?: string };
    readonly medium?: { readonly url?: string };
    readonly default?: { readonly url?: string };
  };
}

export interface YoutubeApiVideo {
  readonly id: string;
  readonly snippet?: YoutubeApiVideoSnippet;
}

export interface YoutubeListVideosPage {
  readonly items: readonly YoutubeApiVideo[];
  readonly nextPageToken?: string;
}

export class YoutubeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly responseBody: string,
  ) {
    super(message);
    this.name = "YoutubeApiError";
  }
}

/** Mismo criterio exacto que `GmailAuthExpiredError` -- ver ese docblock. */
export class YoutubeAuthExpiredError extends YoutubeApiError {
  constructor(responseBody: string) {
    super(
      "YoutubeClient: el access token expiró y no pudo renovarse -- el llamador debe marcar la conexión needs_reauth.",
      401,
      responseBody,
    );
    this.name = "YoutubeAuthExpiredError";
  }
}

function buildQueryString(params: Readonly<Record<string, string | number | boolean | readonly string[] | undefined>>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const entry of value) search.append(key, entry);
      continue;
    }
    search.append(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export class YoutubeClient {
  private credentials: YoutubeCredentials;

  constructor(
    credentials: YoutubeCredentials,
    private readonly baseUrl: string = DEFAULT_BASE_URL,
    private readonly tokenEndpoint: string = DEFAULT_TOKEN_ENDPOINT,
  ) {
    this.credentials = credentials;
  }

  /** Ver docblock de `GmailClient.getCurrentCredentials()` -- mismo criterio exacto. */
  getCurrentCredentials(): YoutubeCredentials {
    return this.credentials;
  }

  /**
   * El canal de la cuenta autenticada -- doble rol que
   * `GmailClient.getProfile()`: confirma DE QUÉ cuenta son en verdad
   * estas credenciales (`assertAccountMatches` en `youtube-provider.ts`)
   * y sirve como la llamada de validación de `connectYoutube()`.
   */
  async getChannel(): Promise<YoutubeApiChannel> {
    const query = buildQueryString({ part: "snippet", mine: true });
    const body = await this.request<{ items?: { id: string; snippet?: { title?: string } }[] }>(`/channels${query}`);
    const channel = body.items?.[0];
    if (!channel) {
      throw new YoutubeApiError("YoutubeClient: la cuenta autenticada no tiene ningún canal de YouTube.", 404, "");
    }
    return { id: channel.id, title: channel.snippet?.title ?? "" };
  }

  /**
   * Los videos que le dio like la cuenta autenticada --
   * `videos.list(myRating=like)`, el único recurso real de "qué le
   * interesa a la persona ahora" que la API sigue exponiendo (ver
   * docblock del archivo). El orden que YouTube devuelve aquí no está
   * documentado como garantizado -- `youtube-mapper.ts` nunca confía en
   * el orden de esta respuesta, `youtube-provider.ts` siempre ordena por
   * `publishedAt` explícitamente después de mapear.
   */
  async listLikedVideos(maxResults: number, pageToken?: string): Promise<YoutubeListVideosPage> {
    const query = buildQueryString({
      part: "snippet",
      myRating: "like",
      maxResults,
      pageToken,
    });
    const body = await this.request<{ items?: readonly YoutubeApiVideo[]; nextPageToken?: string }>(`/videos${query}`);
    return { items: body.items ?? [], nextPageToken: body.nextPageToken };
  }

  private tokenLikelyExpired(): boolean {
    return this.credentials.expiresAt !== undefined && Date.now() >= this.credentials.expiresAt - EXPIRY_SKEW_MS;
  }

  /** Mismo criterio exacto que `GmailClient.refreshIfNeeded()` -- ver ese docblock. */
  private async refreshIfNeeded(force: boolean): Promise<boolean> {
    if (!force && !this.tokenLikelyExpired()) {
      return false;
    }
    const { refreshToken, clientId, clientSecret } = this.credentials;
    if (!refreshToken || !clientId || !clientSecret) {
      return false;
    }

    const response = await fetch(this.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
    });

    if (!response.ok) {
      return false;
    }

    const body = (await response.json()) as { access_token: string; expires_in?: number };
    this.credentials = {
      ...this.credentials,
      accessToken: body.access_token,
      expiresAt: body.expires_in !== undefined ? Date.now() + body.expires_in * 1000 : undefined,
    };
    return true;
  }

  /** Mismo criterio exacto que `GmailClient.request()` -- ver ese docblock. */
  private async request<T>(path: string): Promise<T> {
    await this.refreshIfNeeded(false);

    let response = await this.rawFetch(path);

    if (response.status === 401) {
      const refreshed = await this.refreshIfNeeded(true);
      if (refreshed) {
        response = await this.rawFetch(path);
      }
    }

    if (response.status === 401) {
      const body = await response.text();
      throw new YoutubeAuthExpiredError(body);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new YoutubeApiError(`YoutubeClient: ${path} devolvió ${response.status}.`, response.status, body);
    }

    return (await response.json()) as T;
  }

  private async rawFetch(path: string): Promise<Response> {
    const target = path.startsWith("http") ? path : `${this.baseUrl}${path}`;
    return fetch(target, {
      method: "GET",
      headers: { Authorization: `Bearer ${this.credentials.accessToken}` },
    });
  }
}
