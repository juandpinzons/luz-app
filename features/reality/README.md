# Calendar Foundation

Estado: **completo desde el punto de vista arquitectónico**. Contratos, un proveedor real (Apple/iCloud, endurecido y verificado contra servidor real), y una capa de aplicación completa con la vista de producto (`CalendarSnapshot`) que el resto de LUZ puede consumir. Sin persistencia, sin OAuth, sin rutas API, sin UI — eso es trabajo de la siguiente fase, de quien lo consuma.

Este documento es la referencia técnica final del módulo. Si eres Product Engineering (i7) y solo quieres saber cómo usarlo, ve directo a "Para quien consume esto".

## Qué es Calendar Foundation

`features/reality/` es el cimiento de calendario de LUZ: la abstracción que cualquier proveedor de calendario (Apple, Google, Outlook, ...) implementa, y la capa de casos de uso que traduce lo que un proveedor devuelve en conceptos de producto (eventos de hoy, tiempo libre, compromisos recurrentes) sin que el resto de LUZ sepa que Apple/Google/Outlook/CalDAV existen.

Construido en fases, cada una documentada en su momento y resumida aquí:

| Fase | Qué entregó |
|---|---|
| Reality Provider Foundation | Contratos de dominio + el puerto `CalendarProvider`, sin proveedor concreto |
| Apple Calendar Provider | `AppleCalendarProvider` sobre CalDAV (iCloud) -- el primer, y hasta ahora único, proveedor concreto |
| CalDAV Provider Hardening | Auditoría + 6 bugs corregidos + verificación real contra una cuenta iCloud (2 bugs críticos adicionales encontrados solo por esa prueba, también corregidos) |
| **Calendar Foundation** (esta fase) | Capa de aplicación completa (`connectCalendar`/`disconnectCalendar`/`synchronizeCalendar`/`refreshCalendar`/`getCalendarSnapshot`/`getUpcomingEvents`) + `CalendarSnapshot`, la vista canónica de producto |

## Arquitectura

Tres capas, dependencia en una sola dirección:

```
domain/  ←──  providers/  (el puerto + cada proveedor concreto)
   ↑
   └──────  application/  (casos de uso, solo depende del puerto)
```

- **DDD**: `domain/` son formas de datos puras -- sin comportamiento, sin I/O, sin saber que un proveedor existe.
- **Ports & Adapters**: `CalendarProvider` (`providers/calendar-provider.ts`) es el puerto; `AppleCalendarProvider` (`providers/apple/`) es el único adaptador real hoy.
- **Dependency Inversion**: `application/` depende de la ABSTRACCIÓN (`CalendarProvider`), nunca de una implementación. Quien llama un caso de uso inyecta el proveedor concreto ya construido (con sus credenciales ya resueltas) -- ningún caso de uso sabe cómo se construyó.
- **Feature-based**: todo el módulo vive en una carpeta, `features/reality/`, sin dependencias cruzadas hacia otras features de LUZ.

```
features/reality/
  domain/          — CalendarEvent, CalendarConnection, CalendarSyncCursor,
                      CalendarSyncResult, CalendarSyncOptions, CalendarDescriptor,
                      CalendarSnapshot (+ FreeTimeBlock/BusyPeriod/RecurringCommitment),
                      identificadores opacos, CalendarProviderKind
  providers/
    calendar-provider.ts   — el puerto
    apple/                 — AppleCalendarProvider (CalDAV/iCloud), único proveedor real
  application/
    run-calendar-sync.ts        — paginación agnóstica de proveedor (Fase 1)
    connect-calendar.ts         — valida y construye una CalendarConnection
    disconnect-calendar.ts      — transición de estado pura
    synchronize-calendar.ts     — sync + bookkeeping de conexión
    apply-sync-result.ts        — fusiona un delta contra eventos ya conocidos
    refresh-calendar.ts         — synchronize + apply + snapshot, en una llamada
    get-calendar-snapshot.ts    — la vista de producto completa
    get-upcoming-events.ts      — accesor angosto sobre lo mismo
    calendar-timing-helpers.ts  — helpers internos, no exportados
  index.ts / README.md
```

## Responsabilidades por capa

