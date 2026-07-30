# Home (representación canónica de backend)

Servicio de backend determinístico. `buildHomeState` responde una sola
pregunta: **"¿qué debería mostrarle LUZ a esta persona al abrir la
aplicación?"**. Este es el objeto de datos que una futura pantalla
consumiría -- no la pantalla en sí, no hay UI aquí.

Sin IA, sin repositorios, sin base de datos, sin motor nuevo. Vive en
`features/`, no en `core/`, mismo criterio que `features/dashboard/`,
`features/presence/` y `features/reality/` ("Calendar Foundation", ver
ADR-0018 y el razonamiento completo en
[`features/presence/README.md`](../presence/README.md) y
[`features/reality/README.md`](../reality/README.md)).

## Estructura

```
home/
  domain/        HomeState y sus tipos (el contrato)
  services/       build-life-context.ts, build-quick-actions.ts,
                   build-calendar-context.ts
  application/    buildHomeState -- el único punto de entrada público
  tests/          fixtures.ts + calendar-fixtures.ts + script standalone
```

## Responsabilidades

Home tiene exactamente tres trabajos, y solo tres:

1. **Componer lo que Presence ya decidió** -- saludo, foco, urgencia,
   accionables, celebraciones, tal cual, sin cambiar ni un bit.
2. **Componer lo que Calendar Foundation ya decidió** -- ocupado/libre,
   próximos eventos, compromisos recurrentes, estado de sincronización,
   tal cual, con dos derivaciones mínimas y documentadas (deduplicar
   "hoy" de "próximos", categorizar reuniones por cercanía a "ahora").
3. **Agregar lo que ninguno de los dos cubre** -- contexto general del
   Life Graph (`lifeContext`) y compromisos con fecha declarados por la
   persona (`upcoming`), leídos directamente del `LifeDashboardSnapshot`.

Eso es todo. No decide prioridad, no decide urgencia, no filtra por
tipo de observación/recomendación/evento, no genera texto, no expande
recurrencia.

## Por qué Home no es otro motor de decisión

Un motor de decisión (en el sentido de ADR-0018: Context, Conversation
Strategy, Reasoning, Presence, Voice, Memory, Knowledge) tiene un
contrato de dominio propio y produce un juicio nuevo a partir de datos
crudos. Home no hace eso en ningún campo, ni siquiera con Calendar
Foundation integrado:

- Todo campo "de juicio" del Life Graph (`greeting`, `currentFocus`,
  `attentionNeeded`, `recentProgress`, `urgency`) es un passthrough
  exacto de `PresenceState` -- verificado en
  `tests/build-home-state.examples.ts` por **igualdad de referencia**,
  no de valor (`home.attentionNeeded === presence.attentionNeeded`).
- Todo campo "de juicio" del calendario (`today`, `freeBlocks`,
  `recurringCommitments`, `status`) es un passthrough exacto de
  `CalendarSnapshot` -- Calendar Foundation ya decidió qué está
  ocupado, qué está libre, qué se repite; Home nunca vuelve a calcular
  ninguno de los tres.
- Las dos únicas derivaciones de `calendar` (`upcomingEvents`,
  `meetingMoments`) son categorización por umbral fijo sobre datos ya
  decididos -- nunca una puntuación, nunca un ranking, mismo tipo de
  operación que ya hace `timeOfDayGreeting` en Presence. Ver
  `services/build-calendar-context.ts` para el detalle.
- `lifeContext`/`quickActions` siguen siendo proyecciones/conteos
  triviales, sin clasificación ni ranking nuevo, como antes de esta
  fase.

Por eso Home vive en `features/`, como agregador de solo lectura, y no
como un séptimo/octavo motor bajo `core/`.

## Relación con Presence y Calendar Foundation

```
LifeDashboardSnapshot ─┬────────────────────────────────┐
LifeObservation[]      ─┤→ buildPresenceState → PresenceState ─┐
FollowUpRecommendation[]┘                                       │
        │                                                       │
CalendarSnapshot (o null) ────────────────────────────────────┐ │
        │                                                     │ │
        └─────────────────────────→ buildHomeState(snapshot, observations,
                                       recommendations, presence, calendar) → HomeState
```

