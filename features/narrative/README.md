# Living Narrative Foundation

Misión: "Living Narrative Foundation" -- hasta ahora LUZ recuerda hechos, recomienda acciones, cierra ciclos, pero cada visita se trataba como una interacción aislada. `buildNarrativeState` responde una sola pregunta: **de todo lo que Memory, Knowledge, Reality, Experience y Continuity ya decidieron, ¿qué historia está activa, en qué capítulo, qué cambió desde la última visita, y qué merece continuación, celebración o silencio?**

Sin IA, sin aleatoriedad, sin repositorio de dominio propio, sin tabla nueva. Vive en `features/`, no en `core/` -- mismo criterio que `features/home/`, `features/experience/` y `features/presence/` (ver ADR-0018). Es orquestación, no inteligencia: cada decisión que toma ya la tomó otro módulo primero (Continuity decidió qué asunto rastrear, Experience decidió qué cambió, Home/Presence decidieron qué merece el foco de la persona) -- Narrative solo traduce esas decisiones a vocabulario de historia y las ordena.

## V2 -- por qué existe esta revisión

La primera versión (V1) era técnicamente correcta y estructuralmente incompleta: procesaba los `ContinuityLoop` de una sola visita, sin memoria de ninguna otra. Cada asunto era una isla -- un loop de febrero y otro de julio sobre la MISMA meta real nunca se reconocían como la misma historia. Esa era la brecha real detrás de "connect events months apart", "how does it recover after failure" y "how does it revisit forgotten things": ninguna se puede responder sin ver más allá de la visita de hoy.

V2 introduce **`NarrativeArc`**: un cúmulo determinista de capítulos (pasados y presentes) que comparten una entidad real, más tres mecanismos que solo existen a nivel de arco -- recuperación tras un revés, eco temporal, y silencio deliberado por repetición. Nada de esto reemplaza V1; todo lo construido en V1 (capítulos, razones, momentos, ranking base) sigue siendo el cimiento -- Arc es una capa que lo agrupa a través del tiempo, no un rediseño desde cero.

## Filosofía

**LUZ no recuerda hechos. LUZ recuerda haber estado presente.** La unidad de narrativa no es un `ContinuityLoop` ni una sola visita -- es el hilo que sobrevive a los huecos entre visitas. Continuity ya prueba que cada capítulo es real; el trabajo de Narrative es probar que varios capítulos, vistos en momentos distintos, son la MISMA historia.

**El silencio es una capacidad narrativa, no una ausencia de decisión.** V1 trataba el silencio como "nada calificó". V2 lo hace explícito: una historia real puede calificar y aun así elegirse no decirla, porque repetirla se sentiría como insistencia. Esa elección queda registrada (`silencedCandidate`), nunca es un `null` mudo.

**El tiempo mismo es evidencia.** Una fecha que se repite es tan real como un evento que se repite -- no hace falta que pase algo hoy para que hoy importe.

## Principios

1. **A story can never exist without evidence.** Ningún thread, arco o continuación se construye sin un `ContinuityLoop`, evento o fecha real.
2. **Every important beginning deserves acknowledgment or honest release -- never silent abandonment.**
3. **Silence is an intentional narrative action, not an absence of one.**
4. **Celebration is part of continuity, not a feature bolted on.**
5. **Never ask twice if the answer already exists.** Narrative solo refleja el estado que Continuity ya decidió, nunca lo vuelve a preguntar.
6. **A story that repeats itself across time is more meaningful than any single chapter alone.** (Justifica `NarrativeArc`.)
7. **Returning after a setback is not a new story -- it's the same story, continuing.** (Justifica `recovering`/`welcome_back`.)
8. **Time itself is evidence.** (Justifica `NarrativeEcho`.)
9. **Importance earns repetition; routine does not.** (Justifica el silencio por prioridad, `services/select-primary-narrative.ts`.)
10. **LUZ narrates outcomes it can prove, never outcomes it hopes for.** `unknown` se queda `unknown`, nunca se redondea a positivo.
11. **A forgotten thing isn't a failed thing.** `dormantArcs` nunca se presenta como fracaso.
12. **The story belongs to the person, not to LUZ.** Narrative nunca decide un final -- solo reconoce uno que Continuity ya alcanzó.

## Estructura

```
narrative/
  domain/          NarrativeState y sus tipos (el contrato)
  services/         derivación de capítulo, arcos, eco, ranking, momentos, silencio
  application/      buildNarrativeState -- el único punto de entrada público
  integrations/      contratos hacia Presence/Conversation/Morning Brief/Dashboard/Notification -- sin wiring
  tests/            fixtures.ts + script standalone con los escenarios de la misión + los 5 mecanismos de V2
```

