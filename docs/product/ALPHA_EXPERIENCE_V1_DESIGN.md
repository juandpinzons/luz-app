# ALPHA EXPERIENCE V1 — Documento de Diseño

**Status:** Proposed — awaiting Founder confirmation
**Versión:** 2.0 — revisión post Principal Engineer Review
**Autor:** Síntesis de diseño de producto, sobre arquitectura y código existentes — no es una decisión de producto por sí sola.
**No modifica:** Architecture V1, ADRs aprobados, Reality Snapshot (ADR-0013), Context Engine, Memory Engine, Life Graph (ADR-0011), Dashboard/Conversation Architecture. Todo lo que sigue se construye *sobre* esos contratos, nunca en paralelo a ellos.
**Relacionado con:** `docs/product/FEATURE_ROADMAP_V1.md`, `docs/vision/PRESENCE_PRINCIPLES.md`, `docs/vision/DESIGN_PHILOSOPHY.md`, `docs/vision/NORTH_STAR_EXPERIENCE.md`, `docs/architecture/REALITY_SNAPSHOT_V1.md`, ADR-0011, ADR-0013.

## Historial de revisión

**v1.0** — diseño inicial de los 7 objetivos del Epic.

**v2.0** — incorpora la revisión crítica (Principal Engineer Review). Cambios sustantivos:
1. El Objetivo 6 (experiencia conversacional completa) pasa de estar implícito en un sprint de "pulido" a tener flujo, wireframe y sprint propios, diferenciado explícitamente del Objetivo 5.
2. "¿Qué necesita seguimiento?" en el Dashboard deja de asumir registros de hábito inexistentes — se reconstruye sobre `targetDate`/`dueDate` de Goal/Project (dato real y estructurado); el seguimiento de Hábitos por falta de registro se marca `Future` explícitamente.
3. Se diseña un único mecanismo de estado (`seen_prompts`) para "visto / aceptado / editado / descartado", reemplazando tres mecanismos implícitos y distintos que existían en v1.0.
4. "Descartar" en Learning queda documentado con su efecto real sobre retrieval, gana una confirmación explícita, y se declara sin recuperación en el Alpha — por decisión explícita, no por omisión.
5. "Editar" queda especificado como reclasificar + rerankear + guardar, reutilizando únicamente clases ya existentes.
6. El diagrama de integración enruta Life y Memories a través de `features/life/services` y `features/memories/services`, igual que Dashboard y Chat — ya no hay una llamada "directa" de `app/` a `core/` como excepción no declarada.
7. El vínculo Memoria↔Goal/Project/Habit se redefine como búsqueda literal por título (mecanismo real, ya existente, con su límite declarado), y el vínculo semántico se marca `Future` explícitamente.
8. Se corrige la inconsistencia de conteo de secciones de navegación (eran "cinco" en un lugar, "cuatro" en el resto) — son cuatro en todo el documento.
9. El roadmap se reordena: Memories antes que Learning (ver razonamiento en Sección 10), y el Objetivo 6 gana su propio sprint (Sprint 7), separado del sprint del Objetivo 5 (Sprint 6) — v1.0 los fusionaba en uno solo.
10. Segunda pasada de consistencia: corregida una contradicción real ("5 preguntas" vs. las 6 que el propio Objetivo 1 del Epic define para el Dashboard — siguen siendo 6, ver 3.1 y 5.1), y precisadas dos reglas conversacionales nuevas que en el primer borrador de esta revisión dependían de una señal no verificable ("¿ya se resolvió?", "¿ya se mencionó?") — ambas se reescriben sobre `seen_prompts` (Sección 3.6).

---

## 0. Dos inconsistencias que hay que nombrar antes de diseñar

*(Sin cambios respecto a v1.0 — siguen vigentes, no fueron objeto de esta revisión.)*

### 0.1 "Persistencia Nivel 1" ya está más avanzada de lo que el propio roadmap dice

El Epic la da por terminada, y tenía razón — pero `docs/product/FEATURE_ROADMAP_V1.md` todavía dice que Goal/Project/Habit "no tienen repositorio Drizzle: no se pueden persistir ni consultar hoy". Verificado directamente contra el código: eso es falso. `core/life/repositories/drizzle-{goal,project,habit,routine,relationship}.repository.ts` son implementaciones Drizzle reales y completas, con tablas migradas (`core/db/schema/life-entities.ts:46-188`), y `features/chat/services/assemble-reality-snapshot.ts:81-85` ya puebla `RealitySnapshot.life` con datos reales.

**Consecuencia para este diseño:** Dashboard V2 y Life pueden construirse *hoy* sobre datos reales de Goal/Project/Habit/Relationship, no sobre un plan futuro.

**Lo que sigue sin existir:** `LifeEvent` y `LifeDomain` — solo interfaces, sin repositorio Drizzle, sin tabla.

### 0.2 "Reutilizar el extractor existente" (Objetivo 3 del Epic) no describe nada que exista hoy

