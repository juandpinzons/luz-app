/**
 * Infraestructura reutilizable para las referencias polimórficas de
 * LUZ (`entityType`/`entityId`, `sourceType`/`sourceId`, `refType`/
 * `refId`, y columnas "sin FK por diseño" como `subjectPersonId`).
 * Ningún cambio al modelo de datos ni a ningún contrato público --
 * ver README de este módulo para el inventario completo y las
 * decisiones de diseño.
 */
export * from "./domain";
export * from "./registry";
export * from "./repositories";
export * from "./validators";
export * from "./integrity";
export * from "./repair";