## Por qué esto no es otro motor de decisión

Igual que Home/Experience/Presence, esto es un agregador de solo lectura sobre datos que otros módulos ya calcularon. No inventa una fuente de datos nueva, no llama IA, no decide nada que Continuity/Experience/Dashboard no hubieran decidido primero -- solo decide **cómo se ve, en conjunto, la vida de la persona como una historia continua**. Ningún archivo de Memory/Knowledge/Reality/Experience/Continuity se modificó para esta misión (verificado: cero import cruzado en ese sentido) -- todo se consume por contrato público ya existente.

## Relación con las fuentes permitidas

```
ContinuityLoop[] (ventana COMPLETA, no solo abiertos) ─┬─────────────────┐
                                        ▼                              │
                            buildThreadsFromLoops → NarrativeThread[]  │
                                        │                              │
HomeState (+Presence passthrough) ─────┤                              ▼
CalendarSnapshot ───────────────────────┤                    buildArcs → NarrativeArc[]
FollowUpRecommendation[] (completo) ───┤                              │
LifeDashboardSnapshot.overdue ─────────┤                              ▼
EmailSnapshot ──────────────────────────┴──→ buildMoments   selectPrimaryNarrative (+ silencio)
ExperienceState.whatChanged ────────────────────────────────────────→ recentChanges (passthrough)
RealitySnapshot (aceptado, uso mínimo, ver abajo)
recentlyNarratedThreadIds (opcional, alimenta el silencio)
                                        │
                                        ▼
                                 buildNarrativeState → NarrativeState
```

`buildNarrativeState` (`application/build-narrative-state.ts`) recibe los nueve tipos de entrada que la misión permite, más `recentlyNarratedThreadIds` (opcional, mismo rol que `recentPrimaryKeys` en `buildExperienceState`). `PresenceState` no se recibe aparte: `HomeState` ya lo incluye por passthrough exacto. La única diferencia de completitud respecto a V1: `loops` ahora es la ventana COMPLETA de un lifeGraph (resueltos/archivados/abandonados incluidos), no solo los abiertos -- sin eso, `NarrativeArc` nunca podría conectar capítulos meses aparte.

## Dominio

- **`NarrativeThread`**: un capítulo real -- **1:1 con un `ContinuityLoop` real, siempre**. Un `ContinuityLoop` ya ES "un asunto real que LUZ decidió mantener vivo hasta un desenlace real", que es exactamente la definición de un capítulo. Narrative nunca sintetiza un thread a partir de otra cosa.
- **`NarrativeArc`** (nuevo en V2): un cúmulo de `NarrativeThread` (capítulos, pasados Y presentes) que comparten una `NarrativeRelatedEntity` real -- la respuesta a "connect events months apart". Agrupado por la PRIMERA entidad relacionada de cada thread (`arcKey`), no por cierre transitivo completo -- simplificación deliberada y documentada, correcta para el caso dominante (cada regla de detección de Continuity ya anota una única entidad principal por loop). Tiene `state` (`active|recovering|dormant|concluded`), `chapters` (cronológico), `current` (el más reciente), `isReturningAfterSetback`, `echo`, `score`, `priority`.
- **`NarrativeMoment`**: algo real que vale la pena notar HOY sin (todavía) tener su propio thread. Nunca tiene capítulo ni arco propio.
- **`NarrativeChapter`**: `{ stage: NarrativeProgression, since: Date }`.
- **`NarrativeProgression`**: `beginning | developing | waiting | turning_point | resolution | reflection | archived` (nivel de capítulo).
- **`NarrativeArcState`** (nuevo): `active | recovering | dormant | concluded` (nivel de arco -- mira la historia completa, no solo el capítulo de hoy).
- **`NarrativeEcho`** (nuevo): `{ sourceThreadId, intervalMonths }` -- un capítulo pasado del mismo arco cuya fecha coincide con hoy.
- **`NarrativePriority`**: misma escala `low | medium | high | critical` que `LoopPriority`/`PresenceUrgencyLevel`/`RecommendationPriority`.
- **`NarrativeReason`**: por qué un capítulo/momento merece atención ahora -- 13 valores cerrados, cada uno 1:1 a una condición real. Campo de explicabilidad obligatorio.
- **`NarrativeSilenceDecision`** (nuevo): `{ arc, reason }` -- registro explícito de una elección de silencio, nunca un `null` mudo.
- **`NarrativeContinuation`**: `{ arcKey, threadId, kind, reason, title, summary, echo? }` -- CÓMO retomar la historia activa. `kind` ahora incluye `welcome_back`/`echo` además de `resume|check_in|celebrate|reflect|prepare|release`, evaluados ANTES que el resto (ver `services/build-continuation.ts`).