No existe un extractor de Insights funcional. Lo que sí existe y corre en cada mensaje: `DeterministicMemoryClassifier` y `DeterministicMemoryRankingStrategy` (umbral exportado `MIN_SCORE_WITH_UNDERSTANDING_SIGNAL`). **Decisión de diseño:** Learning visible se construye sobre Memoria clasificada + rankeada, no sobre Conocimiento/Insights — primera iteración real, no versión disminuida (Principio de Diseño de Engine #1).

---

## 1. Estado actual

### 1.1 Qué existe y funciona hoy (verificado contra código, no contra documentación)

| Área | Estado real |
|---|---|
| Identidad / Life Graph | Bootstrap automático de `LifeGraph` + `Person` en el primer login. Real. |
| Conversación | Streaming SSE, historial, retomar conversación con indicador humano, autoscroll inteligente, borradores persistentes, títulos automáticos, búsqueda, rate limiting, 6 reglas conversacionales determinísticas. Real, y notablemente pulido. |
| Memoria | Captura automática, clasificación en 8 tipos, ranking relacional, conexión entre memorias (`MemoryConnection`), retrieval estructurado con `ilike()`. Real. |
| Life Nivel 1 | Goal, Project, Habit, Routine, Relationship — repositorio Drizzle real, ya alimentando `RealitySnapshot.life`. `LifeEvent`/`LifeDomain` — solo interfaces, sin persistencia. |
| Reality Snapshot | `{life, memory, signals}`. `life` y `memory` reales; `signals` vacío. |
| Dashboard | Saludo + fecha + life line + línea de continuidad IA + resumen de actividad. Real, pero es una lista plana. |
| Conocimiento | Roto en producción o desconectado. No usable para este Epic. |
| Presencia | Cero código. LUZ es puramente reactiva — cada rasgo de "seguimiento"/"cierre" diseñado en este documento debe poder dispararse dentro de un turno de conversación ya iniciado por la persona, nunca como mensaje no solicitado. |
| Navegación | No existe shell compartido. Cada página es independiente. |
| Identidad visual | Tailwind v4, sin paleta ni tokens propios. Sin librería de iconos/animación. |
| Componentes compartidos | Solo `ErrorState` y `Skeleton`. |

### 1.2 Qué falta, específicamente para este Epic

- Un shell de navegación.
- Una fuente de Timeline (Memoria, no `LifeEvent`).
- Un servicio "qué aprendió LUZ hoy" (sobre Memoria, ver 0.2).
- Función "listar todos" para Goal/Project/Habit/Relationship (además de `listActive*`).
- Un mecanismo único de estado "visto/aceptado/editado/descartado" (nuevo en v2.0, ver Sección 5.3).
- Identidad visual propia.
- Reglas conversacionales nuevas — dos frentes distintos: uso natural de Life/Memoria (Objetivo 5) y experiencia conversacional completa: continuidad, seguimiento, cierres, repetición (Objetivo 6) — ver Secciones 3.5 y 3.6, antes fusionadas por error en v1.0.

### 1.3 Capacidades ya disponibles que este Epic solo necesita mostrar, no construir

- Ranking relacional de memoria — nunca mostrado.
- `MemoryConnection` — se calcula, nunca se renderiza.
- Goal/Project/Habit/Relationship — persisten, nunca se muestran.
- Búsqueda de memoria por texto — ya funciona, nunca expuesta como pantalla.

### 1.4 Explícitamente fuera de alcance de este Epic (nuevo en v2.0)

Nombrado aquí para que ninguna sección de más abajo lo prometa por accidente:

- **Recuperación de memorias descartadas.** Descartar en Learning es permanente dentro del Alpha (Sección 3.4).
- **Seguimiento de Hábitos por falta de registro/check-in.** No existe ningún campo de actividad en `Habit`; no se construye una heurística de texto para simularlo (ver 3.1).
- **Vínculo semántico Memoria↔Goal/Project/Habit.** V1 solo ofrece coincidencia literal de texto (Sección 3.2); vincular por significado depende de retrieval semántico (embeddings), `Approved` pero no construido (`FEATURE_ROADMAP_V1.md` §5.1).
- **Representación de "arco"** (progreso, reveses, cierre narrativo) para Goal/Project — el modelo de datos solo tiene `status` + fechas.
- **Cualquier mensaje proactivo/no solicitado.** Todo lo que este documento llama "seguimiento" o "cierre" ocurre dentro de una respuesta a un mensaje que la persona ya envió — nunca una notificación push ni un mensaje que LUZ inicia sola (Presencia no existe, ver 1.1).

---

## 2. Experiencia del usuario

*(Sin cambios respecto a v1.0.)*

> *"¿Esto hace que la relación se sienta más real, o hace que el producto se sienta más usado?"* — `DESIGN_PHILOSOPHY.md`

El resultado que el Founder nombró para los primeros 10 minutos con LUZ: **paz**, no excitación (`NORTH_STAR_EXPERIENCE.md`). Tres consecuencias directas:

1. **Ningún número decorativo.** Dashboard V2 muestra estado de la vida de la persona, no actividad del producto.
2. **Silencio intencional, aplicado literalmente.** Si no hay nada nuevo, la sección no existe — nunca un placeholder repetido (mecanismo concreto en Sección 5.3).
3. **Toda referencia a Life/Memoria en conversación debe ser explicable** — trazable a un dato real y reciente, nunca a una inferencia sin evidencia (Principio 7, `PRESENCE_PRINCIPLES.md`).

---

## 3. Flujos

### 3.1 Dashboard

```
Login → Dashboard
  1. LUZ saluda por nombre + fecha (ya existe)
  2. Responde con datos reales o silencio si no hay nada real:
     a. ¿Qué es importante hoy?        → continuityLine (ya existe) + hasta 2 Goals/Projects con próxima fecha
     b. ¿Qué cambió desde ayer?        → diff simple entre memorias de ayer y hoy con señal real
     c. ¿Qué objetivos siguen activos? → Goals/Projects activos (ya persisten)
     d. ¿Qué necesita seguimiento?     → Goals/Projects activos con targetDate/dueDate dentro de 14 días
                                          (dato estructurado real, sin heurística de texto — ver nota abajo)
     e. ¿Qué aprendió LUZ recientemente? → Learning card (Sección 3.4) — solo si hay algo, nunca vacío disfrazado
     f. ¿Qué conversaciones requieren continuidad? → isHistoricalConversation existente, promovido a tarjeta
  3. Estado vacío: se muestra una sola vez por bloque (mecanismo `seen_prompts`, Sección 5.3);
     en visitas siguientes sin datos, el bloque completo desaparece — no un texto repetido
```

**Nota sobre (d), corregida en v2.0:** v1.0 proponía "Hábito sin registro hace N días" — no hay ningún campo en `Habit` que registre actividad, así que esa versión no era construible sin inventar datos. La versión corregida usa `Goal.targetDate` / `Project.dueDate` — campos reales y ya persistidos — filtrando `status = 'active' AND (targetDate OR dueDate) <= hoy + 14 días`. Es una consulta de fecha, no una heurística de texto. El seguimiento de Hábitos queda fuera de este Epic (Sección 1.4).

**Nota sobre (b), añadida en la segunda pasada:** "qué cambió desde ayer" y (e) "qué aprendió LUZ recientemente" comparten la misma fuente de datos — memorias nuevas con señal real de comprensión. Por eso (b) no tiene un bloque visual propio en el wireframe (4.1): se responde con la misma tarjeta "Hoy entendí" y, cuando aplica, la `continuityLine`. Son 6 preguntas respondidas por 5 bloques visuales, no 5 preguntas — evita duplicar la misma información en dos lugares del Dashboard.

### 3.2 Life

```
Nav → Life
  1. Vista general: cuatro franjas — Goals, Projects, Habits, Relationships — tarjetas, no tabla administrativa
  2. Cada tarjeta puede mostrar memorias relacionadas — mecanismo: búsqueda literal del título de la entidad
     dentro de Memory.content (StructuredMemoryRetrievalStrategy, ya real, mismo query que usa el chat) —
     NO es un vínculo semántico; solo encuentra memorias que contienen el texto exacto del título (ver 3.2.1)
  3. Timeline: cronológico, construido a partir de Memoria (occurredAt), no de LifeEvent (no persiste)
  4. Tocar una tarjeta → vista de detalle de solo lectura, sin formularios de edición
```

#### 3.2.1 Límite explícito del vínculo Memoria↔Life (corregido en v2.0)

`Memory` no tiene ninguna columna que referencie a `Goal`/`Project`/`Habit` — no hay `goalId`, `projectId` ni `habitId` en el esquema de memoria. Por eso el único vínculo disponible en V1 es textual: `retrieve(context, { text: entity.title })`. Esto significa, con honestidad: un Goal titulado "Maratón" solo encuentra memorias que contienen literalmente la palabra "maratón" — **no** encuentra "empecé a entrenar para una media 21k" si esa frase no incluye el título. Es una capacidad real y verificable, pero deliberadamente limitada. El vínculo por significado (que sí encontraría ambas) es `Future`, depende de retrieval semántico — no se simula aquí con una heurística de texto más compleja, para no prometer más de lo que el mecanismo puede sostener.

### 3.3 Memories

```
Nav → Memories
  1. Agrupadas por tiempo (Hoy / Esta semana / Este mes / Más atrás) — Memory.occurredAt, ya real
  2. Buscador de texto libre — llama directo a StructuredMemoryRetrievalStrategy (ya real)
  3. Cada memoria muestra: contenido, tipo, conexiones a otras memorias (MemoryConnection, ya real) y,
     si el título de un Goal/Project aparece literalmente en el texto, el mismo vínculo textual de 3.2.1
  4. Sin edición en V1
```

### 3.4 Learning (aprendizaje visible)

```
Disparador: al abrir Dashboard, memorias de hoy con rank.score >= MIN_SCORE_WITH_UNDERSTANDING_SIGNAL
  cuyo estado en seen_prompts (subjectType='memory_learning') todavía no exista para hoy (Sección 5.3)
  1. Tarjeta "Hoy entendí:" con hasta 3 líneas (ej. "✓ Quieres correr una media maratón")
  2. Cada línea: [Aceptar] [Editar] [Descartar]
     - Aceptar   → seen_prompts.status = 'accepted'; memory.status no cambia
     - Editar    → seen_prompts.status = 'edited'; ver 3.4.1 (reclasificar + rerankear)
     - Descartar → confirmación primero ("Esto hará que LUZ deje de usar este recuerdo en conversaciones
                    y búsquedas. ¿Descartar de todas formas?") → si se confirma: seen_prompts.status =
                    'dismissed' Y memory.status = 'archived'
  3. Si no hay memorias nuevas con señal real hoy, la tarjeta no existe
```

**Efecto real de Descartar, documentado explícitamente (nuevo en v2.0):** `StructuredMemoryRetrievalStrategy` filtra duro por `status: 'active'` — una memoria archivada deja de ser recuperable en el chat, en Reality Snapshot y en Memories, no solo en la tarjeta de Learning. Es una acción de alcance amplio, no cosmética, por eso lleva confirmación explícita. **Recuperación: fuera de alcance del Alpha** (Sección 1.4) — si el Founder pide poder deshacer un descarte, es un cambio de alcance explícito para una iteración futura, no algo que esta versión resuelve en silencio.

#### 3.4.1 Editar, especificado (nuevo en v2.0)

Al guardar una edición sobre `memory.content`:
1. Re-ejecutar `DeterministicMemoryClassifier` sobre el texto nuevo → nuevo `memory.type`.
2. Re-ejecutar `DeterministicMemoryRankingStrategy` sobre el registro actualizado → nuevo `rank.score`.
3. `MemoryRepository.save()` con el contenido, tipo y rank actualizados.

Las tres son invocaciones repetidas de clases que ya corren hoy dentro de `capture()` — no se escribe lógica de clasificación ni de ranking nueva, solo se vuelven a invocar sobre el texto editado.

### 3.5 Conversación — Objetivo 5: uso natural de Life/Memoria

```
/chat (ya existe, mejorado)
  - Todo el comportamiento actual se mantiene intacto
  - Nuevo: FavorLifeContinuityRule — aplica solo si RealitySnapshot.life tiene algo activo relevante
    al turno actual y no se mencionó ya en esta conversación (mismo patrón que favor-continuity-rule.ts
    ya usa para memoria)
```

Este objetivo es sobre **qué datos** puede usar una respuesta cualquiera (Life además de Memoria). Es distinto del Objetivo 6 (Sección 3.6), que es sobre **momentos específicos** de la conversación — reabrir, seguir un hilo abierto, reconocer un cierre — independientemente de qué dato se use.

### 3.6 Conversación — Objetivo 6: experiencia conversacional completa (nuevo en v2.0, antes implícito)

El Epic pide, explícitamente y por separado del Objetivo 5: continuidad, seguimiento, cierres, reducción de repetición, sensación de acompañamiento. v1.0 lo colapsó dentro de un sprint de "pulido" sin diseño propio — esta sección lo corrige.

**Continuidad (reabrir una conversación).** Ya existe el banner "retomando una conversación de hace N días" (`isHistoricalConversation`). Mejora: reutilizar la misma `continuityLine` que ya se calcula para el Dashboard (misma memoria de mayor rank, mismo texto) como primera línea al reabrir — un solo cálculo, dos superficies, sin lógica nueva.

**Seguimiento (`FollowUpOnOpenLoopRule`, nueva) — corregida en la segunda pasada.** El primer borrador de esta revisión la definía sobre "una intención sin resolver" — no verificable: nada en el sistema puede determinar si una intención "se resolvió". Versión corregida: aplica cuando la persona **inicia una conversación nueva** (`input.conversation` vacío o con muy pocos turnos — mismo dato que la regla ya puede observar hoy) y existe una `Memory` tipo `intention` que la capa de aplicación ya filtró por **no tener todavía** un registro en `seen_prompts` (`subjectType='intention_followup'`). Al aplicarse, la capa de aplicación marca ese registro como visto, para no repetir el mismo seguimiento en cada conversación nueva futura. La regla en sí sigue siendo una función pura sobre datos ya preparados — igual que las 6 reglas existentes, nunca hace su propia consulta a la base de datos; el filtrado por `seen_prompts` ocurre antes, en la capa de aplicación.

**Cierres (`AcknowledgeClosureRule`, nueva) — corregida en la segunda pasada.** El primer borrador la definía sobre "desde la última vez que se mencionó en una conversación" — tampoco verificable con los datos disponibles dentro de una regla. Versión corregida, mismo patrón que la anterior: aplica cuando `input` incluye un `Goal`/`Project` con `status='completed'` que la capa de aplicación ya filtró por no tener todavía un registro en `seen_prompts` (`subjectType='goal_closure'`). Reconoce el cierre de forma específica, no un "felicidades" genérico — con el límite honesto ya nombrado en Sección 1.4: sin representación de "arco", el reconocimiento es del hecho (se completó), no de la narrativa completa detrás.

**Reducción de repetición — regla de prioridad, no una regla nueva.** Si en un mismo turno podrían aplicar varias reglas de referencia (`FavorLifeContinuityRule`, `FollowUpOnOpenLoopRule`, `AcknowledgeClosureRule`, `favor-continuity-rule` de memoria), se aplica como máximo **una** por respuesta, con esta prioridad fija: cierre reciente > seguimiento de intención abierta > continuidad de vida activa > continuidad de memoria general. Es una condición añadida a `applies()` de cada regla nueva, no un mecanismo independiente — existe para que `FavorBrevityRule` (ya real, ya con precedencia sobre todo lo demás) nunca tenga que competir con dos o tres referencias inyectadas en la misma respuesta.

**Sensación de acompañamiento.** No es una pieza más — es el resultado agregado de lo anterior sostenido en el tiempo, evaluado contra el Principio 8 (`PRESENCE_PRINCIPLES.md`, "trust compounds over years, not from one moment"): el criterio de aceptación de este Epic no es una conversación memorable, es que mil conversaciones ordinarias sean, cada una, un poco más honestas y bien calibradas.

---

## 4. Wireframes

No pixel-perfect — estructura y jerarquía de información. Mismo orden que la Sección 3.

### 4.1 Dashboard V2

```
┌──────────────────────────────────────────────────────┐
│  [Nav: Dashboard · Life · Memories · Conversación]      │
├──────────────────────────────────────────────────────┤
│  Buenos días, Juan.              Martes, 22 de julio   │
│                                                          │
│  ┌────────────────────────────────────────────────┐   │
│  │  "Ayer mencionaste que la entrevista es el       │   │  ← continuityLine, ya real
│  │   jueves — ¿cómo te sientes con eso?"            │   │
│  └────────────────────────────────────────────────┘   │
│                                                          │
│  ┌─ Hoy entendí ──────────────────────────────────┐    │  ← SOLO si hay learning nuevo
│  │  ✓ Empezaste a aprender alemán      [✓][✎][✕]  │    │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  Objetivos activos                                       │
│  ┌───────────┐ ┌───────────┐                            │
│  │ Maratón   │ │ Alemán    │                             │
│  │ en 3 sem. │ │ A2 → B1   │                             │
│  └───────────┘ └───────────┘                             │
│                                                          │
│  Próximos a vencer (14 días)                              │
│  · Proyecto "Cambio de carrera" — dueDate en 9 días       │
│                                                          │
│  Conversaciones recientes                                 │
│  · Hace 2 días — "hablamos de la entrevista"  [continuar] │
│                                                          │
│  [ Hablar con LUZ ]                                       │
└──────────────────────────────────────────────────────┘
```

### 4.2 Life

```
┌──────────────────────────────────────────────────────┐
│  [Nav]  Life                                            │
├──────────────────────────────────────────────────────┤
│  Goals                                                    │
│  ┌───────────┐ ┌───────────┐                            │
│  │ Maratón   │ │ Cambio de │                            │
│  │ ● activo  │ │ carrera   │                            │
│  └───────────┘ └───────────┘                            │
│                                                          │
│  Projects        Habits         Relationships             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐               │
│  │ ...     │    │ ...     │    │ Verónica│               │
│  └─────────┘    └─────────┘    └─────────┘               │
│                                                          │
│  Timeline (fuente: Memoria) ───────────────────────        │
│  │ hoy     · "empecé a aprender alemán"                    │
│  │ hace 3d · "corrí el maratón de prueba, 15km"             │
└──────────────────────────────────────────────────────┘

Detalle (tocar "Maratón"):
┌──────────────────────────────────────────────────────┐
│  ← Life          Maratón                    ● activo    │
├──────────────────────────────────────────────────────┤
│  Meta: correr 21km — fecha objetivo: en 3 semanas         │
│                                                          │
│  Memorias que mencionan "Maratón" literalmente             │  ← título honesto, no "relacionadas"
│  · "corrí el maratón de prueba, 15km" — hace 3 días        │
│    (búsqueda por texto — memorias sobre el tema que no      │
│     usan esta palabra no aparecen aquí, ver 3.2.1)          │
└──────────────────────────────────────────────────────┘
```

### 4.3 Memories

```
┌──────────────────────────────────────────────────────┐
│  [Nav]  Memories            [ 🔍 Buscar... ]             │
├──────────────────────────────────────────────────────┤
│  Hoy                                                       │
│  · "empecé a aprender alemán"                    [fact]    │
│                                                          │
│  Esta semana                                               │
│  · "corrí el maratón de prueba, 15km"         [pattern]    │
│    ⟶ conectada con: "empecé a entrenar para el maratón"     │
│    ⟶ menciona: Goal "Maratón"                                │
│                                                          │
│  Más atrás                                                 │
│  · ...                                                     │
└──────────────────────────────────────────────────────┘
```

### 4.4 Learning — Descartar con confirmación (nuevo en v2.0)

```
┌──────────────────────────────────────────────────────┐
│  ¿Descartar este recuerdo?                                │
│                                                          │
│  "Empezaste a aprender alemán"                             │
│                                                          │
│  Esto hará que LUZ deje de usar este recuerdo en           │
│  conversaciones y búsquedas. No se puede deshacer.         │
│                                                          │
│              [ Cancelar ]      [ Sí, descartar ]           │
└──────────────────────────────────────────────────────┘
```

### 4.5 Conversación — Objetivo 5 (referencia natural)

```
┌──────────────────────────────────────────────────────┐
│  Retomando una conversación de hace 3 días  [Nueva]      │
├──────────────────────────────────────────────────────┤
│                              Hola LUZ, ¿cómo estás?  [tú]  │
│  [LUZ]  Bien. La última vez hablamos de tu entrevista      │
│         del jueves — ¿cómo salió?                          │
├──────────────────────────────────────────────────────┤
│  [ Escribe algo... ]                              [→]      │
└──────────────────────────────────────────────────────┘
```

### 4.6 Conversación — Objetivo 6 (seguimiento y cierre, nuevo en v2.0)

```
Escenario A — nueva conversación, hay una intención sin resolver:
┌──────────────────────────────────────────────────────┐
│                                       Hola LUZ    [tú]     │
│  [LUZ]  Hola. Antes de seguir — la última vez               │
│         mencionaste que ibas a hablar con tu jefe            │
│         sobre el cambio de puesto. ¿Cómo quedó?              │
└──────────────────────────────────────────────────────┘

Escenario B — un Goal se completó desde la última conversación:
┌──────────────────────────────────────────────────────┐
│  [LUZ]  Vi que terminaste el maratón. Eso fue un             │
│         objetivo real, no solo una tarea — me alegra          │
│         que lo cerraras.                                      │
└──────────────────────────────────────────────────────┘
```

---

## 5. Componentes

### 5.1 Nuevos (UI)

| Componente | Propósito | Reutiliza |
|---|---|---|
| `<AppShell>` / `<NavBar>` | Navegación persistente: Dashboard · Life · Memories · Conversación (cuatro, no cinco) | Nada existente |
| `<LifeCard>` | Tarjeta de Goal/Project/Habit/Relationship | `LifeStateItem`; entidades de `core/life` para detalle |
| `<LifeDetailView>` | Vista de solo lectura + memorias por título literal (3.2.1) | `core/life` repos, `StructuredMemoryRetrievalStrategy` |
| `<LifeTimeline>` | Línea cronológica desde Memoria | `MemoryRepository.list` por `occurredAt` |
| `<MemoryCard>` | Memoria individual, tipo, conexiones | `Memory`, `MemoryConnection` |
| `<MemorySearchBar>` | Búsqueda de texto libre | `MemoryQuery.text` |
| `<LearningCard>` | "Hoy entendí" con aceptar/editar/descartar + confirmación de descarte | `Memory.status`, `MemoryRepository.save`, `seen_prompts` (5.3) |
| `<DashboardQuestionSection>` | Bloque reutilizable para las 6 preguntas del Dashboard — 5 bloques visuales, porque (b) y (e) comparten datos y no se duplican (ver nota en 3.1) | `DashboardSummary`, `MorningBrief`, `RealitySnapshot.life` |
| Tokens de diseño (`@theme`) | Paleta, tipografía, espaciado propios | Extiende las 2 variables CSS actuales |

### 5.2 Nuevos (servicios de aplicación — corregido en v2.0)

| Servicio | Vive en | Envuelve |
|---|---|---|
| `listAllGoals/Projects/Habits/Relationships` | `features/life/services/` | `core/life` repos (junto a `listActive*`, mismo patrón) |
| `getUpcomingDeadlines(db, context, {withinDays})` | `features/life/services/` | Goal/Project filtrando `targetDate`/`dueDate` |
| `searchMemories(db, context, {text, groupByTime})` | `features/memories/services/` | `MemoryRepository` + `StructuredMemoryRetrievalStrategy` |
| `getTodaysLearnings(db, context)` | `features/dashboard/services/` | `MemoryRepository.list` + `MIN_SCORE_WITH_UNDERSTANDING_SIGNAL` + `seen_prompts` |
| `findMemoriesMentioning(db, context, {title})` | `features/life/services/` (usado también por Memories) | `StructuredMemoryRetrievalStrategy` con `text: title` |

Ninguna pantalla nueva llama a `core/` directamente desde `app/` — todas pasan por un servicio de aplicación en `features/`, igual que `build-dashboard-summary.ts` y `build-morning-brief.ts` ya hacen hoy. `/admin` y `/conversations` siguen siendo la excepción histórica del repo, no el patrón a seguir.

### 5.3 Mecanismo único de estado — `seen_prompts` (nuevo en v2.0)

Reemplaza los tres mecanismos implícitos de v1.0 ("memoria ya mostrada", "estado vacío solo la primera vez", "aceptado en Learning") por uno solo, genérico y reutilizable.

**Tabla nueva, pequeña:** `seen_prompts { id, lifeGraphId, subjectType, subjectId, status: 'seen'|'accepted'|'edited'|'dismissed', firstSeenAt, respondedAt? }`.

**Repositorio delgado:** `getState(subjectType, subjectId)`, `markSeen(...)`, `setStatus(...)` — mismo patrón de interfaz + implementación Drizzle que cualquier otro repositorio del proyecto, no una excepción.

**Usos concretos:**
- Learning: `subjectType='memory_learning'`, `subjectId=memory.id`.
- Estados vacíos del Dashboard: `subjectType='dashboard_empty:<bloque>'`, `subjectId=lifeGraphId`.
- Seguimiento conversacional (Objetivo 6, 3.6): `subjectType='intention_followup'`, `subjectId=memory.id`.
- Reconocimiento de cierres (Objetivo 6, 3.6): `subjectType='goal_closure'`, `subjectId=goal.id` (o `project.id`).
- Cualquier prompt similar futuro reutiliza la misma tabla sin diseño nuevo.

### 5.4 Reutilizados sin cambios

`ErrorState`, `Skeleton`, las 6 `ConversationRule` existentes, el composer y su manejo de safe-area iOS, el parser SSE, `draft-storage.ts`, `generate-title.ts`, `build-dashboard-summary.ts`, `build-morning-brief.ts`, `assembleRealitySnapshot`, los 5 repositorios Drizzle de `core/life`, `MemoryRepository` completo, `DeterministicMemoryClassifier`, `DeterministicMemoryRankingStrategy`.

---

## 6. Integración

Regla que gobierna esta sección: **no duplicar lógica**, y ahora también: **no saltarse la capa de aplicación**.

```
                    ┌─────────────┐
                    │  Life Graph │  (contenedor, ADR-0011 — sin cambios)
                    └──────┬──────┘
                           │ lifeGraphId
        ┌──────────────────┼───────────────────┐
        ▼                  ▼                    ▼
 core/life repos    Memory Engine        (Context Engine — sin usar,
        │            (capture/rank/       sin cambios)
        │             connect/retrieve)
        └─────────┬─────────┘
                   ▼
        assembleRealitySnapshot()          ← YA EXISTE, sin tocar (ADR-0013)
        (features/chat/services)
                   │
                   ▼
             Context Builder
       (6 reglas existentes +
        FavorLifeContinuityRule,
        FollowUpOnOpenLoopRule,
        AcknowledgeClosureRule —
        con exclusión mutua, 3.6)
                   │
                   ▼
             Respuesta de LUZ


 core/life repos ──► features/life/services/*      ──► app/life, <LifeDetailView>
 core/memory-engine ► features/memories/services/*  ──► app/memories, <MemoryCard>
                     features/dashboard/services/*  ──► app/dashboard (incluye getTodaysLearnings)
                     (nuevo) seen_prompts repo       ──► usado por dashboard y learning services

 Ninguna pantalla de solo lectura pasa por RealitySnapshot — ese contrato es
 para ensamblar el prompt de IA (ADR-0013), no para servir una pantalla.
```

**Puntos de integración explícitos:**

- **Dashboard V2** consume `build-dashboard-summary.ts` y `build-morning-brief.ts` sin cambiar su forma, más `getUpcomingDeadlines` y `getTodaysLearnings` (Sección 5.2).
- **Life** y **Memories** llaman a `features/life/services` y `features/memories/services` respectivamente — nunca directo a `core/` (corregido en v2.0). No pasan por `RealitySnapshot`.
- **Conversación** toca el Context Builder únicamente por su punto de extensión ya existente (`conversation-rules/index.ts`): tres reglas nuevas (`FavorLifeContinuityRule`, `FollowUpOnOpenLoopRule`, `AcknowledgeClosureRule`) con exclusión mutua entre sí (Sección 3.6) — ninguna de las 6 reglas existentes se modifica.
- **Extensión del input de las reglas (precisado en la segunda pasada):** `ConversationRuleInput` gana un campo adicional `life` (Goal/Project/intenciones ya filtrados por `seen_prompts` en la capa de aplicación, antes de llegar a la regla) — aditivo y retrocompatible: las 6 reglas existentes lo ignoran y no cambian. Ninguna regla, nueva o existente, hace su propia consulta a la base de datos — ese patrón (reglas puras sobre datos ya preparados) se mantiene sin excepción; todo el filtrado por `seen_prompts` vive en la capa de aplicación, no dentro de `applies()`/`directive()`.
- **Learning** escribe a través de `MemoryRepository.save()` (existente) y del nuevo repositorio de `seen_prompts` (Sección 5.3) — ninguna otra tabla nueva.
- **Nada de esto activa `core/knowledge-engine` ni repara `core/knowledge`** — fuera de alcance, sin cambios respecto a v1.0.

---

## 7. Riesgos

### Resueltos en esta revisión (v2.0)

- Mecanismo de "visto/aceptado/descartado" fragmentado → unificado en `seen_prompts` (5.3).
- Efecto de "Descartar" no documentado → documentado, con confirmación, recuperación explícitamente fuera de alcance.
- "Editar" sin reclasificar/rerankear → especificado (3.4.1).
- Llamada directa `app/` → `core/` sin capa de aplicación → corregida (`features/life/services`, `features/memories/services`).
- Vínculo Memoria↔Life prometido de forma vaga → redefinido como búsqueda literal, con su límite declarado; vínculo semántico marcado `Future`.
- "Necesita seguimiento" dependía de datos inexistentes → reconstruido sobre `targetDate`/`dueDate` reales.
- Inconsistencia "cuatro vs. cinco" secciones de navegación → corregida a cuatro en todo el documento.
- Objetivo 6 sin diseño propio → Secciones 3.6, 4.6, y Sprint 7 dedicado (Sección 8).
- (Segunda pasada) "5 preguntas" contradecía las 6 que el propio Dashboard define → corregido: son 6 preguntas, 5 bloques visuales (3.1, 5.1).
- (Segunda pasada) `FollowUpOnOpenLoopRule`/`AcknowledgeClosureRule` dependían de una señal no verificable ("¿ya resuelto?", "¿ya mencionado?") → reescritas sobre `seen_prompts`, manteniendo las reglas como funciones puras (3.6, 5.3, 6).

### Producto

- **Learning visible puede sentirse invasivo si se sobre-activa.** Mitigación: `rank.score >= MIN_SCORE_WITH_UNDERSTANDING_SIGNAL`, máximo una vez por día por memoria (vía `seen_prompts`).
- **Vida como "arco" sigue sin resolverse** (declarado explícitamente en 1.4, no un vacío accidental).

### UX

- **Life y Memories siguen solapándose en V1** (Life muestra memorias por título; Memories muestra el mismo vínculo desde el otro lado). Se mantiene como riesgo aceptado, no resuelto en esta revisión — el Founder no pidió fusionar ni recortar ninguna de las dos, y esta revisión se limitó a los 9 cambios solicitados. Queda nombrado para una futura decisión de alcance, no una recomendación de este documento.
- **Tres reglas conversacionales nuevas compitiendo por el mismo turno** — mitigado por la regla de prioridad/exclusión mutua (3.6), pero es un mecanismo que debe verificarse con conversaciones reales, no solo con la lógica en el papel.

### Técnicos

- **`seen_prompts` es una tabla nueva** — pequeña, genérica, aditiva; no es un cambio de arquitectura, pero sí requiere su propia migración Drizzle, a incluir en el Sprint de Learning (no antes).
- **`getTodaysLearnings`/`getUpcomingDeadlines` sin índice sobre `lifeGraphId` + fecha** pueden degradar con volumen — bajo riesgo al tamaño actual del Alpha, verificar antes de Beta.
- **`listAllGoals/Projects/Habits` sin paginación** — mismo riesgo, misma mitigación.
- **`findMemoriesMentioning` es una búsqueda `ILIKE` simple** — sensible a mayúsculas/tildes si no se normaliza; verificar contra datos reales antes de confiar en el ejemplo de "Maratón" del wireframe.
- **Ninguna pantalla nueva tiene contrato de error/loading definido más allá de `ErrorState`/`Skeleton`** — construir desde el día 1 de cada sprint.

---

## 8. Roadmap — sprints de 1-2 días (reordenado en v2.0)

**Sprint 1 — Shell de navegación + fundación de identidad visual (1-2d).** Sin cambios respecto a v1.0.

**Sprint 2 — Dashboard V2 (1-2d).** Igual que v1.0, con la corrección de 3.1(d): usa `getUpcomingDeadlines` (real), no un registro de hábitos inexistente.

**Sprint 3 — Life, solo lectura (1-2d).** Incluye `features/life/services` (5.2) y el límite declarado de 3.2.1.

**Sprint 4 — Memories (1-2d).** **Movido antes que Learning (antes Sprint 5, ahora Sprint 4) — cambio de orden respecto a v1.0, ver razonamiento en Sección 10.** Incluye `features/memories/services`.

**Sprint 5 — Learning visible (1-2d).** **Movido después de Memories.** Incluye la tabla `seen_prompts` (primera vez que se necesita en el roadmap), la confirmación de Descartar, y la especificación de Editar (3.4.1).

**Sprint 6 — Conversación, Objetivo 5 (1-2d).** `FavorLifeContinuityRule` únicamente. Sin cambios de alcance respecto a v1.0, solo de numeración.

**Sprint 7 — Conversación, Objetivo 6 (1-2d, nuevo en v2.0).** `FollowUpOnOpenLoopRule`, `AcknowledgeClosureRule`, la regla de prioridad/exclusión mutua entre las tres reglas nuevas, y la reutilización de `continuityLine` al reabrir una conversación. Antes vivía, sin diseño propio, dentro de un "Sprint 7 de pulido" de v1.0.

**Sprint 8 — Pulido visual del chat (1-2d).** Aplicar los tokens del Sprint 1 a burbujas/composer/estados — depende de Sprint 1 únicamente, puede reordenarse con más libertad que el resto si hace falta, pero se deja al final por continuidad narrativa del roadmap.

---

## 9. Momentos WOW

*(Sin cambios de fondo respecto a v1.0; WOW 5 se actualiza para nombrar las reglas concretas del Objetivo 6.)*

### WOW 1 — "La línea que te reconoce", ahora explicable
*(sin cambios)*

### WOW 2 — "Hoy entendí"
*(sin cambios de fondo; la acción "Descartar" que este momento habilita ahora lleva confirmación, ver 3.4)*

### WOW 3 — "Tu vida en un lugar"
*(sin cambios)*

### WOW 4 — "La memoria que conecta sola"
*(sin cambios — se apoya solo en `MemoryConnection` real, memoria↔memoria, nunca en el vínculo textual Memoria↔Life de 3.2.1)*

### WOW 5 — "LUZ lo recordó sin que lo pidiera" (actualizado en v2.0)

**Qué ocurre:** en medio de una conversación, LUZ menciona con naturalidad un Goal/Hábito activo (`FavorLifeContinuityRule`), retoma una intención sin resolver (`FollowUpOnOpenLoopRule`) o reconoce que algo se cerró (`AcknowledgeClosureRule`) — nunca más de una de las tres en la misma respuesta (regla de prioridad, 3.6).
**Por qué sorprende:** es el salto de "chatbot que responde" a "presencia que acompaña la vida".
**Qué datos:** `RealitySnapshot.life`, memorias tipo `intention`, cambios de `status` en Goal/Project.
**Qué sistemas:** Context Builder — tres reglas nuevas, mismo mecanismo que las 6 existentes.
**Por qué representa la visión de LUZ:** valida, con una persona real, la hipótesis original del proyecto.

---

## 10. Recomendación de orden óptimo (reescrita en v2.0)

**El principio no cambia: cada sprint debe reducir el riesgo del siguiente, no solo entregar valor en el orden más fácil.** Lo que cambia es la posición de Memories/Learning y la aparición de dos sprints propios para el Objetivo 6.

1. **Shell + identidad primero** — infraestructura de UI sin lógica de negocio, riesgo mínimo, bloquea todo lo demás por navegación.

2. **Dashboard V2 segundo** — mayor apalancamiento del roadmap: datos que ya son reales desde antes de este Epic (Sección 0.1), cero backend nuevo tras la corrección de 3.1(d).

3. **Life tercero** — misma base de datos que Dashboard ya validó, agrega la capa de servicios (`features/life/services`) que Memories reutilizará parcialmente (`findMemoriesMentioning`).

4. **Memories cuarto, antes que Learning — cambio explícito respecto a v1.0.** Razón: Memories es de solo lectura; Learning es la primera pieza del Epic que puede mutar memoria real de forma permanente (Descartar → `archived`, invisible en todo el sistema). Ver el panorama completo de memorias — cómo se agrupan, cómo se conectan, qué contienen — **antes** de dar un control que puede archivarlas es el orden de menor riesgo. Construir Learning primero significaría dar ese control sin haber validado todavía, con el Founder como usuario real, que la representación de memoria (agrupación, búsqueda, conexiones) es correcta.

5. **Learning quinto.** Ya apoyado en `seen_prompts`, en la confirmación de Descartar, y en haber visto Memories funcionar primero.

6. **Conversación — Objetivo 5, sexto.** Toca el Context Builder, la superficie más usada por usuarios reales a diario — deliberadamente después de que Life/Memoria ya se validaron como pantallas correctas.

7. **Conversación — Objetivo 6, séptimo.** Depende de que el Objetivo 5 ya haya probado el patrón de "una regla nueva en el Context Builder" en producción antes de añadir dos reglas más y la lógica de exclusión mutua entre ellas — reduce el riesgo de introducir las tres a la vez.

8. **Pulido visual del chat, último.** Depende de los tokens (Sprint 1) y de que las reglas conversacionales (Sprints 6-7) ya existan para aplicarles la identidad visual con contenido real, no de relleno.

**Qué maximiza este orden:** valor visible desde el segundo sprint, con el riesgo creciendo gradualmente — de "cero lógica de negocio" a "una acción permanente sobre memoria real" (Sprint 5) a "toca el chat en producción" (Sprints 6-7) — y con el Objetivo 6 finalmente tratado como el cuerpo de trabajo propio que el Epic pedía, no como una nota al final de otro sprint.