- **`domain/`**: qué ES un evento, una conexión, un cursor, un snapshot -- nunca cómo se obtienen ni qué hacer con ellos.
- **`providers/`**: cómo hablar con UN proveedor real y traducir su respuesta a la forma de dominio. `providers/apple/` es el único lugar del repo entero que sabe que CalDAV, XML, o iCloud existen -- verificado con evidencia en la fase anterior (grep de todo el repo fuera de `features/reality/`, cero resultados).
- **`application/`**: los casos de uso -- qué hacer CON un proveedor y sus datos para producir algo que un consumidor de producto pueda usar directamente. Nunca conoce un proveedor concreto, solo el puerto.

## Frontera de proveedor (Fase 4, verificada con evidencia)

> El resto de LUZ nunca debe saber si los datos vienen de Apple, Google, Outlook o CalDAV -- solo Calendar Foundation lo sabe.

Verificado, no asumido:
- Cero referencias a `AppleCalendar`/`CalDav`/`caldav.icloud` en código fuera de `features/reality/`.
- Cero imports de `providers/apple/*` dentro de `application/*` -- cada caso de uso solo importa `../domain` y `../providers` (el puerto).
- Las únicas menciones a "Apple"/"CalDAV" dentro de `domain/` son comentarios de documentación explicando decisiones de diseño (p. ej. por qué un id es opaco) -- nunca un tipo, un import, o lógica real.

Esta frontera es lo que hace posible agregar `GoogleCalendarProvider`/`OutlookCalendarProvider` más adelante sin tocar `domain/` ni `application/` -- ver "Puntos de extensión".

## Flujo de sincronización

Dos niveles: paginación (una conexión, agota todas las páginas de UNA corrida) y aplicación (qué hacer con el resultado).

```
synchronizeCalendar(provider, connection, cursor, options)
  │
  ├─ runCalendarSync(provider, connection, cursor, options)   ← pagina hasta hasMore=false
  │    loop: provider.sync(connection, cursor, options) → upserted/deleted/cursor nuevo
  │
  └─ devuelve { connection (status/updatedAt actualizados), cursor, upserted, deleted }

applySyncResult(eventosConocidos, upserted, deleted)
  └─ upsert por id, después quita los borrados → lista completa de eventos vigente

getCalendarSnapshot(eventos, connection, options)
  └─ deriva CalendarSnapshot (ver abajo) -- pura, sin I/O

refreshCalendar(...)  =  los tres pasos de arriba, en una sola llamada
```

`connectCalendar(provider, input)` valida la conexión llamando `provider.listCalendars()` una vez (credenciales inválidas fallan aquí, nunca en silencio en el primer sync) y devuelve una `CalendarConnection` nueva. `disconnectCalendar(connection)` es una transición de estado pura, sin llamar al proveedor (CalDAV/Google/Outlook no tienen concepto de "desconectar" -- es un estado propio de LUZ).

**Nada de esto persiste nada.** No existe repositorio, tabla, ni migración en este módulo. `events`/`cursor`/`connection` son lo que cada caso de uso RECIBE y DEVUELVE -- guardarlos es responsabilidad de quien llama.

## Contrato del Snapshot

`CalendarSnapshot` (`domain/calendar-snapshot.ts`) es el ÚNICO punto de contacto que un feature de producto debería necesitar:

```ts
interface CalendarSnapshot {
  generatedAt: Date;
  today: readonly CalendarEvent[];
  upcoming: readonly CalendarEvent[];
  freeBlocks: readonly FreeTimeBlock[];
  busyPeriods: readonly BusyPeriod[];
  recurringCommitments: readonly RecurringCommitment[];
  syncStatus: CalendarSyncStatusInfo;
}
```

- **`today`/`upcoming`**: eventos activos (`status !== "cancelled"`) que se solapan con la ventana considerada (hoy, y hoy+N días respectivamente -- `upcomingWindowDays`, default 7).
- **`busyPeriods`**: eventos solapados/adyacentes fusionados en un solo período (dos reuniones que se tocan = un período, no dos).
- **`freeBlocks`**: los huecos entre `busyPeriods` dentro de la ventana considerada -- **no asume horario laboral**, calcula sobre toda la ventana.
- **`recurringCommitments`**: series recurrentes conocidas (agrupadas por título+regla), con cuántas instancias aparecieron en la ventana -- **no** una lista de próximas ocurrencias (ver limitación de `RRULE` abajo).
- **`syncStatus`**: derivado de `CalendarConnection.status`, nunca de un detalle CalDAV -- `never_synced` / `syncing` / `up_to_date` / `error` / `disconnected`.

