# Living Narrative Foundation

Misión: "Living Narrative Foundation" -- hasta ahora LUZ recuerda hechos, recomienda acciones, cierra ciclos, pero cada visita se trataba como una interacción aislada. `buildNarrativeState` responde una sola pregunta: **de todo lo que Memory, Knowledge, Reality, Experience y Continuity ya decidieron, ¿qué historia está activa, en qué capítulo, qué cambió desde la última visita, y qué merece continuación, celebración o silencio?**

Sin IA, sin aleatoriedad, sin repositorio de dominio propio, sin tabla nueva. Vive en `features/`, no en `core/` -- mismo criterio que `features/home/`, `features/experience/` y `features/presence/` (ver ADR-0018). Es orquestación, no inteligencia: cada decisión que toma ya la tomó otro módulo primero (Continuity decidió qué asunto rastrear, Experience decidió qué cambió, Home/Presence decidieron qué merece el foco de la persona) -- Narrative solo traduce esas decisiones a vocabulario de historia y las ordena.

## Estructura

```
narrative/
  domain/          NarrativeState y sus tipos (el contrato)
  services/         derivación de capítulo, ranking, momentos, categorización
  application/      buildNarrativeState -- el único punto de entrada público
  integrations/      contratos hacia Presence/Conversation/Morning Brief/Dashboard/Notification -- sin wiring
  tests/            fixtures.ts + script standalone con los 8 escenarios de la misión
```

## Por qué esto no es otro motor de decisión

Igual que Home/Experience/Presence, esto es un agregador de solo lectura sobre datos que otros módulos ya calcularon. No inventa una fuente de datos nueva, no llama IA, no decide nada que Continuity/Experience/Dashboard no hubieran decidido primero -- solo decide **cómo se ve, en conjunto, la vida de la persona como una historia continua**. Ningún archivo de Memory/Knowledge/Reality/Experience/Continuity se modificó para esta misión (verificado: cero import cruzado en ese sentido) -- todo se consume por contrato público ya existente.

## Relación con las fuentes permitidas

```
ContinuityLoop[] ──────────────────────┬──────────────────────────────┐
                                        ▼                              │
                            buildThreadsFromLoops → NarrativeThread[]  │
                                        │                              │
HomeState (+Presence passthrough) ─────┤                              │
CalendarSnapshot ───────────────────────┤                              ▼
FollowUpRecommendation[] (completo) ───┤                    selectPrimaryNarrative
LifeDashboardSnapshot.overdue ─────────┤                    categorizeThreads
EmailSnapshot ──────────────────────────┴──→ buildMoments → NarrativeMoment[]
ExperienceState.whatChanged ────────────────────────────────────────→ recentChanges (passthrough)
RealitySnapshot (aceptado, uso mínimo, ver abajo)
                                        │
                                        ▼
                                 buildNarrativeState → NarrativeState
```

`buildNarrativeState` (`application/build-narrative-state.ts`) recibe los nueve tipos de entrada que la misión permite. `PresenceState` no se recibe aparte: `HomeState` ya lo incluye por passthrough exacto (ver `features/home/README.md`), mismo criterio que `buildExperienceState` ya aplica frente a `HomeState`.

## Dominio

