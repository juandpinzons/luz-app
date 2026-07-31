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