**Vocabulario exclusivamente de producto** -- reutiliza `CalendarEvent` (ya neutral desde la Fase 1) para `today`/`upcoming`, nunca un tipo con XML o conceptos CalDAV.

### Limitación real, documentada a propósito: sin expansión de `RRULE`

Este cimiento **nunca interpreta ni expande una regla de recurrencia** (`CalendarRecurrence.rule`) -- decisión explícita desde la Fase 1, que esta fase respeta sin excepción. Consecuencia real: `today`/`upcoming` solo muestran instancias con una fecha CONCRETA que el proveedor ya devolvió (el evento maestro tal cual, o una excepción con `RECURRENCE-ID` real) -- una serie recurrente sin ninguna instancia concreta sincronizada para hoy/pronto simplemente no aparece ahí, aunque sí aparece en `recurringCommitments` (que no necesita fechas).

Resolver esto correctamente requiere implementar expansión de `RRULE` (RFC 5545) o pedirle al proveedor que expanda del lado del servidor (CalDAV soporta el elemento `<C:expand>`, RFC 4791 §9.6.5 -- no usado hoy). Cualquiera de las dos es una capacidad nueva real, no un ajuste menor -- deliberadamente fuera de esta fase ("no abrir nuevos frentes arquitectónicos").

## Dos extensiones de dominio hechas en esta fase (por qué, y por qué eran necesarias)

La Fase 1 dejó el dominio "congelado". Esta fase encontró un bloqueo real al construir `CalendarSnapshot` y lo resolvió con el cambio mínimo posible, aditivo, documentado en el propio código:

1. **`CalendarEventTiming` ahora incluye fin** (`endDate`/`endDateTime`+`endTimeZone`), no solo inicio. Sin fin, calcular `freeBlocks`/`busyPeriods` es literalmente imposible, no solo impreciso. `providers/apple/apple-calendar-mapper.ts` ya lo puebla desde `DTEND` (o `DURATION`, RFC 5545 §3.3.6, como respaldo).
2. **`CalendarSnapshot` es nuevo** -- no modifica ningún contrato existente, es un tipo agregado en servicio explícito de esta fase.

Ningún otro contrato de la Fase 1 cambió de forma.

## Puntos de extensión

1. **Un proveedor nuevo** (`GoogleCalendarProvider`/`OutlookCalendarProvider`): una carpeta nueva en `providers/`, una clase que implemente `CalendarProvider`. Cero cambios en `domain/` o `application/` -- son exactamente las capas que ya dependen solo del puerto.
2. **Persistencia**: `CalendarConnection`, `CalendarSyncCursor`, y el resultado de `applySyncResult`/`getCalendarSnapshot` son las formas que una futura capa de persistencia guardaría. Ese esquema (tablas, migraciones) es la decisión de esa fase, no de esta.
3. **Credenciales/OAuth**: cada proveedor concreto resuelve su propia autenticación en su constructor (Apple: `AppleCalendarCredentials`, Basic Auth + contraseña específica de app, ver `providers/apple/AUDIT.md`). Un futuro flujo de conexión real (OAuth para Google/Outlook) vive enteramente dentro del proveedor nuevo, nunca en el puerto.
4. **Puente hacia `core/reality`/`core/connectors`**: `core/connectors/Connector` (ADR-0015) ya es el puerto genérico para integraciones externas, y `core/reality/external-signal-snapshot.ts` ya reserva `"calendar"` como fuente esperada de `ExternalSignal`. El punto de unión natural es un adaptador `CalendarEvent → ExternalSignal` (o `CalendarSnapshot → ExternalSignal[]`) -- no existe todavía, documentado aquí como extensión, no como pendiente urgente.
5. **Timezone real de la persona (hecho para `getCalendarSnapshot`, misión "Experience Intelligence V1"):** `CalendarSnapshotOptions.timeZone?: string` ya existe -- aditivo, `startOfDayInZone` reemplaza `startOfUtcDay` solo cuando se pasa. `core/calendar-connections/get-live-calendar-context.ts` (el camino real de `/dashboard`) ya pasa `"America/Bogota"`; confirmado en producción (un evento de la noche aparecía bajo "hoy" antes de este cambio). Cualquier otro llamador que no pase `timeZone` sigue viendo fronteras UTC puras, sin cambio de comportamiento. `getUpcomingEvents` queda pendiente (hoy sin ningún llamador real en el repo) -- mismo cambio, aplicarlo ahí cuando tenga un consumidor.
6. **Server-side `<C:expand>` o expansión de `RRULE`**: ver limitación arriba.

