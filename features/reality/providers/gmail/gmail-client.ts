/**
 * Cliente REST aislado para Gmail API v1
 * (https://developers.google.com/gmail/api/reference/rest). Única
 * responsabilidad: hablar HTTP/JSON con `gmail.googleapis.com`. No
 * conoce `EmailMessage` ni ningún tipo de `../../domain` -- eso es
 * trabajo de `gmail-mapper.ts`. No decide nada de negocio (cuántos
 * mensajes traer, qué hacer con un historial) -- eso es trabajo de
 * `gmail-provider.ts`. Mismo reparto de responsabilidades que
 * `apple-calendar-client.ts`/`apple-calendar-provider.ts`.
 *
 * **Alcance de scope OAuth deliberadamente mínimo**: este cliente solo
 * necesita `gmail.readonly` (o, mejor aún para el criterio de esta
 * fase, `gmail.metadata` -- scope de Google que ni siquiera PERMITE
 * pedir el cuerpo de un mensaje, ver
 * https://developers.google.com/gmail/api/auth/scopes). Nunca pide
 * `format=full` ni `format=raw` en ninguna llamada -- ver
 * `getMessage()`. Ningún flujo de autorización (pantalla de consentimiento,
 * intercambio inicial del `authorization_code`) vive aquí ni en ningún
 * otro archivo de `features/reality/` -- este cliente recibe
 * `GmailCredentials` YA resueltas por el constructor, mismo principio
 * que `AppleCalendarClient` recibe `AppleCalendarCredentials` ya
 * resueltas (ver `../../README.md`, "Credenciales/OAuth").
 */

const DEFAULT_BASE_URL = "https://gmail.googleapis.com/gmail/v1";
const DEFAULT_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/** Margen de seguridad antes de `expiresAt` para considerar el access token "por expirar" y refrescarlo proactivamente en vez de esperar un 401 real. */
const EXPIRY_SKEW_MS = 60_000;

export interface GmailCredentials {
  readonly accessToken: string;
  /** Sin esto, un access token expirado no puede renovarse -- el cliente lo señala como `GmailAuthExpiredError` en vez de intentar un refresh imposible. */
  readonly refreshToken?: string;
  /** Epoch ms -- opcional. Sin esto, el cliente solo puede reaccionar a un 401 real, nunca refrescar de forma proactiva. */
  readonly expiresAt?: number;
  /** Necesarios solo para refrescar `accessToken` vía `refreshToken` (RFC 6749 §6: un cliente confidencial, que es lo que un backend de LUZ es, debe autenticarse ante el token endpoint). */
  readonly clientId?: string;
  readonly clientSecret?: string;
}

export interface GmailMessageRef {
  readonly id: string;
  readonly threadId: string;
}

export interface GmailApiLabel {
  readonly id: string;
  readonly name: string;
  readonly type: "system" | "user";
}

export interface GmailApiHeader {
  readonly name: string;
  readonly value: string;
}

export interface GmailApiMessage {
  readonly id: string;
  readonly threadId: string;
  readonly labelIds?: readonly string[];
  readonly snippet?: string;
  /** Epoch ms como string -- así lo devuelve Gmail API, ver docblock de `getMessage()`. */
  readonly internalDate?: string;
  readonly payload?: {
    readonly headers?: readonly GmailApiHeader[];
  };
}

export interface GmailListMessagesPage {
  readonly messages: readonly GmailMessageRef[];
  readonly nextPageToken?: string;
  readonly resultSizeEstimate: number;
}

export interface GmailHistoryMessageRef {
  readonly message: GmailMessageRef;
}

export interface GmailHistoryRecord {
  readonly id: string;
  readonly messagesAdded?: readonly GmailHistoryMessageRef[];
  readonly messagesDeleted?: readonly GmailHistoryMessageRef[];
  readonly labelsAdded?: readonly GmailHistoryMessageRef[];
  readonly labelsRemoved?: readonly GmailHistoryMessageRef[];
}

export interface GmailApiProfile {
  readonly emailAddress: string;
  readonly historyId: string;
}

export interface GmailHistoryPage {
  readonly history: readonly GmailHistoryRecord[];
  readonly nextPageToken?: string;
  /** El `historyId` actual del buzón -- el nuevo cursor a guardar. Presente incluso cuando `history` está vacío (sin cambios desde `startHistoryId`). */
  readonly historyId?: string;
}

export class GmailApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly responseBody: string,
  ) {
    super(message);
    this.name = "GmailApiError";
  }
}

