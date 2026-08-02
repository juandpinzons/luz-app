# Investigación: dónde se pierde información antes de Memory Ranking

Metodología: `docs/engineering/TECHNICAL_INVESTIGATION_METHODOLOGY_V1.md`.\
Fecha: 2026-08-02\
Disparador: continuación directa de
`2026-08-02_knowledge_engine_memory_rank_score.md` (esa investigación
midió que Ranking, cuando recibe una memoria, la reconoce como
relevante solo 10.3% de las veces). Esta investigación pregunta un
paso atrás: **¿se pierde información incluso antes de que Ranking
tenga la oportunidad de evaluarla?**\
**Ningún código de producción fue modificado durante esta
investigación.** Todo lo de abajo es lectura de código real y
consultas de solo lectura contra producción.

---

## 0. El pipeline propuesto vs. el pipeline real

El Founder propuso rastrear: `User Message → Capture → Extraction →
Classification → Candidate Generation → Ranking → Persistence →
Knowledge`. Antes de poder medir nada, se verificó ese pipeline contra
el código real (`core/memory-engine/engine/default-memory-engine.ts`,
`lifecycle/default-capture-stage.ts`,
`classification/deterministic-memory-classifier.ts`,
`lifecycle/default-connect-stage.ts`). Esto en sí mismo es una
observación, no una interpretación: **"Extraction" y "Candidate
Generation" no existen como etapas nombradas en el código real.** El
pipeline verificado es:

```
User Message (conversation_messages)
  → MemoryEngine.capture()
      → DefaultCaptureStage.capture()
          → classify() (si no viene un type explícito -- Classification real)
          → repository.save()  [1ª persistencia, sin rank]
      → DeterministicMemoryRankingStrategy.rank()  [Ranking real]
      → repository.save()  [2ª persistencia, ahora con rank -- mismo row, upsert confirmado]
      → DefaultConnectStage.connect()  [construye memory_connections, no gatea nada]
  → [fuera de MemoryEngine, en send-message.ts]
      → if (rank.score >= 45) enqueueKnowledgeJob()  [el gate de Knowledge ya investigado]
```

No existe una etapa que extraiga fragmentos de un mensaje ni que
genere varios candidatos de memoria a partir de uno solo — el mensaje
completo, verbatim, se convierte siempre en exactamente una `Memory`.
Esto se trata como un hallazgo en la Sección 6, no se fuerza a encajar
en la terminología original.

---

## 1. Observaciones

- **O1.** Para la cuenta del Founder, el número de mensajes reales de
  usuario (`conversation_messages`, `role = 'user'`) es exactamente
  igual al número de `memories` (`source = 'conversation'`): 179 = 179.
  *Evidencia: `select count(*) from conversation_messages where
  user_id = '4c81b1c8...' and role = 'user'` → 179. `select count(*)
  from memories where life_graph_id = '856fe1bd...'` → 179.*
- **O2.** Un `LEFT JOIN` de mensajes de usuario contra `memories` (por
  `memories.source_id = conversation_messages.id`, la clave real que
  usa `send-message.ts` al llamar a `capture()`) no encuentra ningún
  mensaje sin memoria correspondiente.
  *Evidencia: consulta directa → 0 filas.*
- **O3.** El mismo conteo, a nivel de todo el sistema (17 cuentas
  reales): 285 mensajes de usuario = 285 memorias con
  `source = 'conversation'`.
  *Evidencia: consultas equivalentes sin filtro de usuario.*
- **O4.** No existe ningún evento de tipo `error` relacionado con fallo
  de captura de memoria (`memory_capture`) en todo el histórico de
  `events`.
  *Evidencia: `select count(*) from events where type = 'error' and
  (message ilike '%memory_capture%' or route ilike '%memory_capture%')`
  → 0.*
- **O5.** `DeterministicMemoryClassifier.classify()` siempre retorna un
  `MemoryType` válido — nunca `null`, nunca lanza. Sin coincidencias,
  retorna `DEFAULT_TYPE`.
  *Evidencia: `core/memory-engine/classification/deterministic-memory-classifier.ts`,
  método `classify()`.*