## Consideraciones de producción

- **Camino crítico verificado contra un servidor real** (Fase "Hardening"): descubrimiento, listado de calendarios, sincronización inicial acotada, sincronización incremental con cursor real -- los 4 confirmados funcionando contra una cuenta iCloud real, después de corregir 2 bugs que ninguna revisión de código había encontrado.
- **8 bugs reales encontrados y corregidos** entre la auditoría de código y la prueba real (detalle completo en `providers/apple/AUDIT.md`) -- el más severo rompía toda primera sincronización acotada por fecha, siempre, sin importar la cuenta.
- **Aislamiento de fallos por calendario y por evento**: un calendario especial (p. ej. una colección interna de notificaciones) o un evento individual malformado nunca abortan el resto de la sincronización -- confirmado necesario contra una cuenta real, no hipotético.
- **Autenticación de Apple es Basic Auth + contraseña específica de app, no OAuth** -- Apple no ofrece OAuth para CalDAV. Fricción de producto real (la persona debe generar la contraseña manualmente en appleid.apple.com) documentada desde la fase de implementación, sin resolver aquí.
- **Sin persistencia todavía** -- cada caso de uso recibe y devuelve datos en memoria; el volumen de eventos que un llamador puede razonablemente mantener en memoria (sin paginar desde una base de datos) es una restricción práctica real para cuentas con miles de eventos históricos.
- **`EXDATE`/recurrencia expandida**: no soportado (ver arriba) -- un consumidor de `CalendarSnapshot` no debe asumir que `recurringCommitments` o `upcoming` reflejan cada ocurrencia real de una serie.
- **`hasMore` de Apple siempre `false`**: no verificado empíricamente si iCloud trunca `sync-collection` en cuentas con volumen muy alto (ver `providers/apple/AUDIT.md`, §8).

## Para quien consume esto (Product Engineering / i7)

```ts
import {
  connectCalendar, synchronizeCalendar, refreshCalendar,
  getCalendarSnapshot, getUpcomingEvents, disconnectCalendar,
} from "features/reality/application";
import { AppleCalendarClient, AppleCalendarProvider } from "features/reality/providers/apple";

// 1) Construir el proveedor concreto -- SOLO este paso conoce a Apple.
const provider = new AppleCalendarProvider(new AppleCalendarClient(credentials));

// 2) Conectar (valida credenciales) -- guarda `connection` donde decidas.
const connection = await connectCalendar(provider, { lifeGraphId, externalAccountId });

// 3) Sincronizar + obtener el snapshot en un solo paso.
const { connection: updated, cursor, events, snapshot } =
  await refreshCalendar(provider, connection, previousCursor, priorEvents, { window });

// snapshot.today / snapshot.upcoming / snapshot.freeBlocks / snapshot.busyPeriods /
// snapshot.recurringCommitments / snapshot.syncStatus -- eso es todo lo que un
// componente de UI o un engine de LUZ debería necesitar tocar.
```

`provider`/`AppleCalendarClient` son las ÚNICAS piezas que saben que Apple/CalDAV existen. Todo lo demás (`domain/`, `application/`) es válido sin cambios el día que exista `GoogleCalendarProvider`.

---

# Gmail Foundation

Cimiento hermano de Calendar Foundation (arriba), mismo patrón arquitectónico exacto, viviendo en la misma carpeta (`features/reality/`). Misión: "Gmail Foundation + Data Isolation Hardening". Estado: **completo desde el punto de vista arquitectónico** -- contratos, un proveedor real (Gmail API v1, con integración real de OAuth/refresh/historial), y una capa de aplicación completa con la vista de producto (`EmailSnapshot`). Sin persistencia, sin flujo de autorización OAuth (pantalla de consentimiento), sin rutas API, sin UI -- exactamente la misma frontera de fase que Calendar Foundation tuvo en su momento (ver arriba, "Puntos de extensión #2/#3"): esa es responsabilidad de quien lo consuma después.

