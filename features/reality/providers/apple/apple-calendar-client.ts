/**
 * Cliente CalDAV aislado para iCloud (RFC 4791 "CalDAV" + RFC 6578
 * "WebDAV Sync" + RFC 6764 "CalDAV/CardDAV auto-discovery"). Única
 * responsabilidad: hablar HTTP/XML con `caldav.icloud.com`. No conoce
 * `CalendarEvent` ni ningún tipo de `../../domain` -- eso es trabajo
 * de `apple-calendar-mapper.ts`. No decide nada de negocio (qué
 * calendarios sincronizar, cómo agregar resultados) -- eso es trabajo
 * de `apple-calendar-provider.ts`.
 *
 * Por qué CalDAV y no otra cosa: Apple no publica una API REST propia
 * para iCloud Calendar (a diferencia de Google Calendar API v3 o
 * Microsoft Graph). CalDAV es el único mecanismo servidor-servidor
 * soportado. EventKit (el framework nativo de Apple) corre on-device
 * dentro de una app iOS/macOS -- no tiene ningún binding invocable
 * desde un backend, así que nunca fue una opción real para este
 * archivo.
 *
 * Por qué sin librería de XML: mantener el blast radius confinado a
 * esta carpeta (instrucción explícita de esta fase) significa no
 * agregar una dependencia nueva a `package.json` solo para parsear un
 * subconjunto muy acotado y bien conocido de respuestas WebDAV
 * multistatus. El parser de abajo es deliberadamente mínimo -- ver
 * `parseMultistatus()` para sus límites documentados.
 */

const DEFAULT_BASE_URL = "https://caldav.icloud.com";

const DAV_NS = "DAV:";
const CALDAV_NS = "urn:ietf:params:xml:ns:caldav";

export interface AppleCalendarCredentials {
  /** El Apple ID (email) de la cuenta. */
  readonly appleId: string;
  /**
   * Contraseña específica de app generada en appleid.apple.com --
   * NUNCA la contraseña real de la cuenta (iCloud CalDAV la rechaza
   * si 2FA está activo, que es obligatorio para todo Apple ID hoy).
   * Apple no ofrece OAuth para CalDAV -- este es el único mecanismo de
   * autenticación disponible, ver README de `../../`.
   */
  readonly appSpecificPassword: string;
}

export interface CalDavCalendarCollection {
  /** URL absoluta de la colección -- identificador estable, se resuelve contra `response.url` (post-redirect) en cada request. */
  readonly href: string;
  readonly displayName: string;
  readonly isReadOnly: boolean;
}

export type CalDavSyncEntryStatus = "found" | "deleted";

export interface CalDavSyncEntry {
  readonly href: string;
  readonly status: CalDavSyncEntryStatus;
  /** Solo presente cuando `status === "found"` -- el texto iCalendar (VCALENDAR/VEVENT) crudo, ya des-escapado de entidades XML. */
  readonly calendarData?: string;
}

export interface CalDavSyncReport {
  readonly entries: readonly CalDavSyncEntry[];
  readonly newSyncToken: string;
}

export interface CalDavTimeRange {
  readonly from: Date;
  readonly to: Date;
}

export class CalDavProtocolError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly responseBody: string,
  ) {
    super(message);
    this.name = "CalDavProtocolError";
  }
}

/**
 * RFC 6578 §3.7: cuando un `sync-token` ya no es válido (el servidor
 * expiró/recicló el estado que representaba), el servidor responde
 * `403 Forbidden` con una condición `DAV:valid-sync-token` -- distinto
 * de cualquier otra falla HTTP. Se distingue con su propio tipo para
 * que un llamador futuro pueda detectarlo (`instanceof`) y decidir
 * reiniciar la sincronización desde `cursor: null` -- esta clase SOLO
 * señala la condición, no implementa ningún reintento ni reinicio
 * automático (eso sería inventar comportamiento no pedido).
 */
