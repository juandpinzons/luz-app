# Continuity System

Misión: "Continuity System Foundation" -- LUZ recuerda, recomienda, entiende. No cerraba ciclos: un momento importante (una entrevista, un cumpleaños, una promesa) aparecía una vez y desaparecía, sin que nada lo mantuviera vivo hasta un desenlace real. Este módulo es esa capa transversal: **no gestión de tareas, continuidad de vida**.

No es un `core/*-engine` más aislado -- es explícitamente transversal, puede originarse en Memory, Calendar, Gmail, Goal, Project, Habit, Relationship, Curiosity, Recommendation, Conversation, Life Event o Belief, y expone contratos hacia Experience/Presence/Daily Reflection/Morning Brief/Dashboard/una futura capa de Notificaciones. **No redefine ninguno de esos módulos** -- los consume por sus contratos públicos ya existentes, sin tocar una sola línea de ellos (verificado: cero archivos de Memory/Knowledge/Reality/Experience/Curiosity modificados en esta misión).

## Por qué dos módulos, no uno

```
core/continuity-engine/        <- dominio, ciclo de vida, persistencia, reglas de fuentes core/
  domain/                         (Memory, Goal, Project, Relationship, Curiosity)
  repositories/
  lifecycle/
  detection/
  resolution/
  scheduling/

features/continuity/           <- adaptador para fuentes features/ + contratos de producto
  detection/                      (Calendar, Gmail, Recommendation)
  resolution/
  integrations/                   (Experience/Presence/Daily Reflection/Morning Brief/Dashboard/Notification)
```

`core/` nunca depende de `features/` -- regla ya vigente en todo el repo (Reality Snapshot, Context Engine, etc.), y explícita en este módulo (`domain/loop-priority.ts`). Calendar Foundation y Gmail Foundation viven en `features/reality/`; `FollowUpRecommendation` vive en `features/dashboard/`. Un Continuity System que de verdad consume esas fuentes no puede vivir enteramente en `core/` sin violar esa dirección de dependencia -- así que el dominio/ciclo de vida/persistencia (que solo necesitan Memory/Goal/Project/Relationship/Curiosity, todos `core/`) se quedan en `core/continuity-engine/`, y el resto (Calendar/Gmail/Recommendation + los contratos de integración de producto) vive en `features/continuity/`, que consume `core/continuity-engine/` igual que cualquier otro `features/*`.

## Dominio

Ports & Adapters, DDD, mismo patrón que cada `core/*-engine` (`belief-engine`, `curiosity-engine`, ...): `domain/` son formas puras, `repositories/` es el puerto de persistencia + su implementación Drizzle, `lifecycle/`/`detection/`/`resolution/`/`scheduling/` son casos de uso puros sin I/O.

- **`ContinuityLoop`**: el aggregate root -- un asunto real que LUZ decidió mantener vivo.
- **`LoopTrigger`**: `{origin, reason, sourceId, detectedAt, summary}` -- el hecho concreto que lo originó, siempre trazable.
- **`LoopState`**: el ciclo de vida (ver abajo).
- **`LoopPriority`**: `low|medium|high|critical` -- misma escala que `RecommendationPriority`/`PresenceUrgencyLevel`, reutilizada a propósito.
- **`LoopEvidence`**: una pieza de evidencia real, nunca inventada -- `kind` + `description` + `observedAt` + `sourceId?`.
- **`LoopResolution`**: presente únicamente en estados terminales -- `{state, resolvedAt, evidence, outcome?, transformedIntoLoopId?}`.
- **`LoopOutcome`**: el desenlace real, solo con `state === "resolved"` -- `positive|negative|neutral|unknown` (`"unknown"` es un valor real, no un placeholder: hay evidencia de que algo terminó, no de si salió bien).
- **`LoopRelatedEntity`**: `{kind, id, title}` -- mismo criterio que `DashboardEntityReference`/`ObservationEntityRef` (`features/dashboard/`), nunca un objeto completo duplicado.
- **`LoopTransitionRecord`**: una fila del historial persistido -- el dominio NUNCA embebe su propio historial en `ContinuityLoop` (mismo principio que `Belief`/`belief_history`: el historial vive siempre aparte, se consulta bajo demanda vía `getHistory()`).

## Ciclo de vida