## Qué es Gmail Foundation

La abstracción que cualquier proveedor de correo (Gmail, Outlook, ...) implementa, más la capa de casos de uso que traduce lo que un proveedor devuelve en señales de producto deterministas -- sin que el resto de LUZ sepa que Gmail/Outlook existen.

```
features/reality/
  domain/       — EmailMessage, EmailSender, EmailImportance, EmailConnection,
                   EmailSyncCursor, EmailSyncOptions (+ EMAIL_SYNC_HARD_CEILING),
                   EmailSyncResult, EmailSnapshot (+ EmailThreadSummary),
                   ExternalMessageId/ExternalThreadId (en identifiers.ts,
                   junto a los de Calendar), EmailProviderKind
  providers/
    email-provider.ts   — el puerto (EmailProvider) + EmailLabelDescriptor
    gmail/               — GmailProvider (Gmail API v1), único proveedor real
  application/
    run-gmail-sync.ts           — paginación agnóstica de proveedor
    connect-gmail.ts            — valida y construye una EmailConnection
    disconnect-gmail.ts         — transición de estado pura
    synchronize-gmail.ts        — sync + bookkeeping de conexión
    apply-email-sync-result.ts  — fusiona un delta + hace cumplir el techo de 10
    refresh-gmail.ts            — synchronize + apply + snapshot, en una llamada
    get-email-snapshot.ts       — la vista de producto completa (5 señales)
    get-recent-emails.ts        — accesor angosto
```

Misma disciplina de capas que Calendar (ver arriba, "Responsabilidades por capa") -- `domain/` no sabe cómo se obtienen los mensajes, `providers/gmail/` es el único lugar del repo que sabe que Gmail existe, `application/` solo depende del puerto `EmailProvider`.

## Alcance deliberadamente acotado (la parte que NO es "como Calendar")

A diferencia de Calendar (sin límite de volumen), Gmail Foundation tiene un **techo de producto explícito, no solo técnico**: `EMAIL_SYNC_HARD_CEILING = 10` (`domain/email-sync-options.ts`). "Nunca más de 10 mensajes conocidos a la vez" se hace cumplir en tres capas independientes, a propósito (defensa en profundidad, no redundancia accidental):

1. `GmailProvider.sync()` recorta `options.maxResults` a este techo antes de pedirle nada a Gmail.
2. `applyEmailSyncResult()` vuelve a recortar DESPUÉS de fusionar `priorMessages` + el delta -- el único lugar con visibilidad sobre el estado acumulado completo.
3. El propio contrato (`EmailSyncOptions`, `EmailSnapshot`) documenta el techo como política, no como detalle de implementación.

**Nunca se persiste ni se transporta el cuerpo de un mensaje.** `EmailMessage` (`domain/email-message.ts`) no tiene NINGÚN campo para contenido/HTML/cuerpo -- ausencia estructural, no un campo opcional sin poblar. `GmailClient.getMessage()` pide `format=metadata` exclusivamente (nunca `format=full`/`raw`), y acota `metadataHeaders` a `From`/`Subject`/`Date` -- ni siquiera se le pide a Gmail que incluya más de lo que el dominio puede representar. El scope OAuth recomendado para esto es `gmail.metadata` (o, si un consumidor futuro ya usa `gmail.readonly` por otro motivo, sigue siendo válido -- este cliente simplemente nunca ejerce el permiso de leer cuerpos aunque el scope se lo permitiera).

## Frontera de proveedor

Mismo principio que Calendar (verificado por diseño, no solo por convención): `providers/gmail/` es el único lugar del repo que importa algo de la Gmail API, construye una URL de `gmail.googleapis.com`, o sabe que un `historyId` existe. `domain/` y `application/` solo conocen `EmailProvider` (el puerto) y las formas neutrales (`EmailMessage`, `EmailSnapshot`, ...).

## Flujo de sincronización

Dos caminos reales según haya o no un cursor previo -- mismo patrón de dos niveles que Calendar (paginación + aplicación):