`buildHomeState` recibe los mismos tres contratos que ya consume
Presence, más el `PresenceState` que Presence ya calculó con ellos, más
un `CalendarSnapshot | null` de Calendar Foundation
(`features/reality/`, ver "Integración con Calendar Foundation" abajo).
Recibe los tres contratos del Life Graph otra vez -- no porque los
vuelva a decidir, sino porque `lifeContext.observationCount`/
`recommendationCount` necesitan el conteo real (`.length`), que
`PresenceState` no expone: Presence solo expone lo ya acotado a 2-3
elementos por sección.

`calendar` es `null` cuando la persona nunca conectó un calendario --
Calendar Foundation no persiste nada (ver
[`features/reality/README.md`](../reality/README.md)), así que esa
ausencia la conoce únicamente quien llama a `buildHomeState`.

## `HomeState`

| Sección sugerida | Campo | Tipo | Fuente |
|---|---|---|---|
| Greeting | `greeting` | `string` | `presence.greeting` |
| *(contexto, sin sección propia en la lista sugerida)* | `lifeContext` | `HomeLifeContext` | `snapshot.totals`/`domains`/`relationships` + conteos reales |
| Current Focus | `currentFocus` | `HomeCurrentFocus` | `{ primary: presence.primaryFocus, secondary: presence.secondaryFocus }` |
| Attention Needed **y** Recommendations | `attentionNeeded` | `FollowUpRecommendation[]` | `presence.attentionNeeded` (ver nota abajo) |
| Recent Progress | `recentProgress` | `HomeRecentProgress` | `{ encouragement: presence.encouragement, items: presence.recentProgress }` |
| *(transversal, matiza Current Focus y Attention Needed)* | `urgency` | `PresenceUrgencyLevel` | `presence.urgency` |
| Quick Actions | `quickActions` | `HomeQuickAction[]` | proyección de `attentionNeeded[i].suggestedAction` |
| Upcoming (Life Graph) | `upcoming` | `DueLifeItem[]` | `snapshot.upcoming` -- Goals/Projects con fecha, **no** eventos de calendario (ver nota abajo) |
| Busy Today / Free Time / Upcoming events / Calendar status / Meeting prep / Post-meeting follow-up | `calendar` | `HomeCalendarContext \| null` | `CalendarSnapshot` de Calendar Foundation (ver tabla siguiente) |
| *(sin sección, metadato)* | `asOf` | `Date` | `presence.asOf` |

**Nota sobre "Attention Needed" vs. "Recommendations":** la misión
sugiere ambas como secciones distintas. Son el mismo dato --
recomendaciones accionables ya priorizadas por Presence (nunca
`CELEBRATE_PROGRESS`, nunca `NO_ACTION`). Exponerlas dos veces bajo
nombres distintos habría sido exactamente la "lógica de ranking
duplicada" que las dos misiones de Home piden evitar. Un cliente que
necesite dos presentaciones visuales (p. ej. un banner con lo más
urgente + una lista completa) las arma a partir de este mismo arreglo
(ya ordenado) y de `urgency`, sin que Home tenga que decidir nada dos
veces.

**Nota sobre `upcoming` vs. `calendar.upcomingEvents`:** dos dominios
distintos, con vocabulario distinto (`DueLifeItem` vs. `CalendarEvent`).
`upcoming` son compromisos que la persona declaró en el Life Graph (un
Goal con `targetDate`, un Project con `dueDate`); `calendar.upcomingEvents`
son eventos reales de un calendario externo. Ninguno es subconjunto del
otro -- fusionarlos en un solo arreglo habría perdido esa distinción
real sin ganar nada.

### `HomeCalendarContext`

