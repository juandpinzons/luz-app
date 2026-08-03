# Investigación: LUZ no recordó un valor declarado el día anterior

Fecha: 2026-08-02\
Método: `docs/engineering/TECHNICAL_INVESTIGATION_METHODOLOGY_V1.md`\
Disparador: el Founder reportó un caso real -- declaró un valor para un
mismo hecho un día, un valor distinto al día siguiente, y **LUZ** (no
"Knowledge", no "el Knowledge Engine") no recordó/referenció el valor de
ayer en la conversación de hoy.

**Corrección de rumbo, misma fecha, antes de tener ningún dato real.**
La primera versión de este documento partía de una hipótesis "favorita"
(`rank_score >= 45`, heredada de tres investigaciones previas del mismo
día sobre un consumidor DISTINTO -- el Knowledge Engine asíncrono) antes
de establecer un solo hecho sobre ESTE caso. Eso es exactamente el sesgo
de confirmación que el método existe para prevenir: una explicación
disfrazada de observación. Se descarta esa versión. La pregunta real de
investigación no es "¿otra vez es el gate de rank_score?" -- es **¿en
qué punto exacto del recorrido mensaje → memoria → recuperación →
contexto → prompt → respuesta desapareció el valor de ayer?** Determinar
DÓNDE es el objetivo de esta ronda. Determinar POR QUÉ (¿es rank_score,
es otra cosa?) solo tiene sentido después, y solo si la evidencia
efectivamente señala hacia la etapa donde ese mecanismo vive.

**Estado: CERRADA.** Retomada por un segundo colaborador con acceso de
lectura real a Postgres de producción (Neon, vía `console.neon.tech`,
mismo bloqueo que esta sesión ya había documentado), a pedido explícito
del Founder ("Retoma la sesión y finaliza el incidente reportado").
El caso real: el Founder reportó "95.000 agosto 1, 495.000 agosto 2" —
el hecho concreto en producción resultó ser tres montos el 1 de agosto
(30.000 + 55.000 + 26.000 = 111.000, no un solo 95.000 — recuerdo
aproximado del Founder, el incidente es el mismo) y 495.000 el 2 de
agosto, confirmado exacto. Secciones 1, 2, 5, 6 y 7 completadas abajo
con datos y código reales, seguido el plan de la Sección 3-4 tal como
estaba, sin reabrir hipótesis ya cerradas por ese plan. Ninguna línea
de código de producción se ha modificado.

---

## 1. Observaciones (sobre el caso real)

- **O1.** El mensaje real del 1 de agosto (`conversation_messages.id
  = 56548e12-8715-49de-9a26-e0b9675976fd`, `created_at =
  2026-08-02T02:04:02Z`, que en hora de Bogotá es la noche del 1 de
  agosto -- consistente con que el propio mensaje empiece "Hoy gasté"):
  *"Hoy gasté plata de la siguiente manera: 30.000 helado con vero +
  55.000 hamburguesa para mi + 26.000 aplastado para verónica. Voy a
  enviarte día a día lo que me gasté para llevar control de agosto
  financieramente."*
- **O2.** Ese mensaje SÍ generó una fila `Memory` real:
  `id = 3df73a85-316d-43a2-9d5d-95545b735d7c`, contenido idéntico
  palabra por palabra, `source_id` igual al id del mensaje de O1,
  `rank_score = 19`, `type = intention`, `status` activo.
- **O3.** El mensaje real del 2 de agosto que disparó el incidente
  (`conversation_messages.id = e718fa18-6eac-4612-a85b-f3d82314aa5b`,
  `created_at = 2026-08-02T20:53:46Z`): *"Acabo de gastarme 495.000 en
  mercado para la casa, cuanto llevo ya? 2 de agosto."* También generó
  una `Memory` real (`4d63b03a-d19c-48b4-8211-844f0fa37e87`,
  `rank_score = 19`, `type = fact`).
- **O4.** La respuesta real de LUZ a ese mensaje (misma fila de
  `conversation_messages`, rol `assistant`, `created_at =
  2026-08-02T20:53:52Z`): reconoce los 495.000 del 2 de agosto, no
  menciona ni suma el monto del 1 de agosto.