```
sync inicial (cursor: null)
  GmailProvider.getProfile()          -- siembra historyId real, confirma
                                          identidad de cuenta (assertAccountMatches)
  → GmailClient.listMessages(≤10)     -- lista de ids, SIN confiar en su orden
  → GmailClient.getMessage(id) × N    -- format=metadata, aislado por mensaje
  → ordenado por receivedAt descendente, siempre -- determinista pase lo que
    pase con el orden que Gmail devolvió

sync incremental (cursor: historyId previo)
  GmailClient.listHistory(startHistoryId)   -- Change History API real
    messagesAdded / labelsAdded / labelsRemoved  → releer mensaje completo (upsert)
    messagesDeleted                              → id a borrar (gana sobre upsert)
  → historyId nuevo de la respuesta = cursor a persistir

applyEmailSyncResult(mensajesConocidos, upserted, deleted)
  → upsert por id, quita borrados, RECORTA a los 10 más recientes

getEmailSnapshot(mensajes, connection, options)
  → deriva EmailSnapshot -- pura, sin I/O

refreshGmail(...)  =  los tres pasos de arriba, en una sola llamada
```

`connectGmail(provider, input)` valida la conexión llamando `provider.listLabels()` una vez (mismo criterio que `connectCalendar`: credenciales inválidas fallan aquí, nunca en silencio en el primer sync). `disconnectGmail(connection)` es una transición de estado pura.

**Reautenticación real, no solo modelada**: `GmailClient` intenta EXACTAMENTE un refresh (`refresh_token` -> nuevo `access_token`, RFC 6749 §6) por request fallido con 401, proactivo si `expiresAt` indica que el token ya venció -- nunca un loop. Sin `refreshToken`/`clientId`/`clientSecret`, o si el refresh también falla, lanza `GmailAuthExpiredError` -- el llamador decide marcar `needs_reauth`, este cimiento nunca reintenta solo (mismo principio de restricción que `CalDavInvalidSyncTokenError` en Calendar).

**Aislamiento por registro** (misma lección que Calendar aprendió en su fase de hardening, aplicada aquí desde el principio, no después de un bug real): un mensaje individual que falla al obtenerse (404 -- borrado entre listar y leer) se omite con `console.error`, nunca aborta el resto del lote.

## Contrato del Snapshot -- cinco señales, todas deterministas

`EmailSnapshot` (`domain/email-snapshot.ts`) es el único punto de contacto que un feature de producto debería necesitar. Cada campo (salvo `recent`/`generatedAt`/`syncStatus`) es directamente una de las cinco señales pedidas por la misión -- mismo patrón que `today`/`upcoming`/`freeBlocks`/`busyPeriods`/`recurringCommitments` en `CalendarSnapshot`, nunca un tipo "Signal" genérico envolviendo todo:

| Señal | Campo | Regla exacta (ver `application/get-email-snapshot.ts`) |
|---|---|---|
| `new_email` | `newEmails` | `receivedAt` dentro de las últimas 24h antes de `now` (ventana de recencia, no delta contra una sincronización anterior -- esta función es pura sobre una lista estática) |
| `important_email` | `important` | `importance === "high"` |
| `unread_email` | `unread` | `unread === true` |
| `waiting_reply` | `waitingReply` | no leído + el remitente NO es la propia cuenta (`EmailConnection.externalAccountId`) + ≥4h desde que llegó |
| `recent_thread` | `recentThreads` | mensajes agrupados por `threadId`, con conteo y si el hilo tiene algo sin leer |

Ambos umbrales (24h, 4h) son parámetros de `EmailSnapshotOptions`, no constantes escondidas -- un consumidor puede ajustarlos sin tocar este cimiento.

## Puntos de extensión