| Sección sugerida | Campo | Tipo | Fuente |
|---|---|---|---|
| Calendar status | `status` | `CalendarSyncState` | `calendar.syncStatus.state`, sin reinterpretar |
| Busy Today | `today` | `readonly CalendarEvent[]` | `calendar.today`, passthrough exacto |
| Upcoming events | `upcomingEvents` | `readonly CalendarEvent[]` | `calendar.upcoming` menos lo que ya está en `today` (deduplicado por `id` -- ver "Auditoría", hallazgo #1) |
| Free Time | `freeBlocks` | `readonly FreeTimeBlock[]` | `calendar.freeBlocks`, passthrough exacto (abarca toda la ventana, no solo hoy) |
| *(mitigación de la Fase 1, ver abajo)* | `recurringCommitments` | `readonly RecurringCommitment[]` | `calendar.recurringCommitments`, passthrough exacto |
| Meeting preparation / Post-meeting follow-up | `meetingMoments` | `readonly HomeMeetingMoment[]` | derivado de `today`, categorizado por umbral fijo respecto a `calendar.generatedAt` (ver `services/build-calendar-context.ts`) |

Cada campo, tipo, y de dónde sale exactamente está documentado en el
JSDoc de [`domain/home-state.ts`](domain/home-state.ts) -- estas tablas
son el resumen, ese es la fuente de verdad.

## Qué cambió en esta revisión (Home V2)

La Tarea 1 de esta misión pedía revisar la implementación anterior
buscando duplicación, responsabilidades faltantes, solapamiento con
Presence, DTOs inestables y acoplamiento innecesario. No se encontró
ninguna decisión duplicada (ya estaba probado por igualdad de
referencia desde la misión anterior), pero sí tres problemas reales de
forma del contrato:

1. **`currentContext` colisionaba conceptualmente con "Current Focus".**
   Dos nombres empezando con "Current" para cosas distintas (contexto
   general vs. la señal puntual) es el tipo de ambigüedad que un DTO
   "estable" no debería tener. Renombrado a `lifeContext`.
2. **`primaryFocus`/`secondaryFocus` como dos campos sueltos** cuando
   la sección que la misión pide es una sola ("Current Focus").
   Consolidados en `currentFocus: { primary, secondary }`.
3. **`recommendations` usaba un nombre distinto al que Presence ya le
   dio a los mismos datos (`attentionNeeded`)** -- una inconsistencia
   de nombres entre las dos capas que obligaba a verificar si eran o
   no el mismo arreglo. Renombrado a `attentionNeeded` en Home también.

Ningún cambio de lógica: los tres son renombres/reagrupaciones puras,
sin tocar `buildPresenceState` ni ningún criterio de ranking.

## Integración con Calendar Foundation (misión "Calendar Experience V1")

`features/reality/` ("Calendar Foundation") llegó completo desde M4:
contratos, un proveedor real (Apple/CalDAV), y una capa de aplicación
completa (`getCalendarSnapshot`, `getUpcomingEvents`, `refreshCalendar`,
etc.) que ya produce `CalendarSnapshot` -- la vista de producto que
Home consume. Esta misión pedía tres cosas antes de integrar: revisar
la recurrencia, auditar el resto, y solo entonces construir la
experiencia. Las tres se hicieron, en ese orden, y **`features/reality/`
terminó sin ningún cambio** -- todo lo que sigue explica por qué.

### Fase 1 -- Recurrencia: revisado, sin cambios

Límite documentado de Calendar Foundation: nunca expande `RRULE`, así
que una serie recurrente sin una instancia con fecha concreta ya
sincronizada para hoy/pronto no aparece en `today`/`upcoming` (sigue
apareciendo en `recurringCommitments`, que no necesita fechas). La
misión pedía decidir si esto merece una mejora mínima sin construir un
motor de recurrencia completo.

**Conclusión: no se toca Calendar Foundation.** Evidencia real, no
solo teoría:

- `providers/apple/AUDIT.md` documenta que una sincronización acotada
  por fecha contra una cuenta iCloud real SÍ devolvió instancias
  concretas de eventos recurrentes dentro de la ventana consultada --
  el patrón de integración que un consumidor real usaría (sincronizar
  con una ventana) ya cubre el caso común. La limitación documentada es
  un caso límite real, no el comportamiento dominante.
- Cualquier expansión de `RRULE`, por "mínima" que sea, arrastra los
  mismos riesgos que una completa (DST, `EXDATE`, `BYSETPOS`,
  excepciones con su propia regla) -- una fecha calculada
  silenciosamente MAL es peor que una serie honestamente ausente de
  `today`/`upcoming`, y contradice el principio ya establecido en
  `PRESENCE_PRINCIPLES.md` de nunca inventar certeza que no existe.
- La mitigación de producto correcta ya existe en el propio dominio:
  `recurringCommitments`. `HomeCalendarContext.recurringCommitments` lo
  expone tal cual (passthrough) -- esa es la respuesta de esta fase,
  no una expansión de fechas.

### Fase 2 -- Auditoría: dos hallazgos reales

**Hallazgo #1 (corregido, en Home): `upcomingEvents` duplicaba `today`.**
`CalendarSnapshot.upcoming` incluye eventos de HOY (su ventana empieza
en `todayStart`, no después) -- pasarlo tal cual a una sección
"Upcoming events" distinta de "Busy Today" habría mostrado cada evento
de hoy dos veces. Corregido enteramente en Home
(`build-calendar-context.ts`, `excludeToday`), sin tocar
`features/reality/`: `upcomingEvents` resta por `id` lo que ya está en
`today`.

**Hallazgo #2 (investigado, sin cambio -- el diseño ya era correcto):**
`recurringCommitments` se calcula sobre TODOS los eventos activos, no
solo los de la ventana `today`/`upcoming`, a pesar de que el campo se
llama `occurrencesInWindow`. La primera lectura sugiere un bug
(nombre vs. implementación no coinciden). Investigando el docblock del
tipo (`../reality/domain/calendar-snapshot.ts`) se confirma que es
intencional: `recurringCommitments` existe PRECISAMENTE para mostrar
series sin ninguna fecha concreta en la ventana (la mitigación de la
Fase 1) -- filtrarlo por ventana habría roto su único propósito.
**No se cambió nada** -- el nombre del campo es levemente impreciso,
pero no es un bug, y renombrar un campo de un contrato ya entregado por
M4 sobre una imprecisión de nombre no calificaba como "problema real"
bajo el mandato de esta fase ("fix only real issues, do not expand
scope").

**Hallazgo #3 (real, diagnosticado, deliberadamente sin resolver):
límite de zona horaria heredado de Calendar Foundation.**
`getCalendarSnapshot`/`getUpcomingEvents` calculan fronteras de "hoy" en
UTC puro (`calendar-timing-helpers.ts`, límite documentado en
`features/reality/README.md`, punto de extensión #5). El resto de LUZ
ya asume hora de Bogotá (`buildGreeting` en Presence). Para alguien en
Bogotá (UTC-5), desde las 7pm en adelante la frontera UTC de "hoy" ya
rodó al día calendario siguiente mientras en Bogotá sigue siendo el
mismo día -- un evento de esa misma mañana desaparece de `today` Y de
`upcoming` (no se recategoriza, desaparece).

Se investigó una corrección desde este lado (desplazar `now` antes de
llamar a `getCalendarSnapshot`) y **se descartó explícitamente**:
`startOfUtcDay` solo puede devolver instantes a las `00:00:00Z`; la
medianoche real de Bogotá cae a las `05:00:00Z`. Ningún desplazamiento
de `now` hace que ambas coincidan -- en el mejor caso, un ajuste así
solo cambia CUÁNDO se manifiesta el error, nunca lo elimina, y arriesga
dar una falsa sensación de que está resuelto. La corrección real
requiere que Calendar Foundation reciba una zona horaria (el
`timeZone?: string` aditivo que M4 ya reservó como punto de extensión)
y la use para desplazar la comparación, no solo `now` -- un cambio
dentro de `features/reality/`, fuera del alcance de esta misión
("Do NOT modify... Calendar Foundation").

`tests/build-home-state.examples.ts` reproduce este límite
deliberadamente (escenario "calendar: límite real de zona horaria") en
vez de ocultarlo -- documentado, no oculto, hasta que exista ese
parámetro.

### Fase 3 -- Por qué Presence y Dashboard no se tocaron

Calendar Foundation ya decidió todo lo que hay que decidir sobre el
calendario (`today`/`upcoming`/`busyPeriods`/`freeBlocks`/
`recurringCommitments`/`syncStatus`) -- exactamente el mismo tipo de
"decisión ya tomada aguas arriba" que Presence representa para el Life
Graph. Extender `PresenceState` con un cuarto input (calendario)
habría ensanchado un contrato que esta misma serie de misiones ya dejó
"estable" a propósito, sin necesidad real: nada de lo que Calendar
Foundation expone necesita pasar por el algoritmo de urgencia/foco de
Presence, porque calendario y Life Graph son dominios independientes
(una reunión no es un Goal, un hueco libre no es una recomendación).
Fusionarlos en un único score de urgencia habría sido inventar un
motor de decisión nuevo, justo lo que la misión prohíbe. Mismo
razonamiento para `features/dashboard/`: no tiene ningún rol en
calendario, ni antes ni después de esta fase.

`Greeting` como punto de contacto se resolvió sin tocar
`presence.greeting`: el saludo sigue siendo responsabilidad exclusiva
de Presence (hora del día, sin datos de identidad ni de calendario). Un
futuro cliente que quiera combinar "Buenos días." con "tienes 3
reuniones hoy" arma esa frase a partir de `home.greeting` +
`home.calendar.today.length` -- Home expone las piezas, no redacta
prosa combinándolas (autoría de texto a partir de múltiples señales es
exactamente el tipo de decisión que un agregador de solo lectura no
debe tomar).

## Extensiones futuras (sin romper el contrato)

- Nuevos tipos de `LifeObservation`/`FollowUpRecommendation` fluyen
  automáticamente hasta `HomeState` sin cambios aquí: Home nunca hace
  `switch` sobre `type`, solo pasa arreglos completos.
- **`GoogleCalendarProvider`/`OutlookCalendarProvider`**: cuando
  existan (ver `features/reality/README.md`, "Puntos de extensión"),
  `HomeCalendarContext` no cambia de forma -- `buildHomeState` sigue
  recibiendo un `CalendarSnapshot`, sin importar qué proveedor lo
  produjo. Calendar Foundation ya garantiza esa frontera.
- **`timeZone` real en Calendar Foundation** (ver hallazgo #3 arriba):
  el día que `features/reality/` acepte ese parámetro, quien construya
  el `CalendarSnapshot` para Home debe empezar a pasarlo -- cero cambio
  de forma en `HomeState`, solo en cómo se calcula lo que ya recibe.
- Un futuro campo de identidad (nombre, foto) requeriría un input
  nuevo -- ni Presence ni Home reciben datos de identidad hoy, a
  propósito.
- Si `lifeContext` necesitara más resumen (p. ej. racha de hábitos), se
  deriva del mismo snapshot ya presente, nunca de una consulta nueva.

## Escenarios sintéticos

**Life Graph (8 escenarios, `calendar: null` en los 8):** los 7
compartidos con Presence (`features/presence/tests/fixtures.ts` --
busy work day, calm productive day, recovery day, relationship day,
goal crisis, celebration day, empty account) más uno propio de Home,
`highly active user` (`tests/fixtures.ts`), agregado sin modificar
`features/presence/` porque la misión anterior pedía trabajar solo
dentro de `features/home/`. `highly active user` es el único con
volumen real (6 observaciones, 5 recomendaciones) para ejercitar
`lifeContext.observationCount`/`recommendationCount` con una brecha
significativa frente a lo mostrado, y el recorte de `recentProgress`
en un escenario que no es ni una crisis ni un día vacío.

**Calendar (5 escenarios, `tests/calendar-fixtures.ts`)**, cada uno
sobre una base de Life Graph vacía (`emptyAccount`) para aislar la
variable de calendario:

- `busy day with meetings` -- corre `getCalendarSnapshot` de verdad
  (`features/reality/application`, sin modificar) sobre eventos
  sintéticos: una reunión de la mañana, una que acaba de terminar, una
  en curso, una por empezar, una de mañana, una serie recurrente sin
  instancia en la ventana, y una cancelada. Ejercita `today`,
  `upcomingEvents` (deduplicado), `freeBlocks`, `recurringCommitments`
  y las tres categorías de `meetingMoments` a la vez.
- `límite real de zona horaria` -- reproduce a propósito el hallazgo
  #3 de la Fase 2 (arriba): a las 10pm hora de Bogotá, un evento de esa
  misma mañana desaparece de `today` y de `upcoming`. Documentado, no
  oculto -- ver la sección de arriba para por qué no se intentó
  corregir desde este lado.
- `nunca sincronizado` / `error de sincronización` -- `status` pasa tal
  cual desde `CalendarSnapshot.syncStatus.state`, sin reinterpretar.
- `sin conectar` -- `calendar: null`, el caso que ningún
  `CalendarConnection` cubre por sí solo (Calendar Foundation no
  persiste nada, ver `features/reality/README.md`).

```bash
npx tsx features/home/tests/build-home-state.examples.ts
```

Verifica, por cada escenario: que `HomeState` sea correcto, y que sea
un passthrough real de `PresenceState`/`CalendarSnapshot` (comparación
por referencia en todo campo que Presence o Calendar Foundation ya
decidieron).
