# War Room Audit — 2026-07-29

**Status:** Final (este documento de trabajo)\
**Rol:** Principal Engineer, auditoría adversarial (no implementación por defecto)\
**Autor:** sesión de Product Engineering, a pedido explícito del Founder\
**Para revisión de:** Lead Systems Engineer (M4) + Founder

------------------------------------------------------------------------

# Alcance y metodología

Mandato: demostrar que LUZ todavía puede romperse, sin asumir que ningún
commit previo (incluidos los de M4 durante esta misma sesión) es
correcto. Prioridad: Persistencia → Streaming → Memory Engine →
Knowledge Engine → Context Engine → Background jobs → PostgreSQL →
Observabilidad → Recuperación ante errores → Escalabilidad.

Cobertura:

- **Revisión directa, personal**, línea por línea, de los tres
  mecanismos de concurrencia más sensibles: desconexión de cliente en
  streaming SSE (`app/api/chat/route.ts`), el rate limiter con
  advisory lock (`features/chat/services/check-rate-limit.ts`), y el
  reclamo de Knowledge Jobs (`features/knowledge/services/process-knowledge-job.ts`).
- **Tres auditorías paralelas independientes**, cada una con acceso de
  solo lectura al repo completo: Memory Engine, Context
  Engine/RealitySnapshot, y un barrido de escalabilidad + código
  muerto en todo el repo.
- **Un análisis dedicado, consulta por consulta**, de cada query sin
  límite del ensamblador de `RealitySnapshot`, a pedido explícito del
  Founder — no se aplicó ningún límite genérico sin antes demostrar
  qué información obtiene, por qué está sin límite hoy, si puede
  limitarse sin cambiar el comportamiento, y con qué criterio.

Clasificación de riesgo: **CRÍTICO / ALTO / MEDIO / BAJO**, según pidió
el Founder — combina impacto y probabilidad real para un producto en
Alpha (~13 usuarios piloto) que necesita sobrevivir Beta (decenas a
cientos de usuarios).

Regla de implementación aplicada estrictamente: **solo se implementó
lo que es un cambio chico, de riesgo alto, que no modifica arquitectura
y que no invade trabajo de M4.** Todo lo demás queda documentado con
una recomendación concreta, nunca implementado a medias.

------------------------------------------------------------------------

# Resumen ejecutivo

Verificado, con evidencia y con los tres subsistemas de concurrencia
más sensibles del sistema: **el diseño de concurrencia de este producto
es, en su mayoría, sólido y deliberado** — mejor que la mediana de un
proyecto en esta etapa. El streaming, el rate limiting y el reclamo de
Knowledge Jobs ya usan los patrones correctos (advisory locks
transaccionales, `SELECT ... FOR UPDATE SKIP LOCKED` con lease,
banderas propias en vez de depender del estado interno del runtime).
Cero usos de `as any`/`@ts-ignore` en todo `core/`+`features/` — el
sistema de tipos está haciendo su trabajo de verdad.

El riesgo real no es corrupción de datos activa hoy. Es **degradación
silenciosa y creciente a medida que el historial de cada usuario se
acumula** — exactamente el perfil de riesgo que un producto cuya
propuesta de valor central es "recordarte a lo largo del tiempo"
garantiza que va a enfrentar, y antes de lo que parece:

1. **CRÍTICO** — El Knowledge Engine solo puede procesar 1-2 jobs por
   día en producción (límite de cron del plan Vercel Hobby + varias
   llamadas de IA secuenciales por job), mientras se genera
   aproximadamente un job por cada mensaje calificado, en toda la base
   de usuarios. El backlog crece sin freno desde el primer día de
   tráfico real — ya pasó una vez ("146 jobs pendientes, 0 insights,
   siempre", según el propio historial del código). Esto rompe en
   silencio la promesa central del producto ("LUZ te entiende con el
   tiempo") sin que nada truene. **Requiere decisión de infraestructura/arquitectura — no implementado.**
2. **ALTO** — Ninguna tabla del sistema tiene retención ni poda. No
   existe ninguna ruta `DELETE` en toda la aplicación; los nueve
   métodos `.delete()` de los repositorios y `MemoryEngine.archive()`/`.forget()`
   están completamente implementados y **nunca se llaman desde
   ningún lugar**. Esto además significa que `ALPHA_PROGRAM_SPEC.md`
   promete algo que hoy no se puede cumplir: *"Participants must be
   able to... Request deletion of their Alpha data."* **Requiere
   decisión de producto/arquitectura — no implementado.**
3. **ALTO** — `DefaultConnectStage.connect()` (Memory Engine) escanea
   **todas** las memorias del usuario, sin límite, de forma síncrona,
   en cada mensaje de chat — confirmado de forma independiente por dos
   auditorías distintas como el hallazgo de consulta-sin-límite más
   severo de todos. **Requiere que M4 extienda la interfaz del
   repositorio de Memory Engine — no implementado por mí.**
4. **ALTO, implementado** — Condición de carrera (TOCTOU) en
   `findOrCreateGoal`/`Project`/`Habit`/`Person`/`Relationship`: doble
   envío o reintento del cliente podía crear entidades de Vida
   duplicadas. **Arreglado** con transacción + advisory lock, mismo
   patrón ya probado en el rate limiter — cero cambio de esquema.
5. **ALTO, arreglado por M4 (hallazgo independiente y coincidente)** —
   El historial completo de una conversación se reenviaba sin límite al
   proveedor de IA en cada turno; encontré este mismo hallazgo de forma
   independiente e implementé un fix equivalente (ventana de 100
   mensajes), pero M4 llegó a la misma conclusión con **verificación
   real contra Postgres/OpenAI** (1200 mensajes sintéticos, ~105k
   tokens de historial, 8.4s → 2.5s de latencia) que yo no pude
   reproducir en este entorno — descarté mi versión y me quedé con la
   suya (ventana de 60 mensajes, mejor validada). Ver commit `23df3aa`.

Las 8 consultas sin límite del ensamblador de `RealitySnapshot` se
analizaron una por una (sección dedicada abajo, como pidió el Founder)
— ninguna se implementó de forma genérica. Tres no necesitan arreglo
(`activeGoals`/`activeProjects`/`activeHabits` son auto-acotadas por
diseño). Las cinco restantes sí son un riesgo real de escalabilidad,
pero arreglarlas de forma segura requiere extender interfaces de
motores (Belief/Concept/Knowledge/Reasoning/Contradiction Engine) que
M4 posee y está desarrollando activamente en paralelo — quedan
documentadas con el criterio exacto recomendado, no implementadas.

------------------------------------------------------------------------

# Lo que se auditó personalmente y se verificó SÓLIDO

No se fabricó ningún problema donde el diseño ya es correcto. Detalle
completo (código citado, escenarios de carrera analizados paso a paso)
en el historial de esta sesión; resumen verificable aquí:

### Streaming / desconexión de cliente (`app/api/chat/route.ts`)

El fix reciente de M4 (`9d63601`) para "cliente se desconecta a mitad
del stream" es correcto. Verificado explícitamente: `generate()`
(`send-message.ts`) es un async generator **nativo** — las llamadas
concurrentes a `.next()` (una de `pull()` ya en vuelo, otra del drenaje
de `cancel()`) se encolan de forma segura por el propio runtime de
JavaScript (spec `AsyncGeneratorEnqueue`), nunca corrompen estado.
`finalizeReply` corre exactamente una vez pase lo que pase, y todo
camino que tocaría un `controller` ya cerrado está protegido por la
bandera `clientDisconnected`, verificada antes de cada `enqueue`/`close`/`error`.
**Sin hallazgos.**

### Rate limiting (`features/chat/services/check-rate-limit.ts`)

`pg_advisory_xact_lock(hashtext(userId))` dentro de una transacción que
también hace el conteo y la inserción — cierra correctamente la
ventana de carrera entre "contar" e "insertar" que el propio comentario
describe. Único matiz, ya conocido y de impacto negligible: colisión
de hash de `hashtext()` entre dos usuarios distintos es
astronómicamente improbable a esta escala. **Sin hallazgos nuevos.**

### Reclamo de Knowledge Jobs (`features/knowledge/services/process-knowledge-job.ts`)

`SELECT ... FOR UPDATE SKIP LOCKED` + lease de 5 minutos (más que el
`maxDuration` de 60s del cron) — reclamo seguro bajo múltiples
llamadores concurrentes, y un crash a mitad de proceso no deja el job
huérfano para siempre. **Sin hallazgos.**

------------------------------------------------------------------------

# Análisis detallado, consulta por consulta — `assembleRealitySnapshot`

A pedido explícito del Founder: para cada consulta sin límite,
identificar qué obtiene, por qué está sin límite, si puede limitarse
semánticamente, el criterio correcto, y el impacto estimado. **Ningún
límite genérico.**

## `activeGoals` / `activeProjects` / `activeHabits`

- **Qué obtiene:** todos los Goals/Projects/Habits con `status: "active"`
  del LifeGraph — se usan sin recortar en `RealitySnapshot.life` (el
  Dashboard y `/life` los listan completos) y para contar señales de
  dominio (`knowledgeGaps`).
- **Por qué está sin límite hoy:** porque, a diferencia de las
  entidades generadas automáticamente por Knowledge Engine, estas son
  creadas por decisión humana explícita (o por Life Capture a partir de
  algo que la persona dijo) — el propio "active" ya es un filtro
  natural: nadie mantiene miles de metas activas sin completarlas ni
  abandonarlas.
- **¿Puede limitarse semánticamente?** **No debería.** `RealitySnapshot.life`
  se usa para mostrar *todos* los ítems activos en el Dashboard/`/life`
  (`activeLifeItems` en `app/dashboard/page.tsx`) — agregar un límite
  aquí escondería objetivos reales de la propia pantalla de la
  persona la primera vez que superara ese número. Sería cambiar el
  comportamiento esperado, exactamente lo que el Founder pidió no
  hacer sin poder demostrarlo.
- **Impacto real:** bajo y no creciente — acotado por comportamiento
  humano, no por acumulación automática. **Veredicto: sin acción. Ya
  es seguro por diseño, no por accidente.**

## `insights`, `beliefs`, `concepts`, `reasoningConclusions`, `contradictions`

- **Qué obtienen:** el histórico *completo* de cada tabla para el
  LifeGraph (cualquier `status`), filtrado/ordenado/recortado después
  en JavaScript a un puñado de ítems (1-3) por relevancia (confianza,
  recencia, o ambas).
- **Por qué están sin límite hoy:** cada repositorio implementa
  `.list()` como "traer todo para este LifeGraph" — la misma
  convención en los cinco casos — y nadie le puso un `ORDER BY ...
  LIMIT N` a nivel SQL replicando el filtro/orden que ya existe en JS.
- **¿Pueden limitarse semánticamente?** **Sí, en principio** — el
  criterio ya está 100% definido en el propio código (p. ej.
  `insights`: `status = 'validated'`, `ORDER BY confidence DESC,
  updated_at DESC LIMIT 3`), así que empujarlo a SQL preservaría
  exactamente el mismo resultado, no uno distinto.
- **Por qué NO se implementó de todas formas — evidencia, no
  suposición:** antes de tocar nada, verifiqué el fan-out real de cada
  repositorio (`grep` de cada `new DrizzleXRepository(` en todo el
  repo). Resultado: **ninguno de los cinco se usa solo en
  `assemble-reality-snapshot.ts`.** Los cinco se instancian también
  dentro de `core/knowledge-engine` (el propio Reasoning Engine, el
  Knowledge Engine base), `features/knowledge/services/enrich-knowledge-graph.ts`
  (el pipeline que M4 tocó por última vez esta misma sesión),
  `features/knowledge/services/detect-predictive-patterns.ts`, y
  `features/identity/services/build-identity-model.ts` (`/life/identity`,
  que yo mismo edité en el bloque de H6). Cambiar el método
  `.list()` compartido —o incluso agregarle un método nuevo a la
  interfaz del repositorio— afecta a todos esos consumidores a la vez,
  varios de ellos dentro de motores que M4 posee y está modificando en
  paralelo ahora mismo. Esto es exactamente "invade trabajo de M4" y
  "modifica un contrato compartido" — la orden explícita era no hacer
  eso.
- **Criterio recomendado para M4** (documentado, no implementado):
  agregar un método nuevo y específico a cada repositorio — p. ej.
  `listTopValidated(context, { orderBy: "confidence", limit })` — que
  conviva con el `.list()` existente sin tocarlo, y usarlo solo desde
  `assemble-reality-snapshot.ts`. Aditivo, cero riesgo para los demás
  consumidores, pero es una decisión que le corresponde a quien posee
  esas interfaces.
- **Impacto estimado:** hoy bajo (Alpha, historial corto). En Beta,
  alto y creciente — estas tablas se llenan automáticamente
  (Knowledge Engine escribe en ellas prácticamente en cada mensaje con
  señal real), a diferencia de Goals/Projects/Habits.
- **Clasificación: ALTO impacto futuro, MEDIO hoy. Documentado para
  M4, no implementado.**

## `importanceScores` (Context Engine, `loadImportance`)

- **Qué obtiene:** el mapa completo `(entityType:entityId) → score`
  para el LifeGraph, dentro del propio `core/context-engine`, para
  luego consultar como máximo 8 claves (`MAX_CONTEXT_ITEMS`).
- **Por qué está sin límite:** mismo patrón que los cinco anteriores —
  "traer todo, indexar en memoria" fue razonable cuando la tabla era
  chica.
- **¿Puede limitarse?** Semánticamente sí (traer solo las entidades
  candidatas relevantes en vez de el mapa completo), pero requiere
  cambiar la forma en que `core/context-engine` construye ese mapa —
  es lógica interna del propio engine, no una consulta aislada que
  se pueda acotar desde afuera sin tocar `core/context-engine` mismo.
- **Fan-out verificado:** `DrizzleImportanceRepository` también se usa
  en `build-identity-model.ts`, `detect-predictive-patterns.ts` y
  `enrich-knowledge-graph.ts` (para *escribir* scores). Mismo problema
  de contrato compartido que el grupo anterior.
- **Clasificación: ALTO impacto futuro. Documentado para M4, no
  implementado** — es, literalmente, código dentro de Context Engine,
  no una consulta externa que lo consume.

------------------------------------------------------------------------

# Hallazgos completos, clasificados

Para cada uno: Hallazgo / Evidencia / Impacto / Riesgo / Recomendación / Implementación.

## 1. [CRÍTICO] Techo de throughput del Knowledge Engine en producción

**Hallazgo:** el único camino de ejecución en producción
(`app/api/cron/knowledge-worker/route.ts`) corre **una vez al día**
(límite del plan Vercel Hobby), con presupuesto de 50s, procesando
jobs secuencialmente. Cada job corre el pipeline base más
`enrichKnowledgeGraph` (concept extraction, belief consolidation,
contradiction detection, reasoning, curiosity — varias llamadas de IA
secuenciales). `knowledge_jobs` se genera aproximadamente una vez por
mensaje calificado, en toda la base de usuarios, y nunca se poda.

**Evidencia:** `app/api/cron/knowledge-worker/route.ts:14-26`
(comentario explícito reconociendo el límite del plan y el incidente
ya ocurrido: *"146 jobs pendientes, 0 insights, siempre"*).
`TIME_BUDGET_MS = 50_000`. Sin paralelismo entre jobs.

**Impacto:** si cada job tarda 25-40s+ (5 llamadas de IA secuenciales),
solo se procesan 1-2 jobs por día, **en total, para todos los
usuarios**. Cualquier tráfico real de Beta genera jobs más rápido de
lo que se pueden drenar — el backlog crece sin freno desde el primer
día. Falla en silencio: el chat sigue funcionando, nada truena, solo
deja de cumplirse la promesa central del producto.

**Riesgo: CRÍTICO.** Impacto altísimo sobre la propuesta de valor
central, probabilidad casi segura en cuanto haya tráfico real
sostenido, ya ocurrió una vez documentado en el propio código.

**Recomendación:** decisión de Founder + M4, no mía — opciones:
upgrade a Vercel Pro (cron más frecuente / sin este límite), cambiar el
modelo de disparo (cola real en vez de cron diario), o reducir/paralelizar
las llamadas de IA por job. Cualquiera de las tres es una decisión de
infraestructura/costo o de arquitectura del pipeline.

**Implementación:** ninguna — requiere decisión arquitectónica explícita.

------------------------------------------------------------------------

## 2. [ALTO] Ninguna tabla tiene retención; cero capacidad de borrado en toda la aplicación

**Hallazgo:** los métodos `.delete()` de nueve repositorios distintos
(`Memory`, `Goal`, `Project`, `Habit`, `Routine`, `Person`,
`Relationship`, `LifeDomain`, `Insight`) están completamente
implementados y **nunca se invocan** desde ningún servicio o ruta.
`MemoryEngine.archive()`/`.forget()` — implementados, cero llamadores.
No existe un solo handler HTTP `DELETE` en toda la aplicación.

**Evidencia:** `grep -rn "export async function DELETE" app` → cero
resultados. `grep` de cada `.delete(`/`.archive(`/`.forget(` fuera de
su propia definición → cero resultados (excepto limpieza de cuentas de
smoke test). Confirmado independientemente por la auditoría de
escalabilidad.

**Impacto:** doble. (a) Técnico: cada tabla que recibe escrituras solo
crece, para siempre — la causa raíz detrás de casi todos los hallazgos
de escalabilidad de este informe. (b) **De política, no solo técnico**:
`docs/product/ALPHA_PROGRAM_SPEC.md` promete explícitamente que los
participantes pueden *"Request deletion of their Alpha data"* — esa
capacidad, hoy, no existe en ningún punto de la aplicación real.

**Riesgo: ALTO.** No es un bug que rompa algo hoy, pero es una promesa
de producto ya hecha y actualmente incumplible, además de la raíz del
problema de crecimiento sin control.

**Recomendación:** decisión de producto (qué significa "borrar" —
¿archivar, olvidar, o borrado real?) más una superficie real (ruta +
UI) para ejercerla. Los repositorios y el lifecycle de Memory Engine
ya están construidos — falta la capa de producto que los invoque.

**Implementación:** ninguna — decisión de producto/arquitectura, y
toca directamente Memory Engine (fuera de mi alcance sin autorización
explícita más allá de este audit).

------------------------------------------------------------------------

## 3. [ALTO] `DefaultConnectStage` escanea todas las memorias del usuario en cada mensaje

**Hallazgo:** `core/memory-engine/lifecycle/default-connect-stage.ts:98`
— `this.repository.list(context)` sin límite, dentro de `capture()`,
que corre de forma síncrona y obligatoria en cada mensaje
(`sendMessage`/`sendMessageStream`). Confirmado independientemente por
dos auditorías distintas como el hallazgo de consulta-sin-límite más
severo de todos (tabla de más rápido crecimiento, en el hot path).

**Evidencia:** `core/memory-engine/repositories/drizzle-memory.repository.ts:80-87`
(`list()` sin `.limit()`). `samePersonMatches` (`default-connect-stage.ts:55-73`)
documentado explícitamente como "sin límite fijo de cantidad".

**Impacto:** latencia creciente en cada mensaje de chat a medida que
crece el historial del usuario más comprometido — exactamente a quien
más se quiere retener. `memory_connections` crece cuadráticamente.

**Riesgo: ALTO.** Degradación real y medible, no teórica, con
trayectoria de crecimiento conocida (el propósito mismo del producto es
acumular memorias indefinidamente).

**Recomendación (criterio, no implementación):** los dos detectores ya
tienen su filtro completamente definido en código (`sameOriginMatches`:
match exacto por `source`+`sourceId`; `samePersonMatches`: `personId`
+ `rank.score >= umbral`) — empujar exactamente esos filtros a SQL, vía
un método nuevo y aditivo en `MemoryRepository` (nunca modificar
`.list()`, que también usan `features/life/services/get-life-timeline.ts`
y `features/memories/services/search-memories.ts` — fan-out verificado).

**Implementación:** ninguna. Verificado que `MemoryRepository` es
Memory Engine, con fan-out real a otros consumidores — toca una
interfaz que M4 posee. Documentado con el fix exacto ya diseñado, listo
para que M4 lo aplique con una sola revisión.

------------------------------------------------------------------------

## 4. [ALTO, IMPLEMENTADO] Condición de carrera en `find-or-create-{Goal,Project,Habit,Person,Relationship}`

**Hallazgo:** "leer todos, buscar coincidencia por título, crear si no
hay" sin ninguna protección de concurrencia — dos llamadas
concurrentes para la misma persona (doble clic en enviar, reintento de
red) podían leer "no hay coincidencia" antes de que cualquiera
terminara de escribir, produciendo entidades de Vida duplicadas
visibles para siempre en `/life`.

**Evidencia:** `core/life/services/find-or-create-goal.ts` (y las
cuatro hermanas) — sin `db.transaction`, sin lock, sin restricción de
unicidad en el schema.

**Impacto:** datos duplicados visibles al usuario, socavando la
promesa de "un modelo coherente de tu vida" — no corrupción, pero sí
un defecto real y de cara al usuario.

**Riesgo: ALTO** (probabilidad real — doble clic/reintento es
comportamiento humano ordinario; impacto medio-alto porque es visible
y repetible).

**Solución implementada:** todo el ciclo lectura-decisión-escritura
corre ahora dentro de una única transacción, serializada por
`pg_advisory_xact_lock(hashtext(lifeGraphId || ':<tipo>'))` — mismo
patrón ya probado en `check-rate-limit.ts`. Lock acotado por LifeGraph
y tipo de entidad (nunca bloquea, por ejemplo, resolver un Project
mientras se resuelve un Goal del mismo usuario). **Cero cambio de
esquema, cero migración** — se agregó un tipo `Transaction` en
`core/db/client.ts` (unión de tipos, no cambia comportamiento de nadie
que ya use `Database`) para que los repositorios de `core/life`
acepten indistintamente `db` o `tx`.

**Archivos:** `core/db/client.ts`,
`core/life/services/find-or-create-{goal,project,habit,person,relationship}.ts`,
`core/life/repositories/drizzle-{goal,project,habit,person,relationship}.repository.ts`
(solo el tipo del constructor).

**Validación:** typecheck limpio, lint limpio, build de producción
limpio. **No pude correr smoke tests reales** — sin Docker ni Postgres
en este entorno, `smoke/dashboard.test.ts` (que llama `findOrCreateGoal`
directamente) no pudo ejecutarse (`ECONNREFUSED`). Receta de
reproducción para correr en un entorno real:
```
npm run smoke   # con .env real apuntando a una base de test
```
y, para verificar específicamente la corrección de la carrera, un test
que dispare dos `findOrCreateGoal` concurrentes con el mismo título
sobre el mismo `LifeGraphContext` (vía `Promise.all`) y confirme que
`repository.list()` devuelve una sola fila después, no dos.

------------------------------------------------------------------------

## 5. [ALTO, resuelto por M4] Historial de conversación sin límite reenviado al proveedor de IA

**Hallazgo:** el historial completo de una conversación se traía sin
límite y se reenviaba entero en cada turno — sin truncamiento,
resumen, ni ventana. La función "Continuar esta conversación" (ya
soportada por el producto) fomenta activamente reanudar el mismo hilo
indefinidamente.

**Evidencia:** encontrado de forma independiente durante esta
auditoría (`features/chat/services/send-message.ts`, query original
sin `.limit()`); `app/conversations/[id]/page.tsx:100-103` ("Continuar
esta conversación" → `/chat?conversationId=...`).

**Impacto:** dos modos de falla distintos — (a) costo/latencia
creciente linealmente con el largo de la conversación; (b) **falla
dura**: una vez que el conteo de tokens acumulado excede la ventana de
contexto del modelo, la llamada a OpenAI falla con un error genérico,
sin ningún manejo especial.

**Riesgo: ALTO.**

**Resolución:** implementé un fix equivalente (ventana de 100 mensajes
más recientes) y, al sincronizar con `origin/main`, encontré que M4
había llegado al mismo hallazgo por su cuenta (commit `23df3aa`) con
**verificación real contra Postgres/OpenAI** que yo no pude reproducir
en este entorno (1200 mensajes sintéticos, ~105k tokens de historial
antes del fix, 8.4s de latencia → 2.5s después, ventana de 60 mensajes
en vez de 100). Descarté mi versión y conservé la de M4 — mismo
diagnóstico, misma técnica (DESC + LIMIT + reversa a orden
cronológico), pero con evidencia de producción real respaldando el
número elegido en vez de una estimación conservadora. Ejemplo concreto
de por qué la coordinación entre sesiones importa: cero conflicto de
archivo real gracias a haber revisado `origin/main` antes de empujar,
pero si no lo hubiera revisado habría dejado dos implementaciones
divergentes del mismo fix.

------------------------------------------------------------------------

## 6. [MEDIO] Condición de carrera de "lost update" en consolidación de Beliefs

**Hallazgo:** `consolidate-belief-from-insight.ts` lee
`confidence.score`, calcula el nuevo valor en JS, y hace un upsert
ciego — sin comparación-e-intercambio, sin lock. Dos jobs procesando
beliefs del mismo usuario en paralelo podrían perder un refuerzo en
silencio.

**Evidencia:** `core/belief-engine/services/consolidate-belief-from-insight.ts:87-134`,
sin `WHERE confidence_score = <valor leído>` ni columna de versión.

**Riesgo: MEDIO.** Hoy mitigado por la cadencia operativa (cron una
vez al día, procesamiento secuencial dentro de un mismo proceso) — no
por ninguna garantía de la base de datos. Fráil si esa cadencia cambia
(p. ej. al resolver el Hallazgo #1).

**Recomendación:** `UPDATE ... WHERE confidence_score = $valorLeído`
(optimistic concurrency) o envolver en el mismo tipo de advisory lock
ya usado en este informe — decisión de M4, toca Belief Engine.

**Implementación:** ninguna.

## 7. [MEDIO] Escrituras multi-paso sin transacción en consolidación de Beliefs

**Hallazgo:** `save()` → `appendHistory()` → `saveEvidence()` son
round-trips independientes, sin `db.transaction()`. Un fallo transitorio
de red entre pasos deja `belief_history` desincronizado del
`confidenceScore` real — corrupción silenciosa de un log que el propio
sistema declara autoritativo.

**Riesgo: MEDIO** (no requiere concurrencia, solo un blip de red — real
en un entorno serverless con pooler, ya documentado como inestable bajo
carga en `core/db/client.ts`).

**Implementación:** ninguna — toca Belief Engine, recomendado envolver
en transacción, decisión/ejecución de M4.

## 8. [MEDIO] `RealitySnapshot` no es atómico entre sus ~11 sub-consultas

**Hallazgo:** cada sub-consulta de `assembleRealitySnapshot` corre bajo
su propio snapshot MVCC (sin transacción compartida) — brecha distinta
a las dos ya documentadas en `ADR-0013`/`REALITY_SNAPSHOT_V1.md`
(staleness posterior al ensamblado; contradicción entre engines). Esta
es la consistencia *interna* del propio acto de ensamblar.

**Riesgo: MEDIO en teoría, BAJO en la práctica hoy** — los datos que
mezcla son ya "blandos" (creencias probabilísticas que un LLM tolera
por diseño), la ventana de carrera es de milisegundos, y escritores
concurrentes sobre el mismo LifeGraph son raros dado el Hallazgo #1.
Vale la pena que quede documentado como decisión consciente en vez de
un gap sin examinar.

**Implementación:** ninguna — documentado para que M4 decida si
amerita `REPEATABLE READ`.

## 9. [MEDIO] Capacidad "Routine" completamente construida, nunca conectada

**Hallazgo:** tabla, repositorio (CRUD completo), entidad y evento de
dominio para `Routine` existen y no tienen ni un solo llamador real.
`life-capture-service.ts` no tiene un `find-or-create-routine.ts`, y el
tipo de memoria `"ritual"` cae en el mismo cajón sin mapeo que
`fact`/`preference`/`event`/`intention`. `RealitySnapshot.life` tampoco
tiene `activeRoutines`.

**Riesgo: MEDIO** — gap de producto silencioso, no de estabilidad: el
contenido no se pierde (queda como Memory), pero nunca se estructura ni
aparece en `/life` ni en el modelo de identidad.

**Recomendación:** decisión de producto — completar el wiring (incluye
extender `RealitySnapshot`, ADR-0013) o retirar deliberadamente la
maquinaria muerta.

**Implementación:** ninguna — toca `RealitySnapshot`, fuera de alcance
sin autorización explícita adicional.

## 10. [BAJO] Código y esquema muerto: `core/memory/` (Memory Engine V1) y tablas V1 abandonadas

**Hallazgo:** `core/memory/` (motor de memoria de primera generación,
con un `createMemoryEngine` que colisiona de nombre con el real) y las
tablas `projects`/`goals`/`habits`/`people`/`insights`/`documents`/`journalEntries`
(`core/db/schema/knowledge.ts`, `relations.ts`, `documents.ts`,
`journal.ts`) están migradas en la base de datos real pero no las
referencia ninguna ruta, servicio o componente vivo.

**Riesgo: BAJO** funcionalmente (nada corre, nada crece), pero real
como riesgo de confusión futura — alguien (humano o IA) grepeando
"goals"/"MemoryEngine" puede aterrizar en el camino muerto y equivocado.

**Implementación:** ninguna — retirar tablas ya migradas es una
migración estructural, fuera de mi alcance sin autorización explícita;
queda como recomendación de limpieza para M4.

## 11. [BAJO] `events` sin retención (ya conocido) + segundo síntoma nuevo

**Hallazgo adicional a lo ya conocido:** `app/admin/page.tsx` corre un
`avg(...)` sobre *todos* los eventos `message_sent` de siempre, sin
ventana de tiempo — un segundo síntoma del mismo problema de fondo,
en una página que un operador recarga repetidamente.

**Riesgo: BAJO** hoy (poco tráfico a `/admin`), mismo origen que el
hallazgo ya conocido de `events`.

**Implementación:** ninguna — mismo veredicto que la tabla `events` en
general.

------------------------------------------------------------------------

# Lo implementado en este bloque (resumen)

| # | Cambio | Archivos | Riesgo cerrado |
|---|---|---|---|
| 1 | Transacción + advisory lock en find-or-create-* | `core/db/client.ts`, 5× `core/life/services/find-or-create-*.ts`, 5× `core/life/repositories/drizzle-*.repository.ts` (solo tipo) | Hallazgo #4 |
| 2 | Tope en historial de conversación (implementación de M4, `23df3aa`) | `features/chat/services/send-message.ts` | Hallazgo #5 |
| 3 | Guarda contra reprocesamiento duplicado de insights (M4, `d5f0101`) | `features/knowledge/services/enrich-knowledge-graph.ts` | No cubierto por esta auditoría — hallazgo propio de M4 |

El #1 es mío: typecheck limpio, lint limpio, build de producción
limpio. Smoke tests intentados, no ejecutables en este entorno (sin
Docker/Postgres real) — receta de reproducción incluida en el
hallazgo para correr en un entorno con infraestructura real. El #2 y
#3 son de M4, con verificación end-to-end real que este entorno no
puede reproducir (ver sus propios mensajes de commit).

------------------------------------------------------------------------

# Decisiones pendientes para el Founder / M4

En orden de urgencia:

1. Throughput del Knowledge Engine en producción (Hallazgo #1, CRÍTICO).
2. Política y capacidad real de borrado/retención (Hallazgo #2, ALTO) —
   incluye una promesa de `ALPHA_PROGRAM_SPEC.md` ya hecha y hoy incumplible.
3. Acotar `DefaultConnectStage` (Hallazgo #3, ALTO) — fix ya diseñado,
   falta que M4 lo aplique sobre su propia interfaz.
4. Acotar las 5 consultas de motores en `assembleRealitySnapshot` +
   `importanceScores` (criterio detallado arriba) — mismo caso, fix
   diseñado, ejecución de M4.
5. Beliefs: optimistic concurrency + transacción en consolidación
   (Hallazgos #6/#7).
6. Routine: completar o retirar (Hallazgo #9).
7. Limpieza de `core/memory/` y tablas V1 (Hallazgo #10).