- **O5.** El Founder insiste, en el mismo intercambio real
  (`created_at = 2026-08-02T20:54:10Z`): *"Ayer te dije cuánto me
  gasté 1 de agosto."* Esto también generó su propia fila `Memory`
  (`de9cbaaa-2b21-49d9-b7ab-3a6895c97f8f`, `rank_score = 19`).
- **O6 — la respuesta real de LUZ que confirma el fallo, palabra por
  palabra** (`created_at = 2026-08-02T20:54:12Z`): *"Sí, lo recuerdo,
  pero no me guardo montos exactos como una app de gastos. Llevamos: 1
  de agosto: lo que me dijiste ayer. 2 de agosto: 495.000 de mercado.
  Si me repites el valor del 1 de agosto, te ayudo a llevar la suma
  desde hoy para adelante."* LUZ afirma recordar que la conversación
  ocurrió, pero no tiene el valor numérico -- exactamente la
  distinción entre H2/H3 (candidata perdida) y H1 (nunca capturada)
  que la Sección 3 ya anticipaba, resuelta a favor de la segunda por
  esta misma frase: si nunca hubiera existido ninguna huella, LUZ no
  tendría por qué saber que "el 1 de agosto" es un día sobre el que se
  le dijo algo.
- **O7 (E2 real, no reconstrucción).** Se corrió
  `selectContextualMemories` (código real, sin modificar) con el
  mensaje real de O3 como `currentMessage`, contra la cuenta real del
  Founder. La memoria de O2 (el gasto del 1 de agosto) **sí aparece**
  entre los 5 candidatos devueltos, en la cuarta posición.
- **O8 (E3 real, no reconstrucción).** Se corrió
  `assembleRealitySnapshot` completo (código real, sin modificar) con
  el mismo mensaje real. `snapshot.memory.items` final contiene
  **2 elementos, ninguno es la memoria del 1 de agosto** -- ambos son
  la misma memoria duplicada de la investigación de esta mañana
  (`rank_score` ausente en el snapshot porque son las de mayor rank
  del sistema, no relacionadas en absoluto con gastos). La memoria de
  O2 fue filtrada entre O7 y O8.
- **O9.** El punto exacto donde desaparece: `assembleRealitySnapshot`
  (`features/chat/services/assemble-reality-snapshot.ts:226-228`) filtra
  `relevantMemories` (que sí incluye la memoria de O2, según O7) por
  `rank.score >= MIN_SCORE_WITH_UNDERSTANDING_SIGNAL` (45). La memoria
  del 1 de agosto tiene `rank_score = 19`. No sobrevive el filtro. No
  hay ninguna otra etapa entre la salida real de `selectContextualMemories`
  (O7) y `snapshot.memory.items` (O8) más que ese único filtro.

---

## 2. Mediciones

| Métrica | Valor |
|---|---|
| `rank_score` de la memoria del 1 de agosto | 19 |
| Umbral que exige `assembleRealitySnapshot` para incluirla | 45 |
| Posición en los candidatos de `selectContextualMemories` (de 5) | 4ª (presente) |
| Presente en `snapshot.memory.items` final | No |
| Memorias que sí sobrevivieron ese filtro, mismo turno real | 2 (ninguna sobre gastos) |

---

## 3. Hipótesis -- ¿en qué etapa desapareció el dato?

