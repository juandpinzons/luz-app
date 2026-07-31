/**
 * Reality Provider Foundation (ver README.md). Dos cimientos
 * hermanos, mismo patrón arquitectónico (domain/providers/application,
 * dependencia en una sola dirección): Calendar (`AppleCalendarProvider`,
 * proveedor real sobre CalDAV) y Gmail (`GmailProvider`, proveedor real
 * sobre Gmail API v1). Ninguna persistencia ni rutas API/UI viven en
 * este módulo -- eso es responsabilidad de quien lo consume, ver
 * README.md.
 */
export * from "./domain";
export * from "./providers";
export * from "./application";
