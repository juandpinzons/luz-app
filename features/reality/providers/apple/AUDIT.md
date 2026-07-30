# Apple Calendar Provider — Hardening Audit

Auditoría técnica de `AppleCalendarProvider`/`AppleCalendarClient`/`apple-calendar-mapper` contra RFC 4791 (CalDAV), RFC 5545 (iCalendar) y RFC 6578 (WebDAV Sync). Sin cambios a `CalendarProvider`, al dominio (`features/reality/domain`), ni a la base de datos. 6 bugs reales corregidos, límites reales documentados donde no había justificación para tocar código.

## 1. Bugs reales encontrados y corregidos

| # | Severidad | Archivo | Descripción |
|---|---|---|---|
| 1 | **Crítica** | `apple-calendar-client.ts` | `syncCollection()` llamaba `decodeXmlEntities()` sobre el `sync-token` **saliente** en vez de `encodeXmlEntities()`. Un token con un `&` literal (plausible: muchos sync-tokens son URLs o contienen query strings) producía XML inválido en la siguiente sincronización incremental, rompiéndola silenciosamente. |
| 2 | Alta | `apple-calendar-client.ts` | `parseMultistatus()` tomaba el primer `<status>` en cualquier posición del bloque `<response>`. Si un servidor devuelve, dentro de la misma respuesta, un `propstat` 200 para unas propiedades y otro 404 para una propiedad no soportada (permitido por RFC 4918, plausible con `current-user-privilege-set`), un recurso realmente encontrado podía marcarse como borrado por error. |
| 3 | Media | `apple-calendar-client.ts` | Regex de extracción de etiquetas (`extractFirstTagText`, `splitResponseBlocks`) sin límite de frontera tras el nombre de etiqueta — `<D:statusText>` hacía falso match al buscar `status`. Sin evidencia de que exista tal etiqueta en namespaces reales usados por iCloud, pero es un defecto de parser genuino. |
| 4 | Media | `apple-calendar-mapper.ts` | `resolveUtcOffsetMinutes()` sin manejo de excepción: un `TZID` no reconocido por ICU (posible con eventos importados desde otros sistemas con `VTIMEZONE` de nombre no estándar) abortaba con excepción no capturada **toda la sincronización de la página**, no solo ese evento. |
| 5 | Media | `apple-calendar-mapper.ts`/`apple-calendar-client.ts` | Sin aislamiento de fallos por registro: un único `VEVENT` o recurso malformado abortaba el mapeo de todo el `calendar-data`/página en curso. |
| 6 | Baja | `apple-calendar-mapper.ts` | Instancias de excepción de recurrencia (`RECURRENCE-ID` sin `RRULE` propio) recibían `rule: ""` sin ninguna explicación — valor sin significado documentado en el dominio. |

**Fix aplicado a cada uno:**
1. Nueva función `encodeXmlEntities()` (inversa correcta), usada al insertar el token en el cuerpo saliente.
2. `parseMultistatus()` reescrito: distingue `<status>` a nivel de `<response>` (fuera de cualquier `propstat`, vía `stripPropstatBlocks()`) del `<status>` de cada `propstat`; `calendar-data`/`displayname`/`resourcetype` solo se aceptan de un `propstat` cuyo propio status es 200.
3. Lookahead `(?=[\s/>])` agregado tras el nombre de etiqueta en ambos parsers.
4. `try/catch` alrededor de la construcción de `Intl.DateTimeFormat`; fallback a offset 0 (UTC), misma aproximación ya documentada para "hora flotante".
5. `try/catch` por `VEVENT` en `mapCalendarDataToEvents()` y por recurso en `mapSyncEntriesToEvents()`; se descarta el registro afectado con `console.error`, nunca aborta el resto de la página.
6. Cuando el evento maestro está en el mismo recurso (caso común en iCloud), se reutiliza su `RRULE` real para la excepción. Cuando no lo está, un sentinel nombrado y documentado (`RECURRENCE_MASTER_UNAVAILABLE_RULE`) reemplaza la cadena vacía.