- **O6.** `DrizzleMemoryRepository.save()` usa
  `.onConflictDoUpdate({ target: memories.id })` — las dos llamadas a
  `save()` dentro de `MemoryEngine.capture()` (una sin rank, una con
  rank) actualizan la misma fila; no se crean filas duplicadas.
  *Evidencia: `core/memory-engine/repositories/drizzle-memory.repository.ts:105-130`.*
- **O7.** El código que decide si una memoria encola trabajo del
  Knowledge Engine cambió el 2026-07-24T08:41:52-07:00 (commit
  `c406ed0`, "fix(knowledge,reality): cierre P0 -- Knowledge Engine
  end-to-end"). Antes de ese commit: `enqueueKnowledgeJob` se llamaba
  **sin condición**, con `sourceType: "conversation_message"`, para
  cada mensaje. Después de ese commit: se llama **solo si**
  `capturedMemory.rank.score >= MIN_SCORE_WITH_UNDERSTANDING_SIGNAL`,
  con `sourceType: "memory"`.
  *Evidencia: `git log -p --follow -- features/chat/services/send-message.ts`,
  diff exacto del commit `c406ed0`.*
- **O8.** De los 82 `knowledge_jobs` completados que existen para la
  cuenta del Founder, el 100% tiene `source_type = 'conversation_message'`
  — es decir, **el 100% son de antes del commit `c406ed0`**. Cero jobs
  con `source_type = 'memory'` (la convención actual, gateada por
  rank) han completado jamás para esta cuenta.
  *Evidencia: `select source_type, status, count(*) from knowledge_jobs
  where user_id = '4c81b1c8...' group by source_type, status` → una
  sola fila, `{conversation_message, completed, 82}`.*
- **O9.** De esos 82 jobs (todos sin gate de rank, todos procesados),
  solo 4 (4.9%) produjeron al menos una fila en
  `knowledge_engine_evidence` — es decir, solo 4 de las 82 memorias
  procesadas terminaron generando algún insight real.
  *Evidencia: `LEFT JOIN` de `knowledge_jobs` (resolviendo
  `conversation_message` → `memory` vía `source_id`) contra
  `knowledge_engine_evidence` agrupado por `memory_id` → `{total: 82,
  produced_evidence: 4}`.*

---

## 2. Mediciones

| Frontera del pipeline | Entra | Sale con éxito | % conservado | % perdido |
|---|---|---|---|---|
| Mensaje de usuario → Memory (Capture + Classification + 1ª Persistencia) | 179 (Founder) / 285 (sistema) | 179 / 285 | **100%** | **0%** |
| Memory → cruza el umbral de Ranking (histórico completo, Founder) | 179 | 4 | 2.2% | 97.8% |
| Memory (sin gate, pre-2026-07-24) → produce algún Insight | 82 | 4 | 4.9% | 95.1% |
| Memory con rank ≥ 45 (post-gate) → encola `knowledge_job` | 4 | 4 (mismo conjunto, es la misma comparación) | 100% (por definición, ver O7) | — |

La primera fila es el resultado central de esta investigación: **cero
pérdida medible antes de que una memoria exista y esté clasificada.**
Las filas 2 y 3 son dos pérdidas reales, pero en fronteras
**posteriores** a Capture/Classification, no anteriores a Ranking.

---

## 3. Hipótesis

- **H1 (la hipótesis del Founder, tal como se formuló).** Se pierde
  información importante antes de que llegue a Ranking — en Capture,
  Extraction, Classification o Candidate Generation.
- **H2.** No se pierde nada antes de Ranking; la pérdida real ocurre
  en cómo se **usa** el resultado de Ranking río abajo (el gate de
  encolado), no en el cálculo de Ranking en sí ni en ninguna etapa
  previa.
- **H3.** La pérdida ocurre después de Ranking, dentro del propio
  Knowledge Engine — memorias que sí califican y sí se procesan, pero
  el paso de extracción de insights (la llamada a IA dentro de
  `enrich-knowledge-graph.ts`) decide que no hay nada que extraer.
- **H4 (nula).** No hay pérdida real en ningún punto — el volumen bajo
  en cada frontera refleja correctamente que poco de lo que se escribe
  es genuinamente insight-worthy.
- **H5 (emergente, no anticipada al formular H1-H4 — ver Sección 6 de
  la metodología: se documenta y evalúa con el mismo rigor).** La
  "pérdida" no es un fallo técnico en ninguna etapa individual, sino la
  consecuencia medible de una decisión arquitectónica deliberada
  (introducir el gate de rank el 2026-07-24) combinada con el recall ya
  medido (10.3%, investigación anterior) del mecanismo que ese gate
  eligió usar.

---

## 4. Experimentos

### E1 — Conteo exacto mensaje-a-memoria (contra H1, tramo Capture/Classification)

- **Objetivo:** confirmar o refutar que existe pérdida entre "mensaje
  enviado" y "memoria creada y clasificada."
- **Metodología:** `LEFT JOIN` de `conversation_messages` (role=user)
  contra `memories` por `source_id`, para el Founder y para el sistema
  completo.
- **Variables:** ninguna — conteo directo, reproducible.
- **Métricas:** número de mensajes sin memoria correspondiente.
- **Criterio de éxito (para H1, en este tramo):** un número
  significativo de mensajes sin memoria.
- **Criterio de fracaso:** cero o casi cero mensajes sin memoria.

### E2 — Búsqueda de fallos silenciosos de captura

- **Objetivo:** confirmar independientemente el resultado de E1 desde
  otro ángulo (¿hay intentos que fallaron y quedaron registrados como
  error, aunque no dejaran rastro en `memories`?).
- **Metodología:** búsqueda de eventos `type = 'error'` relacionados
  con `memory_capture` en todo el histórico.
- **Variables:** ninguna.
- **Métricas:** conteo de eventos de error relevantes.
- **Criterio de éxito (para H1):** eventos de error reales encontrados.
- **Criterio de fracaso:** cero eventos.

### E3 — Verificación de que Classification nunca rechaza contenido

- **Objetivo:** confirmar o refutar que Classification (la única etapa
  real que se acerca a lo que el Founder llamó "Extraction/
  Classification") puede descartar una memoria.
- **Metodología:** lectura directa de
  `DeterministicMemoryClassifier.classify()`.
- **Variables:** ninguna, es lectura de código.
- **Métricas:** ¿existe algún camino de retorno `null`/excepción por
  contenido no reconocido?
- **Criterio de éxito (para H1):** sí existe tal camino.
- **Criterio de fracaso:** siempre retorna un tipo válido (hay un tipo
  por defecto).

### E4 — Historia real del gate de encolado (contra H2/H5)

- **Objetivo:** establecer, con evidencia de control de versiones, si
  el criterio para encolar trabajo del Knowledge Engine siempre
  dependió de Ranking o cambió en algún momento identificable.
- **Metodología:** `git log -p --follow` sobre
  `features/chat/services/send-message.ts`, localizando el commit
  exacto que introdujo la condición `rank.score >=
  MIN_SCORE_WITH_UNDERSTANDING_SIGNAL`.
- **Variables:** ninguna, es historia real, inmutable.
- **Métricas:** fecha, hash de commit, condición antes/después.
- **Criterio de éxito (para H5):** se encuentra un cambio real y
  fechado de "sin gate" a "con gate."
- **Criterio de fracaso:** el gate siempre existió, sin cambios.

### E5 — Tasa real de producción de insights, aislada del gate (contra H3)

- **Objetivo:** medir qué fracción de memorias **realmente
  procesadas** (sin el sesgo de selección que introduce el gate de
  rank) termina generando al menos un insight — la mejor aproximación
  disponible a "qué tan lossy es el propio Knowledge Engine," separada
  de la pregunta de qué tan lossy es Ranking.
- **Metodología:** los 82 jobs con `source_type = 'conversation_message'`
  (todos de antes del gate, es decir, una muestra no filtrada por
  rank) se cruzan contra `knowledge_engine_evidence` resolviendo
  `conversation_message → memory` por `source_id`.
- **Variables:** fijo = la muestra (82 jobs, ya completados, ya sin
  sesgo de selección por rank). Medido = cuántos produjeron evidencia.
- **Métricas:** % de jobs que produjeron al menos una fila de
  evidencia.
- **Criterio de éxito (para H3):** porcentaje bajo (arbitrariamente,
  <20%) — indicaría pérdida real dentro del propio Knowledge Engine,
  independiente de Ranking.
- **Criterio de fracaso:** porcentaje alto — indicaría que, una vez que
  algo llega a ser procesado, casi siempre produce algo.

---

## 5. Resultados

**E1.** 0 mensajes de usuario sin memoria correspondiente, para el
Founder (179/179 emparejados) y para el sistema completo (285/285
emparejados).

**E2.** 0 eventos de error relacionados con fallo de captura de
memoria, en todo el histórico de `events`.

**E3.** `classify()` siempre retorna un `MemoryType` — nunca `null`,
nunca lanza; existe un `DEFAULT_TYPE` explícito para el caso de cero
coincidencias léxicas.

**E4.** Commit `c406ed0db4a82279c2a847096a15ddf02bf8264c`,
2026-07-24T08:41:52-07:00, mensaje "fix(knowledge,reality): cierre P0
-- Knowledge Engine end-to-end + Reality Snapshot contextual". Antes:
`enqueueKnowledgeJob` sin condición, `sourceType: "conversation_message"`.
Después: condicionado a `rank.score >= 45`, `sourceType: "memory"`.
Confirmado independientemente por los datos: el 100% de los 82 jobs
completados del Founder son `source_type = 'conversation_message'`
(pre-commit); 0 son `source_type = 'memory'` (post-commit) — el nuevo
camino, gateado, no ha producido un solo job completado para esta
cuenta desde que existe.

**E5.** De 82 jobs procesados sin gate de rank (muestra completa,
pre-2026-07-24), 4 produjeron al menos una fila de
`knowledge_engine_evidence`. 4/82 = 4.9%.

---

## 6. Conclusiones

- **C1 — H1 REFUTADA para el tramo Capture/Classification. Confianza:
  alta.** Evidencia: E1 (0/179 y 0/285 mensajes perdidos, dos
  poblaciones independientes) y E2 (0 fallos registrados) y E3 (la
  clasificación no puede rechazar contenido por diseño). No hay
  pérdida medible entre que una persona escribe un mensaje y que ese
  mensaje existe como `Memory` clasificada y persistida.
- **C2 — "Extraction" y "Candidate Generation," tal como se
  nombraron en la pregunta original, no existen como etapas separadas
  en el sistema real.** Nivel de confianza: alta (verificación directa
  de código, tres archivos). Esto no es una refutación de una
  hipótesis formal, es una corrección del modelo del pipeline en sí:
  el sistema captura el mensaje completo, verbatim, como un único
  candidato, siempre — no hay una etapa donde múltiples candidatos
  compitan o se seleccionen. Se documenta aquí porque cambia dónde
  tiene sentido seguir buscando (ver Sección 7).
- **C3 — H5 CONFIRMADA. Confianza: alta.** Evidencia: E4. El 2026-07-24
  el sistema pasó, de forma deliberada y documentada en el propio
  mensaje del commit, de encolar trabajo del Knowledge Engine para
  *todo* mensaje a encolarlo *solo* si Ranking lo aprueba. Esa decisión
  es exactamente donde el recall de 10.3% (medido en la investigación
  anterior) se volvió consecuente — antes de ese commit, el recall de
  Ranking no bloqueaba nada, porque Ranking no gateaba nada todavía.
- **C4 — H3 CONFIRMADA, como hallazgo adicional independiente del
  gate. Confianza: media-alta (N=82, una sola cuenta, aunque
  representa el 100% de los jobs completados sin sesgo de selección
  disponibles para análisis).** Evidencia: E5. Incluso en el mundo
  "sin gate" (antes del 24 de julio), donde toda memoria capturada
  llegaba al Knowledge Engine, solo 4.9% terminaba generando un
  insight real. Esto es una segunda pérdida real, distinta de la del
  gate de Ranking, y ocurre **después** de Ranking, dentro del propio
  proceso de extracción de insights — fuera del alcance que "antes de
  Ranking" pedía investigar, pero demasiado grande para no reportarlo.
- **C5 — H2 no se puede confirmar ni refutar por separado de H5 con la
  evidencia actual** — ambas describen, en la práctica, el mismo
  mecanismo (el gate introducido en `c406ed0` es exactamente "cómo se
  usa el resultado de Ranking río abajo"). Se tratan como la misma
  conclusión (C3).
- **C6 — H4 (nula) REFUTADA. Confianza: alta.** Evidencia: la
  investigación anterior ya estableció (benchmark de 179 memorias,
  clasificación independiente) que contenido real y genuinamente
  revelador (metas a 30 días, autodescripción explícita, un logro de
  vida pedido textualmente para el mapa de vida) recibe rank_score
  idéntico a un saludo. Esta investigación no encontró nueva evidencia
  que sostenga la hipótesis nula en ningún tramo adicional.

**Respuesta directa a la pregunta formulada:** la hipótesis de que el
cuello de botella está *antes* de Ranking **se rechaza**. La captura
es perfecta (0% de pérdida, dos poblaciones independientes
verificadas). El cuello de botella real tiene dos componentes
medibles, ambos **en o después** de Ranking: (1) el gate introducido
el 2026-07-24 que condiciona el trabajo del Knowledge Engine al
recall de 10.3% de Ranking (investigación anterior + E4 de esta), y
(2) una segunda pérdida independiente, del 95.1%, dentro del propio
Knowledge Engine, entre "memoria procesada" y "insight producido" —
no investigada a fondo aquí, ver Sección 7.

---

## 7. Recomendaciones

Ninguna implementada.

### R1 — Ninguna acción sobre Capture/Classification

| Dimensión | Evaluación |
|---|---|
| Impacto esperado | Ninguno necesario — C1 confirma 0% de pérdida en este tramo. Cualquier esfuerzo aquí sería resolver un problema que la evidencia no muestra que exista. |
| Riesgos / Costo / Complejidad | N/A |
| Compatibilidad Architecture V1 | N/A |
| Impacto Responsible AI / sesgo / varianza / evaluabilidad | N/A |

### R2 — Revisar el diseño del gate introducido en `c406ed0`, a la luz del recall ya medido de Ranking

| Dimensión | Evaluación |
|---|---|
| Impacto esperado | Directo — es la causa confirmada (C3) de por qué `knowledge_jobs` casi no recibe trabajo nuevo. Ya cubierto con tres opciones concretas (ampliar la lista léxica / agregar categoría "logro de vida" / mecanismo semántico) en la investigación anterior — no se repiten aquí. |
| Riesgos | Depende de la opción elegida, ver investigación anterior. |
| Costo / Complejidad | Ídem. |
| Compatibilidad Architecture V1 | Ídem. |
| Impacto Responsible AI / sesgo / varianza / evaluabilidad | Ídem. |

### R3 — Investigar por separado la pérdida del 95.1% dentro del propio Knowledge Engine (C4), como su propia investigación futura

| Dimensión | Evaluación |
|---|---|
| Impacto esperado | Desconocido todavía — podría ser un problema real (el prompt de extracción de insights es demasiado conservador) o un comportamiento correcto (la mayoría de mensajes individuales, en efecto, no contienen nada insight-worthy por sí solos). Esta investigación no responde cuál de las dos. |
| Riesgos | Ninguno en investigar; el riesgo aparece solo si se optimiza sin medir primero (violaría la Restricción 3 de la metodología). |
| Costo | Medio — requeriría un benchmark análogo a E1 de la investigación anterior, pero aplicado al prompt de `enrich-knowledge-graph.ts`/`AIInsightGenerationStrategy`, no al matcher léxico. |
| Complejidad | Media. |
| Compatibilidad Architecture V1 | Total — es medir un componente existente, no proponer uno nuevo. |
| Impacto Responsible AI | Ninguno en la fase de medición. |
| Impacto sobre sesgo / varianza | Desconocido hasta medir — precisamente el punto de investigarlo antes de tocar código. |
| Impacto sobre evaluabilidad futura | Alto — dejaría, por primera vez, un número real de recall para la extracción de insights, no solo para el matcher de Ranking. |

**No se recomienda ninguna implementación inmediata.** La evidencia de
esta investigación redirige el foco: la pregunta original ("¿se pierde
algo antes de Ranking?") queda respondida con alta confianza (no), y
revela una segunda pregunta, del mismo tamaño o mayor, que la
investigación anterior no cubrió — cuánto se pierde **dentro** del
propio Knowledge Engine, independientemente del gate de Ranking.