1. **Un proveedor nuevo** (`OutlookMailProvider`): una carpeta nueva en `providers/`, una clase que implemente `EmailProvider`. Cero cambios en `domain/` o `application/`.
2. **Persistencia**: `EmailConnection` + el resultado de `applyEmailSyncResult`/`getEmailSnapshot` son las formas que una futura capa de persistencia guardaría -- mismo patrón que `core/calendar-connections/` para Calendar (tabla `email_connections`, cifrado de `refreshToken` vía `core/security/secret-cipher.ts`, reutilizable tal cual). Esa capa también es donde `GmailClient.getCurrentCredentials()` (el access token ya refrescado en memoria durante una llamada) debería leerse y re-guardarse -- este cimiento nunca lo persiste por su cuenta.
3. **OAuth real**: el scope incremental (`gmail.metadata` o `gmail.readonly`) sobre el proveedor Google YA configurado en `auth/providers/index.ts` (login) es la vía natural -- pedirlo en un flujo de conexión SEPARADO del login (mismo patrón que Calendar: conectar es una acción explícita de la persona, nunca agregado al scope de login por defecto, para no cambiar la pantalla de consentimiento que TODOS los usuarios ven al iniciar sesión).
4. **Bridge hacia `core/reality`/`core/connectors`**: igual que Calendar (ver arriba, punto #4) -- no existe todavía, documentado como extensión.
5. **Resolución de etiquetas personalizadas**: `EmailMessage.labels` son ids opacos (`Label_17`) -- `EmailProvider.listLabels()` ya existe para que un consumidor futuro los resuelva a nombres legibles por su cuenta.

## Consideraciones de producción y limitaciones honestas

- **Sin verificación contra una cuenta Gmail real todavía** -- mismo punto exacto en el que Calendar Foundation estaba antes de su fase de "Hardening" (ver arriba): esta fase construyó un cliente REAL (endpoints, formas de request/response, manejo de errores, todo según la documentación oficial de Gmail API v1), verificado con fixtures deterministas (mapper + pipeline completo + aislamiento multi-cuenta, ver `.scratch/smoke-gmail-foundation.ts`), pero sin una llamada real contra `gmail.googleapis.com` -- este entorno no tiene forma de completar un flujo de consentimiento OAuth interactivo. Verificar contra una cuenta real (como se hizo para Apple, ver `providers/apple/AUDIT.md` §8) es el siguiente paso recomendado antes de producción.
- **Una sola página de historial por llamada a `sync()`**: `GmailProvider` no persigue `nextPageToken` de `history.list()` dentro de una sola llamada -- reporta `hasMore: true` y confía en que `runEmailSync` (el runner de paginación, ya genérico) pida la siguiente página. Correcto por diseño, sin verificar empíricamente con un volumen de historial real.
- **`historyId` puede expirar** (Gmail retiene el historial por un tiempo limitado, no garantizado por días exactos) -- `GmailHistoryExpiredError` señala la condición; ningún llamador de esta fase implementa el reinicio automático a `cursor: null` (sería inventar comportamiento no pedido, mismo criterio que Calendar).
- **`assertAccountMatches`**: `GmailProvider` compara la cuenta autenticada (`getProfile().emailAddress`) contra `EmailConnection.externalAccountId` en cada sync inicial y aborta si no coinciden -- control de aislamiento defensivo añadido específicamente por la misión de hardening que motivó esta fase, sin equivalente hoy en `AppleCalendarProvider` (Apple no tiene un endpoint de perfil barato para hacer la misma comprobación).

## Para quien consume esto (Product Engineering / i7)

```ts
import {
  connectGmail, synchronizeGmail, refreshGmail,
  getEmailSnapshot, getRecentEmails, disconnectGmail,
} from "features/reality/application";
import { GmailClient, GmailProvider } from "features/reality/providers/gmail";

// 1) Construir el proveedor concreto -- SOLO este paso conoce a Gmail.
//    accessToken/refreshToken ya resueltos por un flujo OAuth futuro
//    (ver "Puntos de extensión #3") -- este cimiento nunca los obtiene.
const provider = new GmailProvider(new GmailClient({
  accessToken, refreshToken, expiresAt, clientId, clientSecret,
}));

// 2) Conectar (valida credenciales) -- guarda `connection` donde decidas.
const connection = await connectGmail(provider, { lifeGraphId, externalAccountId });

// 3) Sincronizar + obtener el snapshot en un solo paso.
const { connection: updated, cursor, messages, snapshot } =
  await refreshGmail(provider, connection, previousCursor, priorMessages);

// snapshot.newEmails / snapshot.unread / snapshot.important /
// snapshot.waitingReply / snapshot.recentThreads -- eso es todo lo que un
// componente de UI o un engine de LUZ debería necesitar tocar.
```

`provider`/`GmailClient` son las ÚNICAS piezas que saben que Gmail existe. Todo lo demás (`domain/`, `application/`) es válido sin cambios el día que exista `OutlookMailProvider`.