/**
 * El access token expiró y no pudo renovarse (sin `refreshToken`, sin
 * `clientId`/`clientSecret`, o el refresh en sí fue rechazado -- p. ej.
 * el refresh token fue revocado por la persona desde su cuenta de
 * Google). El llamador debe marcar la conexión `needs_reauth`
 * (`EmailConnectionStatus`, `../../domain/email-connection.ts`) --
 * mismo patrón que `CalDavInvalidSyncTokenError`: esta clase SOLO
 * señala la condición, no implementa reautorización automática (eso
 * exigiría un flujo de consentimiento interactivo que este cliente no
 * tiene forma de iniciar).
 */
export class GmailAuthExpiredError extends GmailApiError {
  constructor(responseBody: string) {
    super(
      "GmailClient: el access token expiró y no pudo renovarse -- el llamador debe marcar la conexión needs_reauth.",
      401,
      responseBody,
    );
    this.name = "GmailAuthExpiredError";
  }
}

/**
 * `startHistoryId` ya no es válido -- Gmail retiene el historial de
 * cambios solo por un tiempo limitado (documentado por Google como
 * "unos días", sin garantía exacta). El llamador debe reiniciar con
 * `cursor: null` (una sincronización completa nueva) -- mismo
 * principio que `CalDavInvalidSyncTokenError`: se señala, nunca se
 * reintenta sola.
 */
export class GmailHistoryExpiredError extends GmailApiError {
  constructor(responseBody: string) {
    super(
      "GmailClient: startHistoryId ya no es válido (historial expirado) -- el llamador debe reiniciar con cursor: null.",
      404,
      responseBody,
    );
    this.name = "GmailHistoryExpiredError";
  }
}