- **`NarrativeThread`**: una historia real, rastreada a través de visitas -- **1:1 con un `ContinuityLoop` real, siempre**. Un `ContinuityLoop` ya ES "un asunto real que LUZ decidió mantener vivo hasta un desenlace real" (`core/continuity-engine/README.md`), que es exactamente la definición de una historia con capítulos. Narrative nunca sintetiza un thread a partir de otra cosa.
- **`NarrativeMoment`**: algo real que vale la pena notar HOY sin (todavía) tener su propio thread -- una reunión sin loop propio, un correo importante, una recomendación `CELEBRATE_PROGRESS`. Nunca tiene capítulo ni progresión.
- **`NarrativeChapter`**: `{ stage: NarrativeProgression, since: Date }` -- la etapa actual de un thread, más desde cuándo.
- **`NarrativeProgression`**: `beginning | developing | waiting | turning_point | resolution | reflection | archived`.
- **`NarrativePriority`**: misma escala `low | medium | high | critical` que `LoopPriority`/`PresenceUrgencyLevel`/`RecommendationPriority` -- reutilizada, no reinventada.
- **`NarrativeReason`**: por qué un thread/momento merece atención ahora -- 13 valores cerrados, cada uno 1:1 a una condición real (`services/derive-reason.ts`). Campo de explicabilidad obligatorio (Principio 3: "Every Insight must be explainable").
- **`NarrativeCandidate`**: proyección común de thread/momento para ranking -- nunca expuesta en `NarrativeState`, es moneda interna (mismo rol que `ExperienceCard` para `features/experience/`).
- **`NarrativeContinuation`**: `{ threadId, kind, reason, title, summary }` -- CÓMO retomar la historia activa. `kind` es un valor cerrado (`resume|check_in|celebrate|reflect|prepare|release`), nunca una frase: la redacción real es responsabilidad de un futuro consumidor con esa capacidad (Morning Brief, Conversation Strategy), nunca de este módulo.

Cada tipo, campo y su procedencia exacta está documentado en el JSDoc de `domain/*.ts` -- este README es el resumen, esa es la fuente de verdad.

## Ciclo de vida narrativo

`services/build-threads-from-loops.ts` (`deriveChapter`) deriva la etapa **EXCLUSIVAMENTE** de `ContinuityLoop.state` + sus timestamps -- nunca de contenido, nunca de una interpretación nueva:

| Etapa | Condición exacta |
|---|---|
| `beginning` | `state === "open"`, detectado hace menos de `BEGINNING_WINDOW_DAYS` (3) días |
| `developing` | `state === "open"`, detectado hace 3 días o más |
| `waiting` | `state === "waiting"` |
| `turning_point` | `state === "follow_up"` -- el momento programado para resurfacear ya se cumplió |
| `resolution` | `state === "resolved"`, cerrado hace menos de `RESOLUTION_FRESH_DAYS` (3) días |
| `reflection` | cualquier estado terminal, cerrado hace menos de `REFLECTION_WINDOW_DAYS` (14) días (y ya no lo bastante fresco para `resolution`) |
| `archived` | cualquier estado terminal, cerrado hace 14 días o más |

`since` es `LoopResolution.resolvedAt` real para las tres etapas terminales, y `ContinuityLoop.updatedAt` (aproximación honesta y documentada, "último cambio real del loop") para las cuatro no terminales -- Narrative no mantiene su propio historial de transiciones (violaría "a narrative never stores data").

Pueden existir varias historias concurrentes (`openStories` puede tener más de un elemento); solo una se convierte en `currentActiveStory` (`services/select-primary-narrative.ts`) -- la de mayor `score`, elegible siempre que su capítulo no sea `archived` (`resolution`/`reflection` SÍ pueden liderar: reconocer algo que se acaba de cerrar es tan "no empezar de cero" como continuar algo abierto).

## Ranking determinístico -- cada peso documentado

`services/narrative-score.ts` calcula un score 0-4 por candidata (misma escala que `ExperienceCard.importance`). La base es la prioridad ya decidida por Continuity/Dashboard/Gmail (`low=1 .. critical=4`); tres grupos de modificadores, cada uno **+1 como máximo** (mismo criterio de contención que el único modificador que ya usa Experience, `LOAD_MODIFIER` ±1), agrupan los nueve nombres de señal que sugiere la misión:

| Grupo | Señales que agrupa | Se activa cuando... |
|---|---|---|
| **Momentum** | freshness, continuity, follow-up urgency | el reloj que Continuity programó ya se cumplió (`isFollowUpDue`), o cambió de verdad hace poco Y ya tiene trayectoria real de seguimiento (`isFresh && isContinuingStory`) |
| **External pull** | calendar proximity, user attention, emotional weight | hay un ancla real (evento de calendario correlacionado, o `nextFollowUpAt`) dentro de ±48h, o Presence/Home ya decidieron que esta entidad merece el foco de la persona, o su categoría ya clasificada trae un peso fijo más alto |
| **Longevity** | story age | no terminal, `LONG_RUNNING_THRESHOLD_DAYS` (= `STALLED_THRESHOLD_DAYS`, reusado de `features/dashboard/`, hoy 30 días) o más sin resolverse |

