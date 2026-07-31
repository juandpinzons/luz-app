# Experience Intelligence V1

Servicio de backend determinístico. `buildExperienceState` responde una
sola pregunta: **"de todo lo que Presence, Calendar Foundation y el
Dashboard ya decidieron, ¿cuál ES la experiencia de hoy?"**. Home ya
sabía componer esas piezas (`HomeState`); lo que faltaba no era una
capacidad nueva, era arbitrar entre ellas -- exactamente el mandato de
la misión "Experience Intelligence V1" ("el problema ya no son
capacidades faltantes, es orquestación").

Sin IA, sin aleatoriedad, sin repositorio de dominio propio. Vive en
`features/`, no en `core/` -- mismo criterio que `features/home/`,
`features/presence/` y `features/dashboard/` (ver ADR-0018). El único
estado que persiste es un log de eventos (`experience_card_shown`)
reusando la tabla `events` que ya existe para señales operacionales
(ver "Rotación" abajo) -- cero tabla nueva, cero motor nuevo.

## Estructura

```
experience/
  domain/        ExperienceState y sus tipos (el contrato)
  services/       collect-candidates, score-candidates, apply-rotation,
                   derive-tone, detect-what-changed, experience-signal-log
  application/    buildExperienceState -- el único punto de entrada público
```

## Por qué esto no es otro motor de decisión

Igual que Home y Presence (ver sus respectivos README), esto es un
agregador de solo lectura sobre datos que otros módulos ya calcularon
-- `HomeState` completo. No inventa una fuente de datos nueva, no llama
IA, no decide nada que Presence/Calendar Foundation/Dashboard no
hubieran ya decidido primero -- solo decide **cuál de esas decisiones
lidera hoy**.

La línea de continuidad de `buildMorningBrief` (la única entrada
generada por IA en todo `app/dashboard/page.tsx`) queda deliberadamente
fuera de esta arbitración -- sigue siendo "la voz de LUZ dirigiéndose a
la persona" (ver `features/home/README.md`, "Fase 3: Por qué Presence y
Dashboard no se tocaron"), no un dato sobre su vida. Meterla a competir
por `primary` arriesgaba mostrarla dos veces (bloque de apertura +
tarjeta primaria) sin ganar nada real a cambio.

## Relación con Home, Presence y Calendar Foundation

```
HomeState ──────────────────────────────────────┐
                                                  ▼
getRecentPrimaryKeys(events) ──────────────────→ buildExperienceState → ExperienceState
```

`buildExperienceState` recibe el `HomeState` que `app/dashboard/page.tsx`
ya construye (Presence + Calendar Foundation + Life Graph, sin
cambios) y las últimas tarjetas primarias mostradas a esta persona.
Produce un `ExperienceState`: una sola tarjeta `primary`, hasta tres
`secondary`, hasta tres `postponed`, y un `tone`.

## Fase 1-2: Candidatas y arbitración (`collect-candidates.ts`)

Cada campo de `HomeState` que representa una posible "cosa a mostrar"
se proyecta a una `ExperienceCard`:

| Categoría | Fuente | Importancia (0-4) |
|---|---|---|
| `focus` | `homeState.currentFocus.primary`/`.secondary` | `ObservationPriority` (high=3, medium=2, low=1) |
| `attention` | `homeState.attentionNeeded` | `RecommendationPriority` (critical=4 .. low=1) |
| `celebration` | `homeState.recentProgress.items` | fija en 1 -- nunca compite por urgencia |
| `calendar_moment` | `homeState.calendar.meetingMoments` | in_progress=4, starting_soon=3, recently_ended=1 |
| `upcoming_deadline` | `homeState.upcoming` | según días hasta vencer (≤1d=3, ≤3d=2, resto=1) |

**Deduplicación entre categorías:** un Goal estancado puede ser a la
vez `focus` (por la observación) y `attention` (por la recomendación
derivada de esa misma observación) -- mostrarlo dos veces sería la
"lógica duplicada" que esta misión y la de Presence ya piden evitar.
Cuando dos candidatas de categorías distintas apuntan a la misma
entidad real, gana la más rica (`attention` > `focus` >
`upcoming_deadline` > `celebration`); las demás categorías nunca
comparten entidad del Life Graph, así que nunca deduplican entre sí.

## Fase 4: Calendario modifica prioridades (`score-candidates.ts`)

`Calendar debe modificar prioridades. Nunca comportarse como un widget
aislado` -- en vez de fabricar tarjetas nuevas para "día lleno" o
"tarde libre" (que serían, irónicamente, el widget aislado que la
misión pide evitar), la forma general del día (`computeCalendarLoad`,
a partir de `calendar.today.length`) sube o baja un punto la
importancia de todo lo que NO sea, ya de por sí, un `calendar_moment`:

- **Día lleno** (`overloaded`, ≥5 eventos hoy): -1 a todo lo demás --
  solo algo genuinamente importante debería competir con reuniones
  reales por la atención.
- **Día vacío** (`light`, 0 eventos hoy): +1 a todo lo demás -- sin
  presión de tiempo, hay espacio real para una sugerencia proactiva
  (un objetivo estancado, una relación descuidada) que en un día
  normal se habría quedado en `secondary`.
- **Normal**: sin modificador.

## Fase 3: Rotación (`apply-rotation.ts` + `experience-signal-log.ts`)

Cada vez que Home decide una `primary`, se registra un evento
`experience_card_shown` (tabla `events`, ya existente -- "el catálogo
crece agregando valores al enum", ver `core/db/schema/events.ts`) con
`metadata.key`. En la siguiente visita, `getRecentPrimaryKeys` trae las
últimas 14 tarjetas primarias mostradas a esta persona.

`applyRotation` calcula, por candidata, cuántos días **seguidos**
(contando desde la visita más reciente hacia atrás, racha rota =
racha en 0) ya ganó `primary`. A partir de `MAX_CONSECUTIVE_DAYS = 2`,
esa candidata recibe una penalización lo bastante grande para nunca
ganarle a una candidata real -- fuerza una rotación real, nunca
cosmética. Si de verdad no hay ninguna otra candidata, la misma
tarjeta se muestra otra vez: fabricar una alternativa sería la
"novedad fabricada" que la misión prohíbe explícitamente.

Las candidatas que habrían ganado por importancia pero perdieron solo
por esta penalización van a `postponed` -- nunca se pierden, solo
descansan un día. El resto, ordenado por importancia real, va a
`secondary` (tope de 3, mismo criterio de "2-3" que ya usan
Home/Presence).

**Por qué no hace falta rastrear "interacción"/"completado" aparte:**
si la persona resuelve lo que una tarjeta señalaba (marca el Goal al
día, la reunión termina, la recomendación deja de aplicar),
simplemente deja de aparecer como candidata la próxima vez --
`collect-candidates.ts` lee siempre el estado actual, nunca un
snapshot congelado. "Completado" e "interacción" se derivan gratis de
que la realidad cambió, sin una segunda tabla de seguimiento.

## Fase 5: Tono (`derive-tone.ts`)

`Presence decide el tono, Experience Intelligence decide la atención`.
Antes de esta fase, `presence.urgency` (calculado solo a partir de
recomendaciones accionables) era la única señal de énfasis visual
disponible -- pero `primary` ahora puede ser una reunión en curso o un
objetivo estancado, señales que Presence nunca vio. `deriveTone` deriva
el tono de la MISMA tarjeta que ya ganó la arbitración (su
`importance`, con un techo por categoría: una reunión en curso nunca
pasa de `high`, una celebración siempre es `low`) en vez de
que Presence recalcule una urgencia independiente que podría
contradecir la decisión de `primary`.

## Fase 6: "¿Qué cambió?" (`detect-what-changed.ts`)

Complementa `isNewPrimary` (que solo dice si LA TARJETA cambió) con
`whatChanged: RealityChange[]` -- movimiento real en la vida de la
persona, aunque `primary` se mantenga igual. `buildRealityFingerprint`
comprime `HomeState.lifeContext` (+ `memoriesStored`, que vive en
`DashboardSummary`, no en `HomeState`) en una `RealityFingerprint`
compacta; `detectWhatChanged` compara la de hoy contra la de la visita
anterior y solo reporta diffs positivos reales: memorias nuevas,
goals/projects completados, observaciones nuevas, relaciones nuevas.

La huella se guarda en el MISMO evento `experience_card_shown`
(`metadata.fingerprint`, `experience-signal-log.ts`) -- ninguna tabla
nueva, mismo criterio que ya justifica reusar `events` para toda esta
misión. `getPreviousFingerprint` es una consulta separada de
`getRecentPrimaryKeys` (mismo índice, mismo `limit(1)` barato) para no
tocar el contrato de esa función ya existente.

**Por qué "reuniones nuevas" y "vencidos nuevos" quedan fuera:**
`HomeState` no expone IDs individuales de `calendar.today`/`overdue`
para diffear contra la visita anterior -- solo `upcoming`/`calendar`
como un todo. Diffear por CONTEO ahí habría producido falsos positivos
constantes (el calendario de "hoy" es un conjunto distinto cada día
aunque nadie agende nada nuevo), exactamente la "novedad fabricada"
que esta misión prohíbe. Alcance futuro documentado, no un olvido
silencioso -- requeriría que `HomeState` exponga IDs estables de esas
dos secciones.

## `ExperienceState`

Ver [`domain/experience-state.ts`](domain/experience-state.ts) para el
contrato completo y el porqué de cada campo (JSDoc, fuente de verdad).

## UI: acciones reales y `postponed` (continuación de la misión, "sigue desarrollando UX")

Dos huecos entre lo ya construido y lo que la UI mostraba:

- **`card.action` nunca llevaba a ningún lado.** `HomeState.quickActions`
  y `card.action` (`DashboardAction`) ya cargaban `targetEntity`, pero
  ninguna pantalla los traducía a una URL real -- el vocabulario de
  `DashboardEntityReference.kind` (goal/project/habit/person/relationship/domain)
  nunca se tradujo al vocabulario PLURAL de la ruta real de detalle
  (`app/life/[kind]/[id]/`, `KINDS`). `services/entity-link.ts`
  (`actionHref`) cierra esa traducción -- `person`/`domain` siguen sin
  ruta propia hoy (`null`, nunca un enlace roto), `acknowledge` nunca
  enlaza (no hay nada que abrir, solo reconocer lo que la tarjeta ya
  muestra). `PrimaryExperienceCard` y `SecondaryExperienceList` ya lo
  usan -- **no** se agregó una sección separada de "Quick Actions": la
  acción vive integrada en la tarjeta que ya la origina, evitando
  reintroducir el patrón de "widget aislado" que esta misión existe
  para eliminar.
- **`ExperienceState.postponed` se calculaba pero nunca se mostraba.**
  `PostponedExperienceNote` lo expone como una nota discreta bajo
  `secondary` -- nunca una tercera lista con el mismo peso visual,
  coherente con "posponer, no perder" (Fase 3).

## Escenarios sintéticos

```bash
npx tsx features/experience/tests/build-experience-state.examples.ts
```

Simula abrir Home varios días seguidos con la misma cuenta,
reutilizando los fixtures de `features/home/tests/` y
`features/presence/tests/` (nunca datos duplicados entre capas) más un
historial de `experience_card_shown` sintético, y verifica: (a) que la
misma tarjeta nunca gane `primary` un tercer día seguido cuando existe
una alternativa real, (b) que si de verdad no hay alternativa, se
mantenga -- nunca varía por variar, y (c) que `whatChanged` reporte
exactamente lo que cambió entre dos visitas simuladas, vacío cuando no
hay huella previa o cuando de verdad nada cambió.