export class CalDavInvalidSyncTokenError extends CalDavProtocolError {
  constructor(responseBody: string) {
    super(
      "AppleCalendarClient: el servidor rechazó el sync-token (403, probablemente expirado/inválido -- RFC 6578 §3.7). El llamador debe reiniciar con cursor: null.",
      403,
      responseBody,
    );
    this.name = "CalDavInvalidSyncTokenError";
  }
}

function formatIcalDateTimeUtc(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function toBasicAuthHeader(credentials: AppleCalendarCredentials): string {
  const raw = `${credentials.appleId}:${credentials.appSpecificPassword}`;
  return `Basic ${Buffer.from(raw, "utf-8").toString("base64")}`;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * Inversa de `decodeXmlEntities` -- necesaria para insertar un valor
 * (p. ej. un `sync-token` guardado de una respuesta anterior) DENTRO
 * del cuerpo XML de una petición saliente. `&` debe ir primero: si se
 * reemplazara después de `<`/`>`, los `&` recién insertados por ESOS
 * reemplazos (`&lt;`/`&gt;`) se escaparían por segunda vez.
 */
function encodeXmlEntities(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Un valor de texto que llegó DE una respuesta XML (ya des-escapado) puede contener `<![CDATA[...]]>` en vez de entidades escapadas -- algunos servidores WebDAV usan CDATA para `calendar-data`. Se retira el envoltorio antes de tratar el contenido como texto plano; si no hay CDATA, no hace nada. */
function stripCdataWrapper(value: string): string {
  const match = /^<!\[CDATA\[([\s\S]*)\]\]>$/.exec(value.trim());
  return match?.[1] ?? value;
}

/**
 * Extrae el contenido de texto de la PRIMERA ocurrencia de una etiqueta
 * (con cualquier prefijo de namespace, o ninguno) dentro de `xml`.
 * Suficiente para las propiedades de un solo valor que este cliente
 * necesita (`current-user-principal`, `calendar-home-set`,
 * `sync-token`) -- no es un parser XML general, no maneja etiquetas
 * anidadas del mismo nombre a distintos niveles.
 *
 * `(?=[\\s/>])` después del nombre es obligatorio -- sin él, buscar
 * `status` también hace match con una etiqueta hipotética
 * `<D:statusText>` (el nombre real no coincide, pero `[^>]*>` absorbe
 * "Text" antes del cierre). Bug de auditoría corregido aquí -- no
 * observado en producción contra iCloud, encontrado por revisión de
 * código.
 */
function extractFirstTagText(xml: string, localName: string): string | null {
  const pattern = new RegExp(
    `<(?:[\\w-]+:)?${localName}(?=[\\s/>])[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${localName}>`,
    "i",
  );
  const match = pattern.exec(xml);
  if (!match) {
    return null;
  }
  const [, content] = match;
  return content !== undefined ? decodeXmlEntities(stripCdataWrapper(content.trim())) : null;
}

/**
 * Extrae el `href` DEL VALOR de una propiedad que lo envuelve (p. ej.
 * `<current-user-principal><href>/123/principal/</href></current-user-principal>`
 * -- convención estándar de WebDAV para propiedades cuyo valor es una
 * referencia a otro recurso: RFC 4918 exige envolver esas URIs en su
 * propio `<D:href>`, nunca ponerlas como texto plano de la propiedad).
 * NUNCA usar `extractFirstTagText(xml, "href")` directo sobre todo el
 * cuerpo de la respuesta para esto -- bug real de auditoría,
 * confirmado contra iCloud real: el PRIMER `<href>` del documento es
 * el href de nivel `<D:response>` (identifica DE QUÉ recurso es esa
 * entrada del multistatus, típicamente el mismo recurso sobre el que
 * se hizo la petición), no el valor de la propiedad -- confundir los
 * dos hacía que el descubrimiento resolviera siempre a `/` en vez de
 * a la cuenta real, y la llamada siguiente (PROPFIND Depth:1 sobre la
 * raíz del servidor) era rechazada por iCloud con 400.
 */
function extractPropertyHref(xml: string, propertyLocalName: string): string | null {
  const propertyContent = extractFirstTagText(xml, propertyLocalName);
  if (!propertyContent) {
    return null;
  }
  return extractFirstTagText(propertyContent, "href");
}

/**
 * Divide un `<D:multistatus>` en sus bloques `<D:response>` de nivel
 * superior. Asume (cierto para las respuestas que este cliente pide,
 * ver los cuerpos de REPORT/PROPFIND más abajo) que `response` no
 * anida otro `response` dentro -- válido para PROPFIND/sync-collection/
 * calendar-query tal como los define RFC 4791/6578.
 */
function splitResponseBlocks(xml: string): string[] {
  const pattern = /<(?:[\w-]+:)?response(?=[\s/>])[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?response>/gi;
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(xml)) !== null) {
    const [, content] = match;
    if (content !== undefined) {
      blocks.push(content);
    }
  }
  return blocks;
}

/** Igual que `splitResponseBlocks`, pero para `<D:propstat>` dentro de un bloque `response` ya extraído. */
function splitPropstatBlocks(responseBlock: string): string[] {
  const pattern = /<(?:[\w-]+:)?propstat(?=[\s/>])[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?propstat>/gi;
  const blocks: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(responseBlock)) !== null) {
    const [, content] = match;
    if (content !== undefined) {
      blocks.push(content);
    }
  }
  return blocks;
}

/** Retira todos los bloques `propstat` de un `response` -- lo que queda es el `<D:status>` a nivel de `response` (si existe), nunca el de una propiedad individual. Ver `parseMultistatus`. */
function stripPropstatBlocks(responseBlock: string): string {
  return responseBlock.replace(
    /<(?:[\w-]+:)?propstat(?=[\s/>])[^>]*>[\s\S]*?<\/(?:[\w-]+:)?propstat>/gi,
    "",
  );
}

function extractStatusCode(statusLine: string | null): number | null {
  if (!statusLine) {
    return null;
  }
  const match = /HTTP\/1\.\d\s+(\d{3})/.exec(statusLine);
  const code = match?.[1];
  return code !== undefined ? Number.parseInt(code, 10) : null;
}

/**
 * Parser mínimo de un `<D:multistatus>` completo -- cubre exactamente
 * lo que `sync-collection`/`calendar-query`/PROPFIND (Depth: 1)
 * devuelven según RFC 4791/6578.
 *
 * `responseStatus` distingue explícitamente el `<D:status>` a nivel de
 * `<D:response>` (RFC 4918 §14.24 -- usado, p. ej., por
 * `sync-collection` para señalar un recurso borrado, sin `propstat`)
 * del `<D:status>` DENTRO de un `propstat` (una propiedad puntual).
 * Bug de auditoría corregido aquí: la versión anterior tomaba el
 * PRIMER `<status>` en cualquier posición del bloque -- si un servidor
 * devuelve, dentro de la MISMA `<response>`, un `propstat` 200 para
 * unas propiedades y otro 404 para una propiedad que ese recurso no
 * soporta (permitido por RFC 4918, plausible con
 * `current-user-privilege-set` en `listCalendars()`), esa versión
 * podía leer el 404 de la propiedad no relacionada y marcar por error
 * un recurso ENCONTRADO como borrado. Ahora: el `calendar-data`/
 * `displayname`/`resourcetype` solo se aceptan del `propstat` cuyo
 * PROPIO status es 200.
 */
interface MultistatusEntry {
  readonly href: string;
  readonly responseStatus: number | null;
  readonly displayName: string | null;
  readonly resourceType: string | null;
  readonly calendarData: string | null;
}

function parseMultistatus(xml: string): { entries: MultistatusEntry[]; syncToken: string | null } {
  const entries = splitResponseBlocks(xml).map((block): MultistatusEntry => {
    const href = extractFirstTagText(block, "href") ?? "";
    const responseStatus = extractStatusCode(
      extractFirstTagText(stripPropstatBlocks(block), "status"),
    );

    let displayName: string | null = null;
    let resourceType: string | null = null;
    let calendarData: string | null = null;

    for (const propstatBlock of splitPropstatBlocks(block)) {
      const propstatStatus = extractStatusCode(extractFirstTagText(propstatBlock, "status"));
      if (propstatStatus !== 200) continue;
      displayName = displayName ?? extractFirstTagText(propstatBlock, "displayname");
      resourceType = resourceType ?? extractFirstTagText(propstatBlock, "resourcetype");
      calendarData = calendarData ?? extractFirstTagText(propstatBlock, "calendar-data");
    }

    return { href, responseStatus, displayName, resourceType, calendarData };
  });

  return { entries, syncToken: extractFirstTagText(xml, "sync-token") };
}

/**
 * Cliente HTTP/CalDAV. Descubre `calendar-home-set` una sola vez (dos
 * ida-y-vueltas: `current-user-principal`, luego `calendar-home-set`)
 * y lo memoiza -- ni cambia dentro de una sesión ni vale la pena
 * repetirlo en cada llamada.
 */
export class AppleCalendarClient {
  private calendarHomeSetPromise: Promise<string> | null = null;

  constructor(
    private readonly credentials: AppleCalendarCredentials,
    private readonly baseUrl: string = DEFAULT_BASE_URL,
  ) {}

  async listCalendars(): Promise<CalDavCalendarCollection[]> {
    const homeSetUrl = await this.resolveCalendarHomeSet();

    const { status, body, url } = await this.request("PROPFIND", homeSetUrl, {
      depth: "1",
      body: [
        `<?xml version="1.0" encoding="utf-8"?>`,
        `<D:propfind xmlns:D="${DAV_NS}">`,
        `  <D:prop>`,
        `    <D:resourcetype/>`,
        `    <D:displayname/>`,
        `    <D:current-user-privilege-set/>`,
        `  </D:prop>`,
        `</D:propfind>`,
      ].join("\n"),
    });

    if (status !== 207) {
      throw new CalDavProtocolError(
        `AppleCalendarClient.listCalendars: PROPFIND devolvió ${status}, se esperaba 207 Multi-Status.`,
        status,
        body,
      );
    }

    const { entries } = parseMultistatus(body);

    return entries
      // `resourceType` es el XML crudo entre <resourcetype>...</resourcetype>
      // (p. ej. "<D:collection/><C:calendar/>") -- `extractFirstTagText`
      // no desarma las etiquetas hijas, así que buscar la subcadena
      // "calendar" basta para detectar el marcador `<C:calendar/>` sin
      // necesitar un parser anidado para este único caso.
      .filter((entry) => entry.resourceType?.includes("calendar") && entry.href !== "")
      .map((entry) => ({
        href: new URL(entry.href, url).toString(),
        displayName: entry.displayName ?? entry.href,
        // Sin `current-user-privilege-set` parseado en detalle (fuera del
        // alcance mínimo de este cliente) -- se asume escribible salvo
        // que una fase futura necesite distinguirlo con precisión real.
        isReadOnly: false,
      }));
  }

  /**
   * Una página de sincronización sobre UNA colección. `syncToken:
   * null` inicia desde cero -- RFC 6578 dice que un `sync-token` vacío
   * en la primera llamada devuelve el estado completo actual de la
   * colección, sin acotar por tiempo. Cuando el llamador (el
   * provider) necesita acotar la primera carga por `timeRange`, debe
   * usar `queryByTimeRange()` en su lugar y llamar a este método
   * aparte solo para obtener un `sync-token` de arranque -- ver
   * docblock de `apple-calendar-provider.ts`.
   */
  async syncCollection(calendarHref: string, syncToken: string | null): Promise<CalDavSyncReport> {
    const { status, body, url } = await this.request("REPORT", calendarHref, {
      depth: "1",
      body: [
        `<?xml version="1.0" encoding="utf-8"?>`,
        `<D:sync-collection xmlns:D="${DAV_NS}" xmlns:C="${CALDAV_NS}">`,
        // `encodeXmlEntities`, NUNCA `decodeXmlEntities` -- este valor
        // viene DE una respuesta anterior y va HACIA el cuerpo XML de
        // esta petición; se necesita la dirección opuesta a la del
        // parseo. Bug de auditoría corregido aquí: la versión anterior
        // llamaba `decodeXmlEntities` sobre el token saliente -- un
        // sync-token que contuviera un `&` literal (plausible: muchos
        // son URLs o cadenas con query string) se habría insertado sin
        // escapar, produciendo XML inválido y rompiendo la
        // sincronización incremental.
        `  <D:sync-token>${syncToken ? encodeXmlEntities(syncToken) : ""}</D:sync-token>`,
        `  <D:sync-level>1</D:sync-level>`,
        `  <D:prop>`,
        `    <C:calendar-data/>`,
        `  </D:prop>`,
        `</D:sync-collection>`,
      ].join("\n"),
    });

    if (status === 403 && syncToken !== null) {
      throw new CalDavInvalidSyncTokenError(body);
    }

    if (status !== 207) {
      throw new CalDavProtocolError(
        `AppleCalendarClient.syncCollection: REPORT devolvió ${status}, se esperaba 207 Multi-Status.`,
        status,
        body,
      );
    }

    return this.toSyncReport(body, url);
  }

  /**
   * Carga inicial acotada por ventana de tiempo (RFC 4791
   * `calendar-query` con `time-range`) -- usada por el provider SOLO
   * cuando no hay `CalendarSyncCursor` previo, porque `sync-collection`
   * con token vacío no acepta un filtro de tiempo (RFC 6578: devuelve
   * TODO el estado actual de la colección). Esta llamada no produce un
   * `sync-token` nuevo por sí misma -- el provider debe pedir uno por
   * separado vía `syncCollection(href, null)` para sembrar la próxima
   * sincronización incremental.
   */
  async queryByTimeRange(calendarHref: string, range: CalDavTimeRange): Promise<readonly CalDavSyncEntry[]> {
    const { status, body, url } = await this.request("REPORT", calendarHref, {
      depth: "1",
      body: [
        `<?xml version="1.0" encoding="utf-8"?>`,
        `<C:calendar-query xmlns:D="${DAV_NS}" xmlns:C="${CALDAV_NS}">`,
        `  <D:prop>`,
        `    <C:calendar-data/>`,
        `  </D:prop>`,
        `  <C:filter>`,
        `    <C:comp-filter name="VCALENDAR">`,
        `      <C:comp-filter name="VEVENT">`,
        `        <C:time-range start="${formatIcalDateTimeUtc(range.from)}" end="${formatIcalDateTimeUtc(range.to)}"/>`,
        `      </C:comp-filter>`,
        `    </C:comp-filter>`,
        `  </C:filter>`,
        `</C:calendar-query>`,
      ].join("\n"),
    });

    if (status !== 207) {
      throw new CalDavProtocolError(
        `AppleCalendarClient.queryByTimeRange: REPORT devolvió ${status}, se esperaba 207 Multi-Status.`,
        status,
        body,
      );
    }

    return this.parseEntries(body, url).entries;
  }

  /**
   * Extrae las entradas (`found`/`deleted`) de un multistatus, sin
   * exigir `sync-token` -- correcto tanto para `sync-collection`
   * (RFC 6578, que SÍ trae `sync-token`) como para `calendar-query`
   * (RFC 4791, que NUNCA lo trae -- no es un concepto que ese REPORT
   * conozca). Bug real de auditoría, confirmado contra iCloud: antes,
   * `queryByTimeRange()` reutilizaba `toSyncReport()` (que exige el
   * token), así que TODA carga inicial acotada por ventana de tiempo
   * fallaba siempre con "la respuesta no incluyó sync-token", sin
   * importar el contenido real de la cuenta -- el camino principal de
   * primera sincronización de este proveedor estaba completamente
   * roto.
   */
  private parseEntries(
    body: string,
    responseUrl: string,
  ): { entries: CalDavSyncEntry[]; syncToken: string | null } {
    const { entries, syncToken } = parseMultistatus(body);

    const mapped: CalDavSyncEntry[] = [];
    for (const entry of entries) {
      if (entry.href === "") continue;

      const href = new URL(entry.href, responseUrl).toString();
      if (entry.responseStatus === 404) {
        mapped.push({ href, status: "deleted" });
        continue;
      }

      if (entry.calendarData) {
        mapped.push({ href, status: "found", calendarData: entry.calendarData });
      }
    }

    return { entries: mapped, syncToken };
  }

  /** Para `sync-collection` -- a diferencia de `parseEntries()`, exige `sync-token` (RFC 6578 lo garantiza). */
  private toSyncReport(body: string, responseUrl: string): CalDavSyncReport {
    const { entries, syncToken } = this.parseEntries(body, responseUrl);

    if (!syncToken) {
      throw new CalDavProtocolError(
        "AppleCalendarClient: la respuesta no incluyó sync-token -- contrato CalDAV (RFC 6578) violado por el servidor.",
        207,
        body,
      );
    }

    return { entries, newSyncToken: syncToken };
  }

  private async resolveCalendarHomeSet(): Promise<string> {
    if (!this.calendarHomeSetPromise) {
      this.calendarHomeSetPromise = this.discoverCalendarHomeSet();
    }
    return this.calendarHomeSetPromise;
  }

  private async discoverCalendarHomeSet(): Promise<string> {
    const principalRes = await this.request("PROPFIND", "/", {
      depth: "0",
      body: [
        `<?xml version="1.0" encoding="utf-8"?>`,
        `<D:propfind xmlns:D="${DAV_NS}">`,
        `  <D:prop><D:current-user-principal/></D:prop>`,
        `</D:propfind>`,
      ].join("\n"),
    });

    if (principalRes.status !== 207) {
      throw new CalDavProtocolError(
        `AppleCalendarClient: descubrimiento de current-user-principal falló (${principalRes.status}).`,
        principalRes.status,
        principalRes.body,
      );
    }

    const principalHref = extractPropertyHref(principalRes.body, "current-user-principal");
    if (!principalHref) {
      throw new CalDavProtocolError(
        "AppleCalendarClient: la respuesta de current-user-principal no incluyó href.",
        principalRes.status,
        principalRes.body,
      );
    }
    const principalUrl = new URL(principalHref, principalRes.url).toString();

    const homeSetRes = await this.request("PROPFIND", principalUrl, {
      depth: "0",
      body: [
        `<?xml version="1.0" encoding="utf-8"?>`,
        `<D:propfind xmlns:D="${DAV_NS}" xmlns:C="${CALDAV_NS}">`,
        `  <D:prop><C:calendar-home-set/></D:prop>`,
        `</D:propfind>`,
      ].join("\n"),
    });

    if (homeSetRes.status !== 207) {
      throw new CalDavProtocolError(
        `AppleCalendarClient: descubrimiento de calendar-home-set falló (${homeSetRes.status}).`,
        homeSetRes.status,
        homeSetRes.body,
      );
    }

    const homeSetHref = extractPropertyHref(homeSetRes.body, "calendar-home-set");
    if (!homeSetHref) {
      throw new CalDavProtocolError(
        "AppleCalendarClient: la respuesta de calendar-home-set no incluyó href.",
        homeSetRes.status,
        homeSetRes.body,
      );
    }

    return new URL(homeSetHref, homeSetRes.url).toString();
  }

  /**
   * Único punto de este cliente que llama `fetch` -- `redirect:
   * "follow"` es el default de `fetch` y basta aquí: iCloud CalDAV
   * redirige (301/302) desde `caldav.icloud.com` hacia un host de
   * partición específico de la cuenta la primera vez; cada `href` que
   * se recibe se resuelve contra `response.url` (la URL final
   * post-redirect), así que las llamadas siguientes ya usan
   * absolutas correctas sin necesitar lógica de redirect propia.
   */
  private async request(
    method: "PROPFIND" | "REPORT",
    path: string,
    init: { readonly body: string; readonly depth: "0" | "1" },
  ): Promise<{ status: number; body: string; url: string }> {
    const target = path.startsWith("http") ? path : new URL(path, this.baseUrl).toString();

    const response = await fetch(target, {
      method,
      headers: {
        Authorization: toBasicAuthHeader(this.credentials),
        Depth: init.depth,
        "Content-Type": "application/xml; charset=utf-8",
      },
      body: init.body,
    });

    const body = await response.text();
    return { status: response.status, body, url: response.url || target };
  }
}