Cada tipo, campo y su procedencia exacta está documentado en el JSDoc de `domain/*.ts` -- este README es el resumen, esa es la fuente de verdad.

## Ciclo de vida de un capítulo

`services/build-threads-from-loops.ts` (`deriveChapter`) deriva la etapa **EXCLUSIVAMENTE** de `ContinuityLoop.state` + sus timestamps -- nunca de contenido:

| Etapa | Condición exacta |
|---|---|
| `beginning` | `state === "open"`, detectado hace menos de `BEGINNING_WINDOW_DAYS` (3) días |
| `developing` | `state === "open"`, detectado hace 3 días o más |
| `waiting` | `state === "waiting"` |
| `turning_point` | `state === "follow_up"` -- el momento programado para resurfacear ya se cumplió |
| `resolution` | `state === "resolved"`, cerrado hace menos de `RESOLUTION_FRESH_DAYS` (3) días |
| `reflection` | cualquier estado terminal, cerrado hace menos de `REFLECTION_WINDOW_DAYS` (14) días |
| `archived` | cualquier estado terminal, cerrado hace 14 días o más |

## Ciclo de vida de un arco (V2)

`services/build-arcs.ts` agrupa capítulos por `arcKey` y ordena cronológicamente. El `current` (más reciente) decide el estado del arco:

| Estado | Condición exacta |
|---|---|
| `active` | capítulo actual no terminal, ningún capítulo ANTERIOR del mismo arco `endedAsSetback` |
| `recovering` | capítulo actual no terminal, Y algún capítulo anterior sí `endedAsSetback` (`state === "resolved"` con `outcome.kind !== "positive"`, o `state === "abandoned"` -- deliberadamente NO `archived`/`transformed`, ver docblock de `NarrativeThread.endedAsSetback`) |
| `dormant` | capítulo actual terminal `archived` |
| `concluded` | capítulo actual terminal `resolution`/`reflection` |

`isReturningAfterSetback = (state === "recovering")`, expuesto aparte para que un consumidor no compare contra el enum.

**Eco temporal** (`services/compute-echo.ts`): recorre los capítulos PASADOS (nunca el actual) buscando uno cuya fecha (`chapter.since`, mes+día, ±1 día de tolerancia) coincida con hoy, con al menos 60 días reales de por medio. Si varios coinciden, gana el más antiguo. Pura aritmética de fechas, cero fuente nueva.

Solo un arco se convierte en `currentActiveStory` (`services/select-primary-narrative.ts`) -- mayor score, capítulo actual ≠ `archived`.

## Ranking determinístico -- cada peso documentado

`services/narrative-score.ts` calcula un score 0-4 (misma escala que `ExperienceCard.importance`). Base = prioridad ya decidida por Continuity/Dashboard/Gmail; **cuatro** grupos de modificadores, cada uno **+1 como máximo**:

| Grupo | Nivel | Señales que agrupa | Se activa cuando... |
|---|---|---|---|
| **Momentum** | capítulo | freshness, continuity, follow-up urgency | el reloj que Continuity programó ya se cumplió, o cambió de verdad hace poco Y ya tiene trayectoria real de seguimiento |
| **External pull** | capítulo | calendar proximity, user attention, emotional weight | hay un ancla real dentro de ±48h, o Presence/Home ya decidieron que esta entidad merece el foco de la persona, o su categoría ya clasificada trae un peso fijo más alto |
| **Longevity** | capítulo | story age | no terminal, 30+ días sin resolverse (`STALLED_THRESHOLD_DAYS`, reusado de `features/dashboard/`) |
| **Arc resonance** (V2) | arco | recuperación tras un revés, o eco temporal | `arc.isReturningAfterSetback \|\| arc.echo !== null` -- aplicado DESPUÉS del score del capítulo (`applyArcResonance`), porque estos dos hechos solo existen una vez agrupados los capítulos |

`celebration value` es un **piso** (`CELEBRATION_SCORE_FLOOR = 2`), nunca un bono. `emotional weight` es un lookup ESTÁTICO por categoría ya clasificada (`LoopReason === "relationship_milestone"`/`"significant_life_event"`) -- nunca una lectura de contenido ni una afirmación sobre cómo se siente la persona.

## Silencio deliberado (V2)

`services/select-primary-narrative.ts` recorre los arcos ordenados por score; un arco se **silencia** cuando TODO lo siguiente es cierto:

1. prioridad `low`/`medium` (nunca `high`/`critical` -- Principio 9)
2. razón "de rutina" (`continuing_open_story`, `waiting_quietly`, `long_running_unresolved`, `worth_reflecting_on`, `recently_resolved`, `fading_without_evidence` -- nunca un aniversario, una fecha próxima, un seguimiento cumplido o una celebración)
3. su capítulo actual ya aparece entre las últimas 3 entradas de `recentlyNarratedThreadIds`
4. `!isReturningAfterSetback && echo === null` -- un regreso real o un eco real SIEMPRE se dicen, nunca se silencian por repetición

Solo la PRIMERA candidata silenciada queda registrada en `silencedCandidate`; la búsqueda de `currentActiveStory` continúa con la siguiente candidata real -- silenciar un arco nunca implica silenciar toda la visita.

## Momentos y correlación con capítulos

`services/build-moments.ts` construye `NarrativeMoment[]` desde cuatro fuentes (recomendaciones sin loop propio, `LifeDashboardSnapshot.overdue`, `HomeState.calendar.meetingMoments`, `EmailSnapshot`) -- cada una se correlaciona primero contra `loops` por **`trigger.origin` + `trigger.sourceId` exactos**. Si ya existe un thread no-terminal para esa fuente, el momento NUNCA se crea.

## `NarrativeState`

| Campo | Nivel | Regla |
|---|---|---|
| `currentActiveStory` | arco | mayor score, capítulo actual ≠ `archived`, no silenciado |
| `silencedCandidate` | arco | la primera candidata elegible que se silenció, o `null` |
| `continuation` | arco | `welcome_back`/`echo` si aplican, si no lookup fijo desde `current.reason` |
| `recentChanges` | -- | passthrough exacto de `ExperienceState.whatChanged` |
| `openStories` | capítulo | capítulo en `beginning\|developing\|waiting\|turning_point` |
| `recentlyClosedStories` | capítulo | capítulo en `resolution\|reflection` |
| `celebrationCandidates` | capítulo+momento | `reason === "celebration_moment"` |
| `longRunningStories` | capítulo | `isLongRunning` |
| `storiesReadyForReflection` | capítulo | capítulo `reflection` |
| `storiesReadyForFollowUp` | capítulo | capítulo `turning_point` |
| `storiesReadyToBeForgotten` | capítulo | `isFadingWithoutEvidence` |
| `storiesWaitingQuietly` | capítulo | capítulo `waiting` |
| `recurringArcs` | arco | `chapters.length >= 2` |
| `dormantArcs` | arco | `state === "dormant"` |

Cada arreglo de nivel "capítulo" es un FILTRO sobre el mismo pool de `NarrativeThread[]` -- las categorías se solapan a propósito (mismo criterio ya documentado en `features/home/README.md`).

## Por qué `RealitySnapshot` no se usa a fondo

Se acepta como parámetro opcional pero deliberadamente no se minan sus campos ricos (`contradictions`/`curiosity`/`life`) -- ya están representados, de forma más completa, por `ContinuityLoop`/`LifeDashboardSnapshot`. `signals` (`ExternalSignalSnapshot`) es un placeholder permanentemente vacío hoy. Minarlos aparte arriesgaría la "lógica de ranking duplicada" que Home/Experience/Presence ya advierten evitar.

## Integraciones -- contratos, sin wiring profundo

Ningún llamador real hoy (cero import cruzado, verificado):

- **Presence**: `toPresenceContinuitySignal(currentActiveStory) -> NarrativePresenceSignal | null` -- incluye `isReturningAfterSetback`/`hasEcho`.
- **Conversation**: `toConversationContext(state) -> NarrativeConversationContext` -- datos crudos, nunca una frase.
- **Morning Brief**: `toMorningBriefContext(state) -> NarrativeMorningBriefContext` -- incluye `primaryIsReturningAfterSetback`/`primaryEcho`/`dormantArcTitles`; `build-morning-brief.ts` sigue siendo el único lugar que llama a un `AIProvider`.
- **Dashboard**: `toDashboardEntityReferences(thread) -> DashboardEntityReference[]`.
- **Notification Layer**: `toNotificationCandidate(state) -> NarrativeNotificationCandidate | null` -- solo `high`/`critical`; respeta `silencedCandidate` (nunca fuerza una notificación sobre algo que Narrative ya decidió callar).

## Cómo se cumple cada regla de la misión