Además, dos limpiezas menores sin riesgo: se removió la propiedad `getetag` de ambos cuerpos REPORT (se pedía, nunca se leía), y se añadió una defensa de `<![CDATA[...]]>` en la extracción de texto (algunos servidores WebDAV envuelven `calendar-data` en CDATA en vez de escapar entidades; iCloud no verificado en ningún sentido en esta sesión).

## 2. Evaluación de librerías (¿reemplazar el parser hand-rolled?)

**Recomendación: no reemplazar en este momento — migrar en una fase futura está justificado para la capa XML, es opcional para iCalendar.**

| Necesidad | Librería candidata | Madurez | Evaluación |
|---|---|---|---|
| XML/WebDAV multistatus | [`fast-xml-parser`](https://github.com/NaturalIntelligence/fast-xml-parser) | Muy madura, cero dependencias, tipos TS incluidos, millones de descargas/semana | Construiría un árbol real en vez de regex — habría prevenido los bugs #2 y #3 de raíz (nesting/propstat múltiple es exactamente lo que un parser de árbol maneja bien y un parser de texto plano no). Es la recomendación más fuerte de esta auditoría. |
| iCalendar (RFC 5545) | [`ical.js`](https://github.com/kewisch/ical.js) (o `node-ical`) | Madura, usada en producción (Thunderbird/Lightning), maneja `VTIMEZONE` embebido, `EXDATE`/`RDATE`, plegado de líneas | Reemplazaría todo el parser manual de `apple-calendar-mapper.ts`. Ganancia real: soporte de `EXDATE`/`RDATE`/`VALARM` (hoy no soportados, ver §3) y `VTIMEZONE` embebido (hoy solo IANA vía `Intl`). |
| Expansión de recurrencia | [`rrule`](https://github.com/jkbrzt/rrule) | Madura, estándar de facto | **No aplica hoy** — `CalendarRecurrence.rule` es deliberadamente opaco por diseño de dominio (Fase I); expandir RRULE no es responsabilidad de este proveedor. |

**Por qué no reemplazar ahora, con la justificación técnica ya identificada:**
- La auditoría en sí es la prueba de que el parser hand-rolled es fràgil — se encontraron 3 bugs reales de parsing en ~550 líneas por sola revisión de código, sin siquiera probar contra un servidor real. Ese es un argumento técnico legítimo a favor de una librería.
- Pero reemplazar el parser es un cambio de superficie mucho mayor que corregir bugs puntuales: reescribe la lógica central del cliente, introduce una dependencia nueva en `package.json` (fuera de esta carpeta), y necesita su propia verificación contra respuestas reales de iCloud antes de confiar en el reemplazo — ninguna de las dos cosas estaba en el alcance de esta misión ("no agregues features", "detente cuando el proveedor haya sido auditado").
- Los 6 bugs encontrados ya están corregidos quirúrgicamente. El riesgo residual real que una librería resolvería (namespace-aware XML tree, `EXDATE`/`VALARM`/`VTIMEZONE` embebido) queda documentado en §3 y §5, no escondido.

**Recomendación concreta para una fase futura**: migrar la capa XML a `fast-xml-parser` es la mejora de mayor relación beneficio/riesgo — el bug #2 (propstat mixto) es exactamente la clase de error que un árbol real elimina estructuralmente. Migrar iCalemdar a `ical.js` es deseable pero de menor urgencia mientras `RRULE` siga opaco por diseño.

## 3. Cumplimiento RFC — funcionalidades no soportadas (documentado, no un error)

### RFC 5545 (iCalendar)
- **`EXDATE`/`RDATE`**: no se leen ni representan. `CalendarRecurrence` (dominio, congelado) no tiene campo para fechas excluidas/añadidas — un consumidor que expanda `RRULE` sobre un `CalendarEvent` de este proveedor **no debe asumir** que todas las ocurrencias calculadas ocurrieron de verdad. Requiere extender el dominio; fuera de alcance de esta fase.
- **`VALARM`** (recordatorios): no se parsea. Sin campo en el dominio para representarlo.
- **`VTIMEZONE` embebido con TZID no-IANA**: si el `TZID` no es un identificador IANA reconocido por `Intl`, se aproxima a UTC (ver bug #4, ahora sin crashear). La definición de horario de verano/DST personalizada dentro de un `VTIMEZONE` propio del recurso nunca se lee.
- **Excepciones de recurrencia como recurso CalDAV separado** (en vez de inline en el mismo `calendar-data` que el maestro): soportado parcialmente — el evento se mapea igual, pero si el maestro no está en el mismo recurso, `recurrence.rule` cae en el sentinel documentado en vez de la regla real (ver §1, fix #6).

### RFC 4791 (CalDAV)
- **`.well-known/caldav` (RFC 6764) bootstrap**: no implementado. Este cliente apunta directo a `https://caldav.icloud.com` (endpoint fijo y documentado de iCloud) en vez de seguir el flujo de auto-descubrimiento completo — correcto para un cliente exclusivo de iCloud, sería necesario si este cliente se generalizara a otros proveedores CalDAV.
- **`calendar-multiget` REPORT**: no implementado, no necesario para los flujos actuales (`sync-collection`/`calendar-query` cubren todo lo que este proveedor hace).
- **Filtros `calendar-query` avanzados** (por tipo de componente combinado, coincidencia de texto en propiedades): solo se implementa un filtro `time-range` sobre `VEVENT`. Suficiente para la carga inicial acotada; no se necesita más hoy.
- **`getetag`**: se removió del pedido (no se usaba). Sin soporte de escritura (`PUT`/`DELETE` condicionales por ETag) — consistente con que este proveedor es de solo lectura.
- **`schedule-default-calendar-URL`** (RFC 6638): no consultado — `CalendarDescriptor.isPrimary` siempre `false` (documentado en el mapper).

### RFC 6578 (WebDAV Sync)
- **Truncamiento server-side (`<D:limit>`)**: no se envía ningún límite de página; `hasMore` es siempre `false`. Fundamento: RFC 6578 no especifica que un servidor trunque por iniciativa propia sin que el cliente pida un límite — la ausencia de límite pedido hace razonable, aunque no verificado empíricamente contra iCloud, que no haya truncamiento. Si una cuenta con calendarios muy grandes demuestra lo contrario, la detección se agrega en `apple-calendar-provider.ts` sin tocar `CalendarProvider` ni `runCalendarSync` (ambos ya manejan `hasMore: true`).
- **`calendar-query` no tiene mecanismo de paginación en el RFC** — a diferencia de `sync-collection`, un truncamiento aquí sería completamente invisible (sin error, sin token, solo menos eventos de los esperados). Riesgo real para ventanas de tiempo muy largas en la primera sincronización; mitigación recomendada (no implementada): preferir ventanas iniciales más acotadas.
- **Condición `DAV:valid-sync-token` (403)**: ahora detectada explícitamente (`CalDavInvalidSyncTokenError`, fix nuevo de esta auditoría) en vez de colapsarse en un error genérico — sin ninguna lógica de reintento/recuperación automática (eso sería inventar comportamiento no pedido).

## 4. Recurrencia — validación punto por punto

| Aspecto | Estado | Nota |
|---|---|---|
| `RECURRENCE-ID` | ✅ Correcto | Id compuesto `${href}#${recurrenceId}` evita colisión con el maestro. |
| `EXDATE` | ❌ No soportado | Sin campo en el dominio (ver §3). |
| Instancias canceladas (`STATUS:CANCELLED` en una excepción) | ✅ Correcto, verificado por lectura de código | Se mapea igual que cualquier otro `VEVENT` — `mapStatus()` no distingue maestro de excepción, así que `status: "cancelled"` en una excepción se preserva correctamente. |
| Excepciones editadas (mismo `UID`, distinto `RECURRENCE-ID`, contenido modificado) | ✅ Corregido en esta auditoría | Antes: `rule: ""` sin explicación. Ahora: reutiliza el `RRULE` del maestro cuando está en el mismo recurso. |
| `UID` → `ExternalEventId` | ✅ Por diseño, NO se usa el UID como id | Se preserva en `raw.uid`; el id real es el `href` (ver docblock del mapper). Unicidad global del UID entre recursos distintos: **asumida** (invariante del protocolo), no verificada independientemente. |
| `href` → identidad | ✅ Correcto | Estable por protocolo (RFC 4791). Estabilidad byte-a-byte del string entre llamadas (mayúsculas, slash final): **asumida**, no verificada contra iCloud real. |

## 5. Sincronización — verificación y supuestos declarados

- **Ciclo de vida del sync-token**: primera sincronización siembra vía `syncCollection(href, null)` (más `calendar-query` acotado por ventana si se pidió); incremental reutiliza el token previo. Bug crítico de codificación del token saliente corregido (§1, #1).
- **Serialización del cursor**: `CalendarSyncCursor.token` (opaco por dominio) codifica un mapa `{href → syncToken}` por calendario en JSON. Validado con guardas de tipo explícitas (`isPlainStringRecord`), sin `any`. **Supuesto no verificado**: si el `href` de un calendario cambia entre sincronizaciones (ver arriba), su entrada en el mapa queda huérfana — no se limpia activamente, pero tampoco causa error, solo un registro sin uso en el JSON.
- **Manejo de borrados**: correcto a nivel de evento individual (RFC 6578 §3.6, status 404 a nivel de `response`). **Límite real no resuelto, documentado, no inventado**: si un calendario COMPLETO desaparece de la cuenta entre sincronizaciones, sus eventos nunca se reportan en `deleted` — este proveedor no mantiene una lista de ids por calendario para poder reportar ese cascade, y agregar ese estado sería una decisión de diseño nueva (más estado en el cursor), no un bug puntual corregible en esta pasada.
- **`hasMore`**: siempre `false`, con fundamento en el RFC explicado en §3. Ningún truncamiento simulado ni inventado.

## 6. Consideraciones de seguridad

- **Credenciales**: `AppleCalendarCredentials` (Apple ID + contraseña específica de app) vive solo en memoria del proceso, se inyecta por constructor, nunca se loguea. `toBasicAuthHeader()` es el único lugar que la toca.
- **Logging de errores**: los `catch` nuevos (§1, #5) usan `console.error` con el `href`/mensaje del error, pero **nunca** con el cuerpo de la respuesta HTTP ni la credencial — verificado por lectura del código añadido.
- **`CalDavProtocolError.responseBody`** se adjunta completo al error (para debugging) — si algo aguas abajo llegara a loguear el error completo sin filtrar, el cuerpo de una respuesta CalDAV podría incluir datos personales del calendario (títulos de eventos, emails de asistentes). No es un bug de este módulo, pero es una superficie a tener en cuenta en quien consuma estos errores más adelante (recomendación en §7).
- **Transporte**: siempre HTTPS (`https://caldav.icloud.com` fijo, sin fallback HTTP).
- **Inyección XML**: bug #1 (§1) era, además de un bug funcional, una superficie de inyección de XML — un sync-token adversarial (poco plausible, viene del propio servidor de Apple, pero en teoría cualquier dato no confiable insertado sin escapar en un cuerpo XML es una clase de riesgo real) queda cerrada con el fix.

## 7. Mejoras futuras (no implementadas, solo recomendadas)

1. Migrar la capa XML a `fast-xml-parser` (§2) — mayor relación beneficio/riesgo de esta lista.
2. Extender el dominio (`CalendarRecurrence`) para soportar `EXDATE`/`RDATE` si un consumidor real llega a necesitar expandir recurrencia con precisión.
3. Verificar empíricamente contra una cuenta iCloud real: comportamiento de truncamiento en `sync-collection`/`calendar-query`, formato exacto de CDATA vs entidades en `calendar-data`, estabilidad de `href` entre llamadas.
4. Redactar/filtrar `CalDavProtocolError.responseBody` antes de que cualquier capa de observabilidad futura lo persista (puede contener datos personales del calendario).
5. Resolver el cascade de borrado por calendario eliminado (§5) si se decide que es un caso real a soportar.

## 8. Validación contra servidor real (2026-07-30)

Corrida real contra una cuenta iCloud real (7 calendarios: 3 "Familia", "Reminders", "Home", "Work", y una colección interna de notificaciones), vía un script de verificación (`.scratch/verify-apple-caldav.ts`) con credenciales provistas fuera del chat (archivo local, nunca pegadas en la conversación).

**2 bugs críticos adicionales encontrados — ninguno visible por revisión de código, solo por prueba real:**

| # | Severidad | Descripción |
|---|---|---|
| 7 | **Crítica** | `discoverCalendarHomeSet()` extraía el `href` con `extractFirstTagText(xml, "href")` sobre el cuerpo completo de la respuesta. Cuando una propiedad como `current-user-principal` envuelve su valor en su propio `<href>` anidado (convención estándar RFC 4918), esa extracción tomaba el PRIMER `<href>` del documento -- que es el href de nivel `<D:response>` (identifica el recurso sobre el que se preguntó, no el valor de la propiedad). Esto resolvía el descubrimiento siempre a `/` (la raíz del servidor) en vez de a la cuenta real, y el PROPFIND Depth:1 subsecuente sobre la raíz era rechazado por iCloud con 400. **Rompía el descubrimiento por completo, siempre, contra cualquier cuenta.** |
| 8 | **Crítica** | `queryByTimeRange()` reutilizaba `toSyncReport()`, que exige un `sync-token` en la respuesta. `calendar-query` (RFC 4791) nunca lo trae -- ese concepto es exclusivo de `sync-collection` (RFC 6578). **Rompía toda primera sincronización acotada por ventana de tiempo, siempre, sin importar el contenido de la cuenta.** |

**Fix aplicado:**
7. Nueva función `extractPropertyHref(xml, propertyLocalName)`: extrae primero el contenido de la propiedad específica, luego el `href` DENTRO de ese contenido acotado -- nunca sobre el documento completo. Usada en los dos puntos de descubrimiento (`current-user-principal`, `calendar-home-set`).
8. `toSyncReport()` dividido en `parseEntries()` (sin exigir token, usado por `queryByTimeRange`) y `toSyncReport()` (exige token, usado por `syncCollection`).

**1 hallazgo adicional de robustez, confirmado en vivo:** la colección de notificaciones interna de iCloud (no una calendario real de eventos) rechaza `calendar-query` con `403 Forbidden`. `AppleCalendarProvider.sync()` no aislaba fallos por calendario -- un único calendario especial abortaba la sincronización completa de la cuenta, descartando resultados ya obtenidos de los demás. Corregido con `try/catch` por calendario (mismo patrón que el mapper): se omite el calendario fallido con `console.error`, se conserva el token previo si existía, y el resto de la cuenta sincroniza con normalidad.

**Confirmado funcionando end-to-end contra la cuenta real, después de los fixes:**
- Descubrimiento completo (principal → calendar-home-set) ✅
- `listCalendars()` -- 7 calendarios reales listados correctamente ✅
- `sync()` inicial acotado a 7 días -- 2 eventos reales encontrados, ambos con recurrencia, `UID` preservado en `raw` para ambos ✅
- **Segunda llamada a `sync()` con el cursor emitido -- 0 upserted, 0 deleted**, confirmando que el sync-token incremental funciona de extremo a extremo, incluida la codificación XML del token saliente (bug #1 de este documento) ✅
- Aislamiento por calendario -- el calendario de notificaciones se omitió limpiamente sin abortar los otros 6 ✅

**Sigue sin verificar empíricamente** (no exercised por los datos de esta cuenta en esta ventana): `EXDATE`, instancias de excepción de recurrencia con `RECURRENCE-ID` real, truncamiento/`hasMore`, la condición de sync-token inválido (403, fix #26 de este documento), un calendario con volumen alto de eventos.

## 9. Recomendación final

**Beta-ready, con el camino crítico ya verificado contra un servidor real.**

Los 8 bugs reales encontrados (6 de la auditoría de código + 2 encontrados solo por prueba real) están corregidos y verificados (`tsc --noEmit`/`eslint` limpios, y ahora también una corrida real completa: descubrimiento, listado, sync inicial, sync incremental). La arquitectura se sostiene bien bajo auditoría Y bajo prueba real. Antes de producción: probar recurrencia con excepciones reales (`RECURRENCE-ID`/`EXDATE`) y un calendario con volumen alto -- ninguno de los dos se pudo ejercitar con los datos disponibles en esta sesión.