`celebration value` no es un bono aditivo, es un **piso** (`CELEBRATION_SCORE_FLOOR = 2`): una celebración real (desenlace positivo, o `CELEBRATE_PROGRESS`) nunca baja de "medio", pero el piso es deliberadamente medio, nunca el máximo -- una historia genuinamente crítica sigue pudiendo ganarle.

**`emotional weight`, nota obligatoria por la regla "Never infer emotional state":** es un lookup ESTÁTICO por categoría YA CLASIFICADA por Continuity (`LoopReason === "relationship_milestone"` o `"significant_life_event"`) -- nunca una lectura del contenido real de una Memory/mensaje, nunca una afirmación sobre cómo se siente la persona. Mismo tipo de decisión que `BASE_CONFIDENCE`/`TYPE_SEVERITY` en `features/dashboard/`: un peso fijo por categoría, documentado, nunca una inferencia nueva.

`derivePriorityFromScore` traduce el score a `NarrativePriority` con los mismos cuatro cortes que ya separa `ExperienceCard.importance`.

## Momentos y correlación con threads

`services/build-moments.ts` construye `NarrativeMoment[]` desde cuatro fuentes (recomendaciones sin loop propio, `LifeDashboardSnapshot.overdue`, `HomeState.calendar.meetingMoments`, `EmailSnapshot`) -- cada una se correlaciona primero contra `loops` por **`trigger.origin` + `trigger.sourceId` exactos** (la misma correlación que ya usan las propias reglas de apertura de Continuity, p. ej. `detectFromRecommendation` guarda `sourceId: recommendation.id`). Si ya existe un thread no-terminal para esa fuente, el momento NUNCA se crea -- mostrar el mismo hecho real dos veces sería exactamente la "lógica duplicada" que Home/Experience/Presence ya advierten evitar en sus propios README.

`CELEBRATE_PROGRESS` es la única fuente que nunca correlaciona (Continuity, por regla propia, nunca la convierte en loop) -- siempre pasa como momento.

## `NarrativeState` -- diez categorías, un solo pool

Cada arreglo de salida (salvo `celebrationCandidates`) es un **filtro** sobre el mismo pool de `NarrativeThread[]` que ya construyó `build-threads-from-loops.ts` -- las categorías se solapan a propósito (un mismo thread puede ser `openStories` Y `longRunningStories` Y `storiesWaitingQuietly` a la vez), mismo criterio ya documentado en `features/home/README.md` ("Attention Needed y Recommendations son el mismo dato"). `isLongRunning`/`isFadingWithoutEvidence` se exponen como campos propios del thread (no solo inferibles de `reason`) precisamente porque `reason` puede estar ocupado por algo más específico (p. ej. `follow_up_due`) incluso cuando alguno de los dos también es cierto -- un thread puede aparecer en `storiesReadyForFollowUp` Y `storiesReadyToBeForgotten` simultáneamente, verificado en el escenario "relationship recovery".

| Campo | Regla |
|---|---|
| `currentActiveStory` | mayor score, capítulo ≠ `archived` |
| `continuation` | lookup fijo desde `currentActiveStory.reason` |
| `recentChanges` | passthrough exacto de `ExperienceState.whatChanged` |
| `openStories` | capítulo en `beginning\|developing\|waiting\|turning_point` |
| `recentlyClosedStories` | capítulo en `resolution\|reflection` |
| `celebrationCandidates` | `reason === "celebration_moment"`, threads Y momentos |
| `longRunningStories` | `isLongRunning` |
| `storiesReadyForReflection` | capítulo `reflection` |
| `storiesReadyForFollowUp` | capítulo `turning_point` |
| `storiesReadyToBeForgotten` | `isFadingWithoutEvidence` |
| `storiesWaitingQuietly` | capítulo `waiting` |