```
                    ┌─────────┐
        (detección) │  open   │
                     └────┬────┘
                          │
          ┌───────────────┼────────────────────────┐
          ▼               ▼                        ▼
     ┌─────────┐    ┌───────────┐            (terminal directo,
     │ waiting │───▶│ follow_up │◀───┐         evidencia ya
     └────┬────┘    └─────┬─────┘    │         disponible al abrir)
          │                │         │
          │  (cooldown/    │ (nueva  │
          │   fecha ancla  │  espera,│
          │   cumplida)    │  evidencia
          │                │  insuficiente)
          └────────────────┘
                          │
        ┌─────────┬───────┼────────┬─────────────┐
        ▼         ▼       ▼        ▼             ▼
   resolved  archived  abandoned  transformed   (todos TERMINALES,
                                                  ninguna transición sale)
```

- **`open`**: recién detectado, sin seguimiento todavía. Único estado inicial.
- **`waiting`**: hay una `nextFollowUpAt` real, todavía no alcanzada.
- **`follow_up`**: la fecha se cumplió (o nunca hizo falta esperar) -- elegible para resurfacear AHORA.
- **`resolved`** (terminal): cerrado CON un `LoopOutcome` real.
- **`archived`** (terminal): cerrado SIN desenlace explícito -- decisión del propio sistema (superado, timeout), nunca implica éxito ni fracaso.
- **`abandoned`** (terminal): cerrado por señal humana explícita.
- **`transformed`** (terminal): el asunto se convirtió en otro loop rastreable -- `resolution.transformedIntoLoopId` señala hacia dónde, la trazabilidad nunca se pierde.

**Cada transición exige evidencia real** -- `transitionLoop()` (`lifecycle/transition-loop.ts`) es el ÚNICO código que decide si una transición es válida (tabla `LOOP_ALLOWED_TRANSITIONS`) y la aplica; lanza si falta evidencia, si `toState === "resolved"` sin `LoopOutcome`, si `toState === "transformed"` sin `transformedIntoLoopId`, o si `toState === "waiting"` sin `nextFollowUpAt`. Un loop cerrado NUNCA vuelve a abrirse -- si el mismo asunto reaparece de verdad, una regla de apertura crea un loop nuevo.

## Reglas de apertura (deterministas, sin IA)

| Origen | Función | Condición | Razón (`LoopReason`) | Prioridad |
|---|---|---|---|---|
| Memory | `detectFromMemory` | `type === "intention"` | `explicit_intention` | medium |
| Memory | `detectFromMemory` | `type === "event"` | `significant_life_event` | medium |
| Calendar | `detectFromCalendarEvent` | evento futuro, con asistentes | `important_meeting` | high |
| Calendar | `detectFromCalendarEvent` | evento futuro, sin asistentes | `future_commitment` | medium |
| Gmail | `detectFromEmailSnapshot` | mensaje en `waitingReply` | `awaiting_my_reply` | medium |
| Gmail | `detectFromEmailSnapshot` | mensaje `important` y `unread` | `unread_important_email` | high |
| Goal | `detectGoalDeadline` | `active`, `targetDate` ≤14 días | `deadline` | high si ≤3 días, si no medium |
| Project | `detectProjectDeadline` | `active`/`planning`, `dueDate` ≤14 días | `deadline` | high si ≤3 días, si no medium |
| Relationship | `detectRelationshipMilestone` | hoy = aniversario de `since` (≥1 año) | `relationship_milestone` | medium |
| Curiosity | `detectFromCuriosityQuestion` | `status === "pending"` | `question_pending_answer` | low |
| Recommendation | `detectFromRecommendation` | `priority` high/critical, no celebración | `recommendation_pending` | (heredada de la recomendación) |

Cada regla se apoya en un campo YA calculado de forma determinista por su propio módulo de origen (`MemoryType` de `DeterministicMemoryClassifier`, `EmailSnapshot.waitingReply`/`important` de Gmail Foundation, `RecommendationPriority` de Dashboard) -- Continuity nunca reinterpreta contenido ni llama IA por su cuenta.