function buildQueryString(params: Readonly<Record<string, string | number | readonly string[] | undefined>>): string {
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

export class GmailClient {
  private credentials: GmailCredentials;

  constructor(
    credentials: GmailCredentials,
    private readonly baseUrl: string = DEFAULT_BASE_URL,
    private readonly tokenEndpoint: string = DEFAULT_TOKEN_ENDPOINT,
  ) {
    this.credentials = credentials;
  }

  /** Credenciales actuales, incluido cualquier refresh ya aplicado en memoria -- ver docblock de `refreshIfNeeded()`. Un futuro consumidor con persistencia real lee esto tras una llamada para decidir si vale la pena re-guardar un access token más nuevo; este cliente nunca lo persiste por su cuenta. */
  getCurrentCredentials(): GmailCredentials {
    return this.credentials;
  }

  async listLabels(): Promise<readonly GmailApiLabel[]> {
    const body = await this.request<{ labels?: readonly GmailApiLabel[] }>("/users/me/labels");
    return body.labels ?? [];
  }

  /**
   * `emailAddress` + `historyId` ACTUALES del buzón -- la forma
   * recomendada por Google
   * (https://developers.google.com/gmail/api/guides/sync, "Change
   * History") de sembrar un `historyId` inicial antes de la primera
   * sincronización incremental, en vez de asumir el `historyId` de
   * cualquier mensaje individual (que podría no existir si el buzón
   * está vacío -- caso real que este método evita por completo).
   * También sirve para confirmar DE QUÉ cuenta son en verdad estas
   * credenciales -- ver `assertAccountMatches` en `gmail-provider.ts`.
   */
  async getProfile(): Promise<GmailApiProfile> {
    return this.request<GmailApiProfile>("/users/me/profile");
  }

  /**
   * Primera página de mensajes conocidos (sin cursor de historial
   * todavía) -- sin `q`, Gmail devuelve mensajes de TODO el correo
   * (no solo `INBOX`), consistente con el alcance de la misión ("last
   * 10 emails", no "last 10 inbox emails"). El orden que Gmail
   * devuelve aquí no está garantizado por la documentación oficial
   * como "más reciente primero" -- `gmail-mapper.ts` nunca confía en
   * el orden de esta respuesta, siempre ordena por `internalDate`
   * explícitamente después de obtener cada mensaje completo (ver
   * `gmail-provider.ts`).
   */
  async listMessages(maxResults: number, pageToken?: string): Promise<GmailListMessagesPage> {
    const query = buildQueryString({ maxResults, pageToken });
    const body = await this.request<{
      messages?: readonly GmailMessageRef[];
      nextPageToken?: string;
      resultSizeEstimate?: number;
    }>(`/users/me/messages${query}`);

    return {
      messages: body.messages ?? [],
      nextPageToken: body.nextPageToken,
      resultSizeEstimate: body.resultSizeEstimate ?? 0,
    };
  }

  /**
   * `format=metadata` -- NUNCA `format=full` ni `format=raw` (ver
   * docblock del archivo: este cliente no tiene permiso de producto
   * para tocar el cuerpo de un mensaje, sin importar qué scope OAuth
   * tenga la credencial real). `metadataHeaders` acota los headers
   * MIME devueltos a exactamente los que `gmail-mapper.ts` necesita --
   * pedir menos de lo que Gmail incluiría por defecto en `metadata`
   * reduce qué datos personales cruzan la red y quedan en memoria del
   * proceso, aunque sea brevemente.
   */
  async getMessage(id: string): Promise<GmailApiMessage> {
    const query = buildQueryString({
      format: "metadata",
      metadataHeaders: ["From", "Subject", "Date"],
    });
    return this.request<GmailApiMessage>(`/users/me/messages/${encodeURIComponent(id)}${query}`);
  }

  /**
   * Página de historial desde `startHistoryId` -- la sincronización
   * incremental real de Gmail (https://developers.google.com/gmail/api/guides/sync).
   * `historyTypes` se omite a propósito: se piden TODOS los tipos
   * (`messageAdded`/`messageDeleted`/`labelAdded`/`labelRemoved`)
   * porque `gmail-provider.ts` necesita los cuatro para mantener
   * `unread`/`labels` al día en los mensajes ya conocidos (ver
   * docblock de `EmailSyncResult`: un cambio de estado también es un
   * "upsert").
   */
  async listHistory(startHistoryId: string, maxResults: number, pageToken?: string): Promise<GmailHistoryPage> {
    const query = buildQueryString({ startHistoryId, maxResults, pageToken });

    try {
      const body = await this.request<{
        history?: readonly GmailHistoryRecord[];
        nextPageToken?: string;
        historyId?: string;
      }>(`/users/me/history${query}`);

      return { history: body.history ?? [], nextPageToken: body.nextPageToken, historyId: body.historyId };
    } catch (error) {
      if (error instanceof GmailApiError && error.status === 404) {
        throw new GmailHistoryExpiredError(error.responseBody);
      }
      throw error;
    }
  }

  private tokenLikelyExpired(): boolean {
    return this.credentials.expiresAt !== undefined && Date.now() >= this.credentials.expiresAt - EXPIRY_SKEW_MS;
  }

  /**
   * Refresca `accessToken` vía `refreshToken` (RFC 6749 §6) si hace
   * falta -- proactivamente si `expiresAt` indica que ya venció (o está
   * por vencer), o si se pide explícitamente tras un 401 real. Actualiza
   * `this.credentials` EN MEMORIA -- este cliente nunca persiste el
   * token renovado; un consumidor futuro con capa de persistencia
   * decide si vale la pena leer `getCurrentCredentials()` después de
   * una llamada y guardar lo que cambió (ver `../../README.md`,
   * limitación documentada, misma decisión que Calendar Foundation ya
   * tomó para no resolver persistencia en esta fase).
   *
   * Sin `refreshToken`/`clientId`/`clientSecret`, no intenta nada --
   * el llamador se entera por el 401 real que sigue.
   */
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
      // El refresh mismo falló (p. ej. refresh token revocado) -- no es
      // un error a propagar aquí, el 401 original (o uno nuevo, si esto
      // se llamó proactivamente) es lo que el llamador de `request()`
      // convierte en `GmailAuthExpiredError`.
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

  /**
   * Único punto de este cliente que llama `fetch` contra la Gmail API.
   * Un 401 dispara EXACTAMENTE un intento de refresh + reintento --
   * nunca un loop, mismo criterio de restricción que
   * `CalDavInvalidSyncTokenError` (señalar, no inventar reintentos sin
   * límite).
   */
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
      throw new GmailAuthExpiredError(body);
    }

    if (!response.ok) {
      const body = await response.text();
      throw new GmailApiError(`GmailClient: ${path} devolvió ${response.status}.`, response.status, body);
    }

    return (await response.json()) as T;
  }

  /**
   * Concatenación directa, nunca `new URL(path, this.baseUrl)` -- bug
   * real evitado aquí: `baseUrl` ya incluye un path (`/gmail/v1`), y
   * `URL` con un segundo argumento que empieza en `/` reemplaza TODO el
   * path del primero en vez de anexarlo (WHATWG URL, mismas reglas que
   * `path.resolve` de una URL absoluta) -- `new URL("/users/me/labels",
   * "https://gmail.googleapis.com/gmail/v1")` resolvería a
   * `https://gmail.googleapis.com/users/me/labels`, perdiendo
   * `/gmail/v1` silenciosamente. Esta clase controla ambos lados
   * (`baseUrl` sin `/` final, `path` siempre con `/` inicial), así que
   * concatenar es correcto y no necesita resolución de URL relativa.
   */
  private async rawFetch(path: string): Promise<Response> {
    const target = path.startsWith("http") ? path : `${this.baseUrl}${path}`;
    return fetch(target, {
      method: "GET",
      headers: { Authorization: `Bearer ${this.credentials.accessToken}` },
    });
  }
}