## Por qué `RealitySnapshot` no se usa a fondo

Se acepta como parámetro opcional de `buildNarrativeState` (misión: una de las nueve fuentes permitidas), pero deliberadamente no se minan sus campos ricos. Auditados los tres candidatos reales:

- `contradictions` (máximo 1 tensión abierta) -- ya representado, de forma más completa, por un `ContinuityLoop` `recommendation_pending` si la contradicción alcanzó prioridad `high`/`critical` (regla de apertura ya existente).
- `curiosity.pendingQuestion` -- ya representado por un loop `question_pending_answer`.
- `life` (Goals/Projects/Habits activos) -- ya representado, con más detalle (`overdue`/`stalled`/fechas), por `LifeDashboardSnapshot`.
- `signals` (`ExternalSignalSnapshot`) -- placeholder permanentemente vacío hoy (ningún engine lo alimenta todavía, documentado en su propio archivo).

Minar estos campos aparte habría arriesgado exactamente la "lógica de ranking duplicada" que Home/Experience/Presence ya advierten evitar: dos caminos de código decidiendo el mismo hecho real, con riesgo real de discreparse entre sí.

## Integraciones -- contratos, sin wiring profundo

`integrations/` -- ninguna de estas funciones se llama hoy desde ningún consumidor real (cero import cruzado, verificado), mismo criterio que `features/continuity/integrations/`:

- **Presence**: `toPresenceContinuitySignal(currentActiveStory) -> NarrativePresenceSignal | null`.
- **Conversation**: `toConversationContext(state) -> NarrativeConversationContext` -- datos crudos (thread activo, capítulo, continuación, conteo de historias abiertas), nunca una frase.
- **Morning Brief**: `toMorningBriefContext(state) -> NarrativeMorningBriefContext` -- datos crudos; `build-morning-brief.ts` sigue siendo el único lugar que llama a un `AIProvider` en `features/dashboard/`.
- **Dashboard**: `toDashboardEntityReferences(thread) -> DashboardEntityReference[]` -- solo los kinds que Dashboard ya sabe enlazar.
- **Notification Layer**: `toNotificationCandidate(state) -> NarrativeNotificationCandidate | null` -- solo `currentActiveStory` con prioridad `high`/`critical`, deliberadamente conservador (una notificación interrumpe activamente). Esta capa de producto no existe todavía en el repo.

## Cómo se cumple cada regla de la misión

- **Never invent events**: todo thread es 1:1 con un `ContinuityLoop` real; todo momento correlaciona contra una fuente real (recomendación/evento/correo/vencido) antes de existir.
- **Never fabricate progress**: el capítulo deriva solo de `state` + timestamps reales, nunca de una suposición.
- **Never infer emotional state**: `hasFixedEmotionalWeight` es un lookup estático por categoría ya clasificada, nunca una lectura de contenido (ver "Ranking determinístico" arriba). Ningún campo de `NarrativeState`/`NarrativeThread`/`NarrativeMoment` representa un estado de ánimo.
- **Never duplicate Memory**: `NarrativeThread`/`NarrativeMoment` solo referencian (`relatedEntities`), nunca copian contenido; ver "Momentos y correlación" para la deduplicación explícita.
- **Never reopen closed Continuity Loops**: Narrative es de solo lectura de punta a punta -- ningún archivo de este módulo importa `transitionLoop` ni ningún repositorio de escritura.
- **No LLM reasoning**: ningún archivo importa un `AIProvider` ni SDK de IA (verificable: cero import de `ai/`).
- **No UI, no routes, no chat, no pages**: correcto -- `features/narrative/` no tiene ningún archivo bajo `app/`.

## Escenarios sintéticos

```bash
npx tsx features/narrative/tests/build-narrative-state.examples.ts
```

Los ocho escenarios que pide la misión, uno por uno:

| Escenario | Qué verifica |
|---|---|
| Job interview | `calendar`/`important_meeting`, capítulo `beginning`, bono de proximidad real, gana `currentActiveStory` |
| Birthday | `relationship`/`relationship_milestone` hoy, razón `milestone_today`, continuación `celebrate` |
| Long-term goal | `memory`/`explicit_intention` abierta 45 días -- capítulo `developing` (nunca `beginning`), `long_running_unresolved` |
| Relationship recovery | `state: follow_up` con 4 intentos -- `turning_point` Y `storiesReadyToBeForgotten` a la vez (categorías solapadas) |
| Medical treatment | `memory`/`significant_life_event` en `waiting`, peso emocional fijo aplicado |
| Project completion | `state: resolved` con desenlace positivo -- `resolution`, `celebration_moment`, aparece en `celebrationCandidates` referenciando el mismo thread |
| Career change | MISMO origen/razón que "long-term goal" pero recién detectada -- prueba que la EDAD, no el origen, decide `beginning` vs `developing` |
| Vacation planning | `future_commitment` con evento a 20 días (fuera de la ventana de 48h) -- sin bono de proximidad, pierde contra una reunión más cercana |

Más tres verificaciones estructurales: cuenta vacía (nada inventado), un `NarrativeMoment` nunca puede ganar `currentActiveStory`, y determinismo (mismas entradas, mismo `NarrativeState` byte a byte).

## Límites y riesgos conocidos

- **`approaching_deadline` no revalida si la fecha ya pasó.** La razón deriva de `LoopTrigger.reason` (fijado al detectarse el loop), nunca se recalcula contra la fecha real actual -- un loop `deadline` abierto hace 40 días sigue leyendo "approaching_deadline" aunque la fecha ya haya pasado hace semanas. Mitigado parcialmente por `LifeDashboardSnapshot.overdue` (que sí crea un `NarrativeMoment` fresco para vencidos sin thread propio), pero un thread YA existente no se corrige. Corregirlo exigiría que `build-threads-from-loops.ts` también reciba `overdue`/`upcoming` para re-evaluar cada loop de origen `goal`/`project` -- alcance futuro documentado, no un olvido.
- **Correlación calendario/correo depende de que `trigger.sourceId` siga siendo válido.** Si un evento se reprograma con un id nuevo en el proveedor, la correlación se rompe silenciosamente y el evento reaparece como `NarrativeMoment` nuevo en vez de actualizar el thread -- mismo tipo de límite que Calendar/Gmail Foundation ya documentan para IDs externos.
- **`isFresh`/chapter `since` para etapas no terminales usa `updatedAt` como aproximación** de "cuándo cambió de verdad" -- honesto, documentado, mismo criterio que la aproximación de 48h de Continuity para "desenlace capturado", pero no es un historial real de transiciones (Narrative no lo persiste, por diseño).
- **Sin verificación contra Postgres real** -- este módulo no toca persistencia (no hay tabla que verificar), así que la validación es 100% escenarios sintéticos deterministas + `tsc`/`eslint`/`next build`, mismo punto en el que quedaron `features/experience/`/`features/presence/` (ninguno de los dos toca DB directamente tampoco).

## Extensiones futuras (máximo 5)

1. **Wiring real de `integrations/`** hacia Presence (mostrar `currentActiveStory` en el saludo), Conversation Strategy (que el chat sepa en qué historia está la persona), y una futura pantalla `/life` que muestre `openStories`/`recentlyClosedStories`.
2. **Re-evaluar `approaching_deadline` contra la fecha real** pasando `overdue`/`upcoming` a `build-threads-from-loops.ts`, cerrando el límite documentado arriba.
3. **Un futuro Notification Layer** consumiendo `toNotificationCandidate` en cuanto esa capa de producto exista.
4. **`NarrativeContinuation` con más de un `kind` simultáneo** para historias donde aplican dos cosas a la vez (p. ej. `prepare` + `check_in`) -- hoy elige solo la razón más específica; si un consumidor real necesita ambas, el lookup tendría que dejar de ser 1:1.
5. **Ventana de proximidad de calendario configurable** (`CALENDAR_PROXIMITY_WINDOW_HOURS`, hoy fija en 48h) si el uso real muestra que 48h es demasiado corto/largo para ciertos tipos de historia.