**Orígenes con placeholder, sin regla real todavía** (documentado, no un olvido): `habit` (sin señal de "tiempo desde el último check-in" en el modelo actual de `Habit`) y `belief` (mission: "when appropriate" -- ninguna señal determinista clara sin invadir el trabajo de Curiosity Engine). `conversation`/`life_event` se cubren indirectamente vía Memory (`core/life`'s propio `LifeEvent` no tiene persistencia real todavía, verificado contra código -- ver docblock de `detect-from-memory.ts`).

## Reglas de cierre (deterministas, evidencia obligatoria)

| Evidencia | Función | Cierra en |
|---|---|---|
| Goal/Project completado | `detectGoalClosure`/`detectProjectClosure` | `resolved` (outcome positivo) |
| Goal abandonado / Project cancelado | `detectGoalClosure`/`detectProjectClosure` | `abandoned` |
| Relationship actualizada tras el aniversario | `detectRelationshipClosure` | `resolved` (outcome positivo) |
| Memory original ya no `active` | `detectMemoryClosure` | `archived` (nunca `resolved` -- no confirma desenlace) |
| CuriosityQuestion resuelta / descartada | `detectCuriosityClosure` | `resolved` / `abandoned` |
| Mensaje ya no `waitingReply`/`unread important` | `detectEmailClosure` | `resolved` |
| Evento de calendario terminado + memoria posterior (≤48h) | `detectCalendarEventClosure` | `resolved` (outcome `unknown`, honesto: hay señal de que algo se registró, no de si salió bien) |
| Evento de calendario terminado, SIN memoria posterior | `detectCalendarEventClosure` | no cierra -- mueve a `follow_up` vía `calendarEventPassedEvidence` |
| Explícito de la persona | `abandonLoopExplicitly` | `abandoned` -- nunca auto-detectado, contrato puro para un consumidor futuro |
| `followUpAttempts ≥ 5` o antigüedad ≥90 días | `detectTimeoutExceeded` | `archived` -- único fallback, siempre el ÚLTIMO en evaluarse |

`evaluateLoopClosure`/`evaluateAllLoopClosure` prueban las reglas en orden y devuelven la PRIMERA evidencia real que aplique -- `timeout_exceeded` nunca gana sobre una evidencia concreta.

## Seguimiento (scheduling)

`scheduleNextFollowUp`: sin aleatoriedad, con cooldown obligatorio (misión: "No random scheduling. No spam. Cooldowns must exist."):

1. Si hay `anchorDate` real y futura (la hora de un `CalendarEvent`, `Goal.targetDate`...) -- **Calendar decide el momento** directamente, sin importar el cooldown genérico.
2. Si no, cooldown por `priority` (`critical` 4h, `high` 24h, `medium` 72h, `low` 168h) multiplicado por un backoff según `followUpAttempts` (tope 4x) -- **cada intento sin resolverse espacia más el siguiente**.

`priority` ya resume la urgencia de Experience Intelligence al momento de crear/actualizar el loop -- este scheduler nunca vuelve a leer `PresenceUrgencyLevel` directamente (mantiene `core/` sin depender de `features/`).

`requestCuriosityEvidence`: tras ≥2 intentos de seguimiento sin evidencia real, produce una solicitud estructurada (`{loopId, rationale}`) -- puramente un contrato de datos, nunca construye ni persiste una `CuriosityQuestion` por su cuenta.

## Persistencia -- decisiones de schema

Dos tablas nuevas, `continuity_loops` + `continuity_loop_history` -- justificadas porque **nada existente persiste un ciclo de vida con estado + evidencia histórica cross-fuente**: `events` es un log de auditoría de un solo tiro (nunca se consulta "qué está abierto ahora"); `ExperienceCard`/`FollowUpRecommendation` se RECALCULAN en cada carga, sin memoria propia entre visitas (exactamente el vacío que esta misión pide cerrar); `curiosity_questions` es de un solo propósito. Mismo patrón estructural que `beliefs`/`belief_history` (el precedente más cercano: un aggregate que evoluciona con evidencia a través del tiempo necesita su propio historial append-only).

- **`origin`/`reason`/`state`/`priority` son `text().$type<X>()`, nunca `pgEnum`** -- mismo criterio ya adoptado por `calendar_connections` (la tabla más reciente de este patrón en el repo, no `belief_status`/`curiosity_question_status`, de una fase anterior): la validación real vive en la capa de dominio, nunca en una constraint de Postgres. La misión describe el vocabulario de estados como un ejemplo explícitamente adaptable -- `pgEnum` exigiría una migración `ALTER TYPE` para cualquier ajuste futuro.
- **`relatedEntities` es `jsonb`** -- mismo criterio que `users.metadata`: un arreglo pequeño y acotado (nunca una colección que crece sin límite), no amerita una tabla de unión propia.
- **La evidencia de cierre se duplica en `continuity_loops` (`resolutionEvidence*`) además de en `continuity_loop_history`** -- decisión consciente: "¿por qué está cerrado esto?" es una pregunta que casi cualquier consumidor de un loop resuelto hace; exigir un join contra el historial completo solo para responderla pagaría el caso común para servir el raro. `getHistory()` sigue disponible para la traza completa.
- **`transformedIntoLoopId` es un `uuid` plano, sin `references()`** -- mismo criterio que `belief_evidence.insightId`/`memoryId`: integridad referencial es responsabilidad del dominio (`transitionLoop` ya la exige), un ciclo de FK autorreferenciado añadiría complejidad real para un campo `NULL` en el 100% de las filas salvo el caso raro `transformed`.
- Índices: `(life_graph_id)`, `(life_graph_id, state)` (la consulta "qué está abierto ahora" que cualquier consumidor hace en cada visita), `(life_graph_id, next_follow_up_at)` (el "reloj" de Continuity).

Repositorio (`ContinuityLoopRepository`/`DrizzleContinuityLoopRepository`): mismo contrato que `BeliefRepository` -- `getById`/`list`/`listByState`/`listDueForFollowUp`/`save` (upsert, rechaza un `lifeGraphId` que no coincide con el contexto, nunca lo corrige en silencio) + `getHistory`/`appendTransition` para el historial aparte.

## Integraciones -- contratos, sin wiring profundo

`features/continuity/integrations/` -- ninguna de estas funciones se llama hoy desde Experience/Presence/Dashboard/etc. (cero import en ese sentido, verificado). Cada una es lo mínimo que un futuro consumidor necesitaría:

- **Experience Intelligence**: `toExperienceCard(loop) -> ExperienceCard` (tipo público real de `features/experience/`, reutilizado tal cual).
- **Presence**: `toPresenceSignals(loops) -> ContinuityPresenceSignal[]` (tipo propio -- forzar la forma exacta de `PresenceFocusItem` habría inventado una `LifeObservation` que nunca existió).
- **Daily Reflection**: `buildDailyReflectionPrompts(loopsInFollowUp)` -- superficie de producto que todavía no existe en el repo, contrato puramente prospectivo.
- **Morning Brief**: `buildMorningBriefItems(loops)` -- datos crudos, nunca prosa: `build-morning-brief.ts` sigue siendo el único lugar que llama IA.
- **Dashboard**: `toDashboardEntityReferences(loop) -> DashboardEntityReference[]` (tipo público real, reutilizado).
- **Notification Layer**: `toNotificationCandidates(loopsInFollowUp)` -- capa que tampoco existe todavía; solo `high`/`critical` en `follow_up` califican, deliberadamente más conservador que Daily Reflection (una notificación interrumpe activamente).

## Consideraciones y límites reales

- **Sin verificación contra producción/Postgres real de un usuario vivo** -- verificado contra Postgres LOCAL real (migración aplicada, escenarios sintéticos con round-trip real, ver `.scratch/verify-continuity-engine.ts`), mismo punto en el que Gmail Foundation quedó tras su propia fase de fundación.
- **`detectCalendarEventClosure` exige que el llamador traiga el `CalendarEvent` específico** -- `CalendarSnapshot.today`/`upcoming` son ventanas hacia ADELANTE (Calendar Foundation), un evento ya pasado hace días no aparece ahí; el llamador debe usar la lista completa de eventos conocidos (`RefreshCalendarResult.events`), documentado en el propio archivo.
- **La "captura de desenlace" de un evento de calendario es una aproximación honesta, no contenido entendido** -- cualquier `Memory` nueva dentro de 48h después del evento cuenta como evidencia de que "algo se registró", nunca de que ese algo describe ESE evento en particular (no hay forma determinista, sin IA, de confirmarlo). Mismo tipo de límite ya documentado en otras partes del repo (recuperación contextual sin embeddings).
- **`habit`/`belief` no tienen regla de apertura real todavía** -- placeholders honestos en el vocabulario, no silencio (ver tabla de reglas de apertura).
- **`core/life`'s propio `LifeEvent` no tiene persistencia real** -- confirmado contra código, no asumido; el origen `life_event` de la misión se sirve hoy vía `Memory.type === "event"`.