Cinco hipótesis, mutuamente no excluyentes en principio pero
ordenables: el dato solo puede desaparecer en la primera etapa donde
realmente falla, así que se evalúan en orden y la investigación se
detiene en la primera que se confirma (según el método: "no optimizar
ningún componente sin haber demostrado, con un experimento, que es
realmente el cuello de botella"). Ninguna asume un mecanismo interno
todavía -- cada una es sobre DÓNDE, no sobre POR QUÉ.

**H1 -- Nunca se capturó.** La declaración de ayer nunca se convirtió en
una fila `Memory` en absoluto (falla de captura, o el mensaje nunca
llegó a `MemoryEngine.capture()` por alguna otra razón -- p. ej.
`lifeGraphContext` ausente esa sesión).
*Falsable por*: si existe una fila `Memory` real cuyo `content`/
`occurredAt`/`sourceId` corresponde a la declaración de ayer, H1 queda
refutada.

**H2 -- Se capturó pero nunca se recuperó.** La fila existe, pero el
mecanismo de recuperación para el mensaje de hoy (el que sea que
resulte ser -- no se asume cuál) nunca la trae de vuelta como candidata.
*Falsable por*: si la memoria de ayer aparece en el conjunto de
candidatas que el mecanismo de recuperación real produce para el mensaje
de hoy, H2 queda refutada.

**H3 -- Se recuperó pero no entró al prompt final.** La memoria SÍ es
candidata, pero se descarta en algún punto entre recuperación y el
`AIMessage[]` real enviado al proveedor de IA -- puede ser un filtro de
umbral, un límite de cupo (`MAX_CONTEXT_ITEMS` o equivalente), una
prioridad más baja que otros ítems que sí compitieron por el mismo
espacio, o cualquier otra razón estructural. Esta hipótesis NO nombra el
mecanismo por adelantado.
*Falsable por*: si se puede reconstruir, con fidelidad razonable, que el
contenido de la memoria de ayer SÍ formaba parte del prompt final
enviado (o que un prompt reconstruido que sí la incluye produce una
respuesta distinta), H3 queda refutada.

**H4 -- Entró al prompt pero el modelo no la usó.** El contenido llegó
íntegro al LLM, y aun así la respuesta generada no la referenció -- una
falla de seguimiento de instrucciones/atención del modelo, no del
pipeline de LUZ.
*Falsable por*: reconstruir el prompt real (o uno equivalente con el
mismo contenido) y volver a invocar al proveedor de IA con él, en un
experimento real y reproducible -- si el modelo SÍ usa el dato cuando de
verdad está presente, H4 queda descartada como explicación completa del
caso reportado (aunque documente un riesgo real aparte).

**H5 -- Se usó pero fue reemplazada por la información nueva.** Ambos
valores llegaron al modelo, y el modelo priorizó correctamente el más
reciente sin mencionar el anterior -- posiblemente el comportamiento
correcto, no una falla. Esta es, en espíritu, la hipótesis nula de esta
ronda: pregunta si lo que el Founder percibió como "no lo recordó" es en
realidad "lo vio y decidió no repetirlo", que es un resultado de diseño
válido, no un fallo del pipeline.
*Falsable por*: si la respuesta real de LUZ, examinada directamente,
no muestra ninguna señal de haber considerado el valor anterior (ni
para mencionarlo ni para descartarlo explícitamente), Y el prompt
reconstruido de hecho no lo contenía, H5 queda refutada a favor de una
etapa anterior (H1-H4).

**Nota explícita sobre `rank_score`:** las tres investigaciones previas
del mismo día encontraron que ese umbral pierde ~90% de recall para el
Knowledge Engine ASÍNCRONO. Es una explicación *candidata* para H2/H3 en
el camino síncrono de chat -- pero eso todavía no se ha demostrado para
este caso ni para este consumidor, y no se cita como si ya lo estuviera.
Si la evidencia real de la Sección 5 aterriza en H2 o H3, en ESE momento
-- no antes -- se investiga si `rank_score` es el mecanismo real detrás,
con el mismo rigor (nueva hipótesis, nuevo experimento), en vez de
asumirlo por similitud con un hallazgo anterior sobre un consumidor
distinto.

---

## 4. Experimentos (completados)

Se obtuvo acceso real de solo lectura (Neon, vía `console.neon.tech`,
mismo camino que esta sesión ya había identificado). E1, E2 y E3 se
corrieron contra datos y código reales, sin reconstrucción. La cadena
se detuvo en E3, siguiendo la propia regla del plan original ("no
tiene sentido correr E4 si... ya confirma H3") -- E4 y E5 no se
ejecutaron, a propósito.

**Nota metodológica honesta:** correr `assembleRealitySnapshot`
completo (E3) disparó un error real de descifrado en la conexión de
Google/Apple Calendar del Founder (`chat.calendar_context_failed`,
`Unsupported state or unable to authenticate data`) -- casi
seguramente un artefacto de este entorno de reproducción (la clave de
cifrado local, `CALENDAR_CREDENTIALS_ENCRYPTION_KEY`, no es la misma
que cifró esas credenciales en producción), no un hallazgo nuevo sobre
producción real. Se documenta por transparencia, no se investiga más
-- ese código ya está diseñado para degradarse ante cualquier fallo de
calendario sin romper el resto del turno (`getCalendarSignalsForConversation`
nunca lanza), y efectivamente no afectó el resultado real de O8.

**Limitación conocida, declarada por adelantado:** el prompt exacto
enviado al LLM y la respuesta cruda del proveedor **no se persisten en
ningún lado** (`core/observability/logger.ts` solo escribe JSON
estructurado a stdout -- `replyLength`, `durationMs`, nunca el contenido
-- y no hay tabla de prompts/completions). Lo que SÍ es recuperable como
hecho real:
- `memories`: contenido, rank, status, timestamps -- exacto.
- `conversation_messages`: el mensaje real del usuario Y la respuesta
  real que LUZ dio -- exacto.
- El contexto/prompt intermedios: no logueados verbatim, pero
  **reconstruibles con fidelidad razonable** corriendo el mismo código
  determinista (`selectContextualMemories` → `assembleRealitySnapshot`
  → Context Engine → `renderContextToMessages`) contra el estado real de
  `memories` en la ventana de tiempo relevante. Esto se declara
  explícitamente como RECONSTRUCCIÓN, nunca como log real -- mismo
  criterio que el método exige para una clasificación sustituta cuando
  no hay un humano disponible.

**E1 (H1).** Buscar en `memories` (cuenta real del Founder) por
contenido/fecha aproximada de la declaración de ayer. Métrica: ¿existe
la fila? Si sí, contenido/rank/status/occurredAt exactos.

**E2 (H2).** Si E1 confirma que la fila existe: correr el mecanismo de
recuperación real (`selectContextualMemories` u otro, el que el código
real use hoy) con el mensaje real de hoy como input, contra el
`lifeGraphId` real. Métrica: ¿aparece la memoria de ayer en el conjunto
de candidatas resultante?

**E3 (H3).** Si E2 confirma que sí es candidata: continuar la
reconstrucción determinista hasta el `AIMessage[]` final
(`assembleRealitySnapshot` → Context Engine → `renderContextToMessages`).
Métrica: ¿el contenido de la memoria de ayer aparece, en algún punto,
dentro de ese arreglo reconstruido? Si desaparece en algún paso
intermedio, ese paso exacto (archivo:línea) es la respuesta a "dónde".

**E4 (H4).** Si E3 confirma que sí llega al prompt reconstruido: invocar
al proveedor de IA real con ese prompt reconstruido (ambiente de
desarrollo, nunca contra la cuenta real del Founder en producción) y
observar si la respuesta generada usa el valor de ayer. Si lo usa, H4
queda descartada.

**E5 (H5).** Comparar la respuesta REAL que LUZ dio (`conversation_messages`,
dato real, no reconstruido) contra el resultado de E3/E4. Si el prompt
reconstruido sí contenía el valor de ayer y la respuesta real tampoco lo
usó ni lo mencionó de ninguna forma, eso es evidencia en contra de H5
(no fue "reemplazo consciente", fue omisión).

Cada experimento se detiene la investigación en la primera hipótesis que
se confirma -- no tiene sentido correr E4 si E2 ya refutó H2 pero E3
confirma H3 (el dato nunca llegó al prompt, así que preguntarle al
modelo qué hace con algo que nunca recibió no responde nada nuevo sobre
ESTE caso, aunque documentaría un riesgo aparte).

---

## 5. Resultados

**E1.** La memoria del 1 de agosto existe, con el contenido exacto de
la declaración real, `rank_score = 19`.

**E2.** `selectContextualMemories`, corrida con el mensaje real del 2
de agosto, devuelve esa memoria en su lista de 5 candidatos (posición
4).

**E3.** `assembleRealitySnapshot`, corrida con el mismo mensaje real,
produce un `snapshot.memory.items` de 2 elementos que NO incluye esa
memoria. El único paso entre la salida de E2 y el resultado de E3 es
el filtro `rank.score >= 45` sobre la lista ya obtenida en E2.

## 6. Conclusiones

- **H1 (nunca se capturó) REFUTADA.** Confianza: alta. O2 -- la fila
  existe, con el contenido exacto.
- **H2 (se capturó pero nunca se recuperó) REFUTADA.** Confianza:
  alta. O7/E2 -- sí es candidata real para el mensaje real que la
  necesitaba.
- **H3 (se recuperó pero no entró al prompt final) CONFIRMADA.**
  Confianza: alta. O8/E3, con el mecanismo exacto identificado en O9:
  el filtro `rank.score >= 45` en `assembleRealitySnapshot`
  (`assemble-reality-snapshot.ts:226-228`), el mismo umbral y el mismo
  archivo que las tres investigaciones de esta mañana sobre Knowledge
  Engine, y que la investigación de representación de memoria de esta
  tarde, ya habían identificado -- ahora confirmado por quinta vez, en
  un incidente real reportado directamente por el Founder, no
  inferido de código ni de una consulta sintética.
- **H4 no se evaluó**, según la propia regla del plan: no aporta nada
  nuevo preguntarle al modelo qué haría con un dato que la Sección 5 ya
  demostró que nunca recibió.
- **H5 (se usó pero fue reemplazada) REFUTADA por O6.** La propia
  respuesta real de LUZ ("no me guardo montos exactos... si me repites
  el valor") es evidencia directa de que el valor nunca llegó al
  prompt -- no es una decisión consciente de priorizar el dato nuevo
  sobre el viejo, es la ausencia total del dato viejo.

**Respuesta directa a la pregunta de investigación ("¿en qué punto
exacto desapareció el valor de ayer?"):** entre la selección de
candidatos por relevancia contextual (que funcionó correctamente) y el
ensamblado final del snapshot que se convierte en el prompt -- en el
filtro de `rank_score >= 45` de `assemble-reality-snapshot.ts`. No es
un fallo de captura, no es un fallo de recuperación contextual, no es
el modelo ignorando algo que sí tenía. Es el mismo mecanismo, con el
mismo umbral, que cada investigación de hoy ha encontrado en un lugar
distinto del sistema.

## 7. Recomendaciones

Ninguna implementada -- ninguna nueva, tampoco. Este incidente es una
instancia más, con nombre y fecha reales, de la causa raíz que
`ADR-0022` (cerrada hoy) ya diseñó una solución para -- no una causa
distinta que amerite su propio diseño. Las opciones ya evaluadas ahí
(la nueva estrategia de elegibilidad, la exención de `focusMemoryId`,
la separación de responsabilidad por umbral) cubren exactamente este
caso: una vez implementado, este mismo mensaje real, corrido de nuevo,
sí incluiría el gasto del 1 de agosto en el prompt final -- no porque
esta investigación proponga algo nuevo, sino porque ya existe un
diseño aceptado que lo resuelve, todavía sin implementar. El único
punto genuinamente nuevo que este incidente aporta (no cubierto por
ADR-0022, que habla de la etapa de Knowledge Engine/Extract): el mismo
filtro también corta el camino síncrono del chat normal, sin pasar por
Knowledge Engine en absoluto -- confirma que el alcance real del
problema es más amplio que "el Knowledge Engine encola poco trabajo";
es "el chat mismo, en cada turno, no logra usar memorias de bajo
`rank_score` aunque las haya encontrado por relevancia real." Vale la
pena que quien retome la implementación de ADR-0022 tenga este dato
concreto en la mano, no como una ADR nueva, sino como el caso de
prueba real contra el que validar que la corrección funciona.

---

## Anexo -- mapa de referencia del pipeline (código, no evidencia del caso)

Generado por lectura de código ANTES de examinar el caso real -- útil
como mapa de "dónde mirar" en los experimentos de la Sección 4, pero
**ninguna línea de este anexo es evidencia de lo que pasó en el caso
real**, y no se cita como tal en ninguna hipótesis de la Sección 3.

- **Ingesta**: `app/api/chat/route.ts` (auth/validación/rate-limit) →
  `features/chat/services/send-message.ts`, `prepareMessageInner()`
  (líneas 171-383) -- inserta el mensaje en `conversation_messages`,
  llama `buildContext()`, llama `MemoryEngine.capture()`.
- **Captura**: `core/memory-engine/engine/default-memory-engine.ts`,
  `DefaultMemoryEngine.capture()` (líneas 52-68) -- Capture → Rank →
  Connect, síncrono. `DefaultCaptureStage.capture()`
  (`core/memory-engine/lifecycle/default-capture-stage.ts:21-51`):
  incondicional, todo mensaje se convierte en `Memory`.
- **Ranking**: `DeterministicMemoryRankingStrategy.rank()`
  (`core/memory-engine/ranking/deterministic-memory-ranking-strategy.ts:225-241`)
  -- 9 categorías de palabras clave orientadas a narrativa de vida
  significativa (líneas 28-163); `MIN_SCORE_WITH_UNDERSTANDING_SIGNAL = 45`
  (línea 183); cero coincidencias = 15-19 puntos.
- **Persistencia**: `core/db/schema/memory.ts:109-196`, tabla
  `memories`. Sin columna de versión/reemplazo -- cada declaración es
  una fila nueva e independiente para siempre.
- **Recuperación (candidatas)**: `features/chat/services/select-contextual-memories.ts`,
  `selectContextualMemories()` (líneas 63-125) -- relevancia por tokens
  compartidos (peso 20), tipo (peso 15), `rank.score` (peso 0.3).
- **Filtro previo al prompt**: `features/chat/services/assemble-reality-snapshot.ts`,
  `assembleRealitySnapshot()` (líneas 109-518) -- filtra por
  `rank.score >= MIN_SCORE_WITH_UNDERSTANDING_SIGNAL` (líneas 226-228)
  antes de poblar `RealitySnapshot.memory.items`. 5 llamadores en todo
  el repo (`build-context.ts:94` síncrono/chat, `generate-welcome.ts:107`
  síncrono, `build-morning-brief.ts:169` síncrono,
  `process-knowledge-job.ts:85` asíncrono, `build-identity-model.ts:124`
  síncrono) -- los 5 aplican el mismo filtro.
- **Ensamblado de contexto**: `core/context-engine/engine/default-context-engine.ts`,
  `DefaultContextEngine.build()` (líneas 26-40) -- Filter → Score →
  Prioritize, tope `MAX_CONTEXT_ITEMS = 8` (`deterministic-context-prioritization-strategy.ts:13`)
  across todas las fuentes combinadas.
- **Render final**: `features/chat/context-builder/render-context.ts`,
  `renderContextToMessages()` (líneas 142-178) -- Identity → Conversation
  Rules (contenido de memoria vive aquí, vía `FavorPrioritizedContextRule`)
  → Strategy → Presence → Voice → turnos crudos de la conversación
  actual.
- **Llamada al LLM**: `send-message.ts:662`
  (`aiProvider.generateReply(prepared.aiMessages)`, no streaming) /
  `:743` (`generateReplyStream`, streaming). Ninguno de los dos persiste
  el prompt ni la respuesta cruda -- solo `logger.log` con metadata
  (`replyLength`, `durationMs`).
- **Contradicción**: `core/contradiction-engine/services/detect-contradictions.ts:42-99`
  -- nunca compara dos `Memory` directamente, solo `Belief`s ya
  consolidados; alcanzable solo vía `enrichKnowledgeGraph()`
  (`features/knowledge/services/enrich-knowledge-graph.ts:101-428`),
  asíncrono (worker/cron), y depende de que la memoria haya cruzado el
  mismo filtro de rank para llegar a Extract en primer lugar.