- **Never invent events**: todo thread es 1:1 con un `ContinuityLoop` real; todo arco es una agrupación de threads reales; todo momento correlaciona antes de existir.
- **Never fabricate progress**: capítulo y estado de arco derivan solo de `state`/`outcome` reales.
- **Never infer emotional state**: `hasFixedEmotionalWeight` es un lookup estático; `NarrativeArcState` describe desenlaces (`endedAsSetback`), nunca sentimientos.
- **Never duplicate Memory**: solo referencias (`relatedEntities`), nunca contenido copiado.
- **Never reopen closed Continuity Loops**: Narrative es de solo lectura de punta a punta -- ningún archivo importa `transitionLoop`.
- **No LLM reasoning**: cero import de IA en todo el módulo.
- **No UI, no routes, no chat, no pages**: correcto.

## Escenarios sintéticos

```bash
npx tsx features/narrative/tests/build-narrative-state.examples.ts
```

Los ocho de la misión original, más los cinco mecanismos de V2:

| Escenario | Qué verifica |
|---|---|
| Job interview | `calendar`/`important_meeting`, `beginning`, bono de proximidad, gana `currentActiveStory` |
| Birthday | `relationship_milestone` hoy, continuación `celebrate` |
| Long-term goal | 45 días abierta -- `developing`, `long_running_unresolved` |
| Relationship recovery (follow-up) | `follow_up` con 4 intentos -- `turning_point` Y `storiesReadyToBeForgotten` a la vez |
| Medical treatment | `waiting`, peso emocional fijo |
| Project completion | desenlace positivo -- `resolution`, `celebration_moment`, referencia en `celebrationCandidates` |
| Career change | misma razón que long-term goal, recién detectada -- prueba que la EDAD decide el capítulo |
| Vacation planning | evento lejano (480h) pierde contra uno cercano (5h) por el bono de proximidad |
| **Arco recurrente** | dos capítulos, orígenes distintos, meses aparte, misma meta -- conecta a través del tiempo |
| **Recuperación tras un revés** | intento anterior `negative` + nuevo capítulo -- `recovering`, `welcome_back`, nunca tratado como historia nueva |
| **Eco temporal** | capítulo de hace exactamente un año, mismo mes+día -- `echo`, `intervalMonths === 12` |
| **Arco dormido** | capítulo `archived` viejo -- `dormantArcs`, excluido de `currentActiveStory` |
| **Silencio con excepción por prioridad** | rutina ya narrada cede el paso a otra historia real; prioridad `critical` nunca se silencia |

Más tres verificaciones estructurales: cuenta vacía, un `NarrativeMoment` nunca gana `currentActiveStory`, determinismo byte a byte.

## Límites y riesgos conocidos

- **`approaching_deadline` no revalida si la fecha ya pasó** (heredado de V1, sin cambios). Mitigado parcialmente por `LifeDashboardSnapshot.overdue` para vencidos sin thread propio, pero un thread YA existente no se autocorrige.
- **Clustering por PRIMERA entidad, no cierre transitivo completo.** Dos threads que comparten una entidad SECUNDARIA pero no la primera no se agrupan -- documentado como simplificación deliberada, correcta para el caso dominante (una entidad principal por loop), no para el caso general.
- **`endedAsSetback` es binario, sin matices.** Un desenlace `unknown` cuenta como revés exactamente igual que uno `negative` -- honesto (Principio 10: nunca inventar más certeza de la que hay), pero un consumidor que quiera distinguir "no funcionó" de "no se sabe si funcionó" necesitaría leer `LoopOutcome.kind` directamente, no solo `NarrativeArcState`.
- **El silencio es por-arco, no acumulativo entre arcos.** Si DOS arcos de rutina califican y ambos ya se narraron recientemente, solo el primero (el de mayor score) queda registrado en `silencedCandidate` -- el segundo simplemente nunca se evalúa como candidato una vez que algo real gana `currentActiveStory`.
- **Correlación depende de que `trigger.sourceId` siga siendo válido** (heredado de V1).
- **Sin verificación contra Postgres real** -- módulo sin persistencia propia, validación 100% escenarios sintéticos + `tsc`/`eslint`/`next build`.

## Extensiones futuras (máximo 5)

1. **Wiring real de `integrations/`** hacia Presence/Conversation/una futura pantalla `/life`.
2. **Re-evaluar `approaching_deadline` contra la fecha real** (límite heredado de V1).
3. **Clustering por cierre transitivo completo** de entidades relacionadas, no solo la primera, si el caso general resulta necesario en la práctica.
4. **Persistir `recentlyNarratedThreadIds` de verdad** -- hoy es un parámetro opcional sin productor real; un futuro evento en la tabla `events` (mismo patrón que `experience_card_shown`) lo alimentaría sin que Narrative posea la tabla.
5. **Ventana de proximidad de calendario configurable** (hoy fija en 48h).
