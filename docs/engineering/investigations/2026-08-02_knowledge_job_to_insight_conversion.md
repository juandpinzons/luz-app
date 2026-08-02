# Investigación: por qué el Knowledge Engine produce tan pocos insights

Metodología: `docs/engineering/TECHNICAL_INVESTIGATION_METHODOLOGY_V1.md`.\
Fecha: 2026-08-02\
Disparador: continuación directa de
`2026-08-02_pipeline_loss_before_ranking.md`, que midió que solo 4 de
82 `knowledge_jobs` completados (4.9%) del Founder produjeron algún
insight, y dejó la causa como pregunta abierta, explícitamente fuera
del alcance de esa investigación.\
**Ningún código de producción fue modificado durante esta
investigación.** Todo lo de abajo es lectura de código real y
consultas de solo lectura contra producción.

---

## 0. Corrección sobre el pipeline (frente a la investigación anterior)

La investigación anterior concluyó que "Extraction" y "Candidate
Generation" no existen como etapas en el sistema real — eso es cierto
para `core/memory-engine` (dónde se preguntó en ese momento), pero
**no es cierto para `core/knowledge-engine`**, que sí implementa un
pipeline con esos nombres casi exactos. Verificado contra
`core/knowledge-engine/engine/default-knowledge-engine.ts`:

```
Extract → Classify → Relate → Generate → Validate → Persist
```

Seis etapas reales, cada una una estrategia inyectada
(`DefaultExtractStage`, `DeterministicClassifyStage`,
`StructuralInsightRelationshipStrategy`, `AIInsightGenerationStrategy`,
`DeterministicInsightValidationStrategy`, `DefaultPersistStage`). Esta
corrección se documenta explícitamente, tal como exige la metodología
cuando aparece evidencia que contradice el marco de la investigación
anterior — no se descarta en silencio.

---

## 1. Observaciones

- **O1.** `DefaultExtractStage.extract()` construye sus candidatos
  únicamente a partir de `snapshot.memory.items` — la lista de
  memorias que `assembleRealitySnapshot` ya decidió incluir en el
  `RealitySnapshot`, no de todas las memorias de la persona.
  *Evidencia: `core/knowledge-engine/lifecycle/default-extract-stage.ts:46`.*
- **O2.** `assembleRealitySnapshot` construye esa lista
  (`memoriesWithRealSignal`, lo que termina siendo `snapshot.memory.items`)
  filtrando por `(memory.rank?.score ?? 0) >= MIN_SCORE_WITH_UNDERSTANDING_SIGNAL`
  — el mismo umbral (45) y el mismo campo (`rank.score`) ya investigados
  en `2026-08-02_knowledge_engine_memory_rank_score.md`.
  *Evidencia: `features/chat/services/assemble-reality-snapshot.ts:226-228`.*
- **O3.** `processKnowledgeJob` (el único llamador real de
  `assembleRealitySnapshot` en el camino del Knowledge Engine) pasa
  `focusMemoryId: job.sourceId` explícitamente, con la intención
  declarada en el propio código de garantizar que la memoria que
  disparó el job sea examinada: *"Forzarla dentro del snapshot evita
  que un historial grande la expulse del top-N y que Knowledge procese
  evidencia distinta a la que lo disparó."*
  *Evidencia: `features/knowledge/services/process-knowledge-job.ts:85-90`.*
- **O4.** Esa garantía es parcial: `focusedMemory` se obtiene por
  `getById` (sin filtro de rank) y se antepone a la lista de
  candidatos — pero el resultado combinado **todavía pasa** por el
  mismo filtro de `rank.score >= 45` inmediatamente después. Forzar un
  lugar en la ventana top-N no exime del filtro de calidad que corre a
  continuación.
  *Evidencia: mismo archivo, líneas 207-228 — `relevantMemories` (con
  la memoria forzada) se calcula primero; `memoriesWithRealSignal` (el
  filtro de rank) se aplica después, sobre ese mismo resultado.*
- **O5.** `DefaultExtractStage` también excluye cualquier memoria que
  YA tenga evidencia de un insight existente (`listByEvidenceMemoryId`)
  — una memoria solo puede pasar por Extract exitosamente una vez.
  *Evidencia: `default-extract-stage.ts:47-53`.*
- **O6 (empírico, verificación cruzada real).** Las 4 memorias del
  Founder con `rank_score >= 45` en toda su historia
  (`24e41d3c…`, `4dd8542f…`, `63262b11…`, `d9f0b176…`) son, **exactamente
  y sin excepción**, las mismas 4 memorias que aparecen como evidencia
  de al menos un insight en `knowledge_engine_evidence`. Cero memorias
  con evidencia que no tengan rank ≥ 45; cero memorias con rank ≥ 45
  que nunca hayan producido evidencia.
  *Evidencia: consulta cruzada directa, `select id from memories where
  rank_score >= 45` vs. `select distinct memory_id from
  knowledge_engine_evidence`, ambas para
  `life_graph_id = '856fe1bd…'`.*
- **O7 (de la investigación anterior, reutilizada como base).** 82/82
  `knowledge_jobs` completados del Founder son `source_type =
  'conversation_message'` (pre-commit `c406ed0`, 2026-07-24); 4/82
  (4.9%) produjeron evidencia.

---

## 2. Mediciones

| Métrica | Valor |
|---|---|
| `knowledge_jobs` completados (Founder) | 82 |
| Produjeron ≥1 insight | 4 (4.9%) |
| Memorias con `rank_score >= 45`, histórico completo (Founder) | 4 / 179 (2.2%) |
| Overlap entre "produjo evidencia" y "rank ≥ 45" | 4/4 = **100%** en ambas direcciones |
| Memorias que llegaron a Extract (rank ≥ 45) y NO produjeron insight | **0** |
| `RELEVANT_MEMORY_LIMIT` (tope de memorias por snapshot) | 5 |
| Tasa de éxito de Generate+Validate, dado que Extract recibió la memoria | 4/4 = **100%** (muestra completa disponible, no una submuestra) |

La fila más importante de esta tabla es la del overlap: no es una
correlación alta, es una **coincidencia exacta de conjuntos**, medida
sobre la población completa (las 4 memorias que alguna vez calificaron
por rank, no una muestra de ellas).

---

## 3. Hipótesis

- **H1 (la pregunta original, tal como se formuló).** La información se
  descarta *dentro* del pipeline Extract→Classify→Generate→Validate→Persist
  — por ejemplo, Generate (la llamada a IA) decide con frecuencia que
  no hay nada que proponer, o Validate rechaza propuestas reales.
- **H2.** El pipeline en sí (Extract→Persist) no descarta casi nada
  cuando recibe una memoria real — la pérdida ocurre **antes**, en qué
  memorias llegan siquiera a `snapshot.memory.items`, gateadas por el
  mismo umbral de rank ya investigado.
- **H3.** Generate específicamente es el cuello de botella — el prompt
  de `AIInsightGenerationStrategy` es demasiado conservador incluso con
  buena evidencia.
- **H4.** Validate específicamente es el cuello de botella —
  `DeterministicInsightValidationStrategy` rechaza insights propuestos
  válidos.
- **H5 (nula).** No hay pérdida real en ningún punto del pipeline
  Extract→Persist — 4.9% refleja correctamente que casi ninguna de las
  82 memorias procesadas tenía algo insight-worthy.

---

## 4. Experimentos

### E1 — Verificación de código del pipeline completo

- **Objetivo:** establecer con certeza qué etapas existen y en qué
  orden, antes de formular más hipótesis sobre dónde ocurre la
  pérdida.
- **Metodología:** lectura directa de
  `default-knowledge-engine.ts`, `default-extract-stage.ts`,
  `process-knowledge-job.ts`.
- **Métricas:** N/A, resultado cualitativo (Sección 0).

### E2 — Cruce exacto: memorias con rank ≥ 45 vs. memorias con evidencia real (contra H1/H2)

- **Objetivo:** determinar si el conjunto de memorias que producen
  insight coincide con el conjunto que cruza el umbral de rank, o si
  son conjuntos distintos (lo segundo apoyaría H1: el pipeline mismo
  descarta cosas que sí llegaron con rank suficiente).
- **Metodología:** dos consultas independientes contra producción —
  memorias con `rank_score >= 45`, y memorias distintas presentes en
  `knowledge_engine_evidence` — comparación de conjuntos completa (no
  muestreada, son solo 4 y 4).
- **Variables:** población completa del Founder, sin muestreo.
- **Métricas:** tamaño de la intersección, tamaño de cada diferencia
  simétrica.
- **Criterio de éxito (para H1):** conjuntos claramente distintos —
  memorias con rank suficiente que nunca produjeron nada, evidencia de
  que Extract/Generate/Validate perdió algo real.
- **Criterio de éxito (para H2):** conjuntos idénticos — toda la
  pérdida ya se explica por quién llega a Extract, no por qué le pasa
  una vez que llega.

### E3 — Tasa de éxito de Generate+Validate dado un input real (contra H3/H4)

- **Objetivo:** aislar si, una vez que una memoria SÍ llega a Extract,
  el resto del pipeline (Generate, Validate) todavía pierde una
  fracción significativa.
- **Metodología:** de las memorias que cruzaron rank ≥ 45 (población
  completa conocida, N=4), contar cuántas tienen al menos un insight
  validado resultante.
- **Variables:** mismo dataset que E2, ángulo distinto (tasa de éxito
  condicional, no comparación de conjuntos).
- **Métricas:** % de éxito condicional a llegar a Extract.
- **Criterio de éxito (para H3/H4):** porcentaje bajo — memorias que
  llegan a Extract pero no producen insight validado.
- **Criterio de fracaso (para H3/H4) / éxito para H2:** 100% o cercano
  — el pipeline interno funciona bien dado un input real.

### E4 — Verificación de que `focusMemoryId` no exime del filtro de rank

- **Objetivo:** confirmar si la memoria que disparó el job tiene
  garantizada su evaluación real, o si el mecanismo de "forzarla"
  puede ser anulado por el mismo filtro que gatea todo lo demás.
- **Metodología:** lectura de código, orden de operaciones en
  `assemble-reality-snapshot.ts` (dónde se aplica `focusMemoryId` vs.
  dónde se aplica el filtro de rank).
- **Métricas:** ¿el filtro de rank corre antes o después de que la
  memoria forzada entra a la lista?
- **Criterio de éxito (para H2):** el filtro corre después — la
  garantía de "forzar un lugar" no incluye "exención del filtro de
  calidad."

---

## 5. Resultados

**E1.** Pipeline confirmado: Extract → Classify → Relate → Generate →
Validate → Persist (Sección 0). Ninguna etapa adicional oculta entre
"job completado" y "insight persistido."

**E2.**

```
Memorias con rank_score >= 45:          {24e41d3c, 4dd8542f, 63262b11, d9f0b176}
Memorias con evidencia real:            {63262b11, 4dd8542f, d9f0b176, 24e41d3c}

Intersección:                            4/4
Con evidencia pero SIN rank >= 45:       0
Con rank >= 45 pero SIN evidencia:       0
```

Conjuntos idénticos, verificado sobre la población completa (no una
muestra).

**E3.** 4/4 memorias que llegaron a Extract (100%) produjeron al menos
un insight validado y persistido — la tasa de éxito condicional del
pipeline interno, dado un input real, es 100% en todos los casos
disponibles para medir.

**E4.** `focusMemoryId` se resuelve por `getById` (sin filtro) y se
antepone a la lista de candidatos (`relevantMemories`, línea 207-212 de
`assemble-reality-snapshot.ts`); el filtro de rank
(`memoriesWithRealSignal`, línea 226-228) se calcula **inmediatamente
después**, sobre esa misma lista ya combinada — sin ninguna excepción
para la memoria forzada.

---

## 6. Conclusiones

- **C1 — H2 CONFIRMADA. Confianza: alta.** Evidencia: E2 (coincidencia
  exacta de conjuntos, población completa) y E4 (verificación de
  código: el filtro de rank corre después de forzar la memoria, sin
  excepción para ella). El 95.1% de pérdida medido en la investigación
  anterior no ocurre dentro del pipeline Extract→Persist — ocurre
  **antes**, en qué memorias `assembleRealitySnapshot` decide incluir
  en `snapshot.memory.items`, gateado por el mismo umbral (`rank.score
  >= 45`) cuyo recall de 10.3% ya se midió en
  `2026-08-02_knowledge_engine_memory_rank_score.md`.
- **C2 — H1 (tal como se formuló originalmente) REFUTADA como causa
  primaria. Confianza: alta dentro de los datos disponibles, con una
  salvedad honesta de tamaño de muestra (ver más abajo).** El pipeline
  Extract→Classify→Generate→Validate→Persist, cuando efectivamente
  recibe una memoria con rank suficiente, la convierte en insight el
  100% de las veces observadas (E3). No hay evidencia de pérdida
  dentro de esas etapas.
- **C3 — H3 y H4 REFUTADAS como causa primaria. Confianza: media-alta
  (N=4 es el 100% de la población disponible del Founder, no una
  muestra pequeña de un universo más grande — pero sigue siendo un
  número pequeño en términos absolutos).** Ninguna de las 4 memorias
  que llegó a Generate/Validate fue rechazada. Esto no prueba que
  Generate/Validate nunca puedan perder algo — prueba que, con la
  evidencia disponible hoy, no son la causa del 95.1% de pérdida ya
  medido; una muestra más grande (que requeriría primero resolver C1)
  sería necesaria para descartarlos con más confianza todavía.
- **C4 — H5 (nula) REFUTADA. Confianza: alta**, por las mismas razones
  ya establecidas en las dos investigaciones anteriores: el contenido
  descartado antes de llegar a Extract incluye mensajes que un juicio
  independiente clasificó como genuinamente reveladores (ver el
  benchmark de la primera investigación).
- **Hallazgo que cierra el ciclo con la investigación anterior:** la
  recomendación R3 de `2026-08-02_pipeline_loss_before_ranking.md`
  ("investigar por separado la pérdida del 95.1% dentro del propio
  Knowledge Engine") queda respondida — **no es una pérdida separada.
  Es la misma causa raíz de la primera investigación (el matcher léxico
  de 10.3% de recall), apareciendo por segunda vez, en un punto
  distinto del sistema** (el filtro de `snapshot.memory.items`, no el
  gate de encolado). Dos síntomas medidos independientemente
  (enqueueing casi detenido, y ahora conversión de jobs casi nula),
  una sola causa raíz confirmada dos veces con datos reales
  independientes.

**Respuesta directa a "determinar el cuello de botella primario":** el
cuello de botella primario del Knowledge Engine, de principio a fin,
es el mismo en las tres investigaciones de este día: el matcher léxico
de `DeterministicMemoryRankingStrategy`
(`MIN_SCORE_WITH_UNDERSTANDING_SIGNAL = 45`, recall medido 10.3%). No
hay tres problemas distintos — hay un problema que se manifiesta en
tres puntos de lectura distintos del mismo sistema.

---

## 7. Recomendaciones

Ninguna implementada. Las opciones ya evaluadas con las 8 dimensiones
completas en `2026-08-02_knowledge_engine_memory_rank_score.md`
(ampliar la lista léxica / agregar categoría "logro de vida" /
mecanismo semántico) aplican aquí sin cambios — resolver la causa raíz
ahí resuelve, automáticamente, los tres síntomas medidos hoy. Se
agrega una cuarta opción, específica de esta investigación:

### R4 — Eximir la memoria que disparó el job (`focusMemoryId`) del filtro de rank, solo dentro de `processKnowledgeJob`

| Dimensión | Evaluación |
|---|---|
| Impacto esperado | Bajo pero inmediato — no aumenta el recall general de Ranking (eso sigue siendo 10.3%), pero cierra la brecha específica entre "el sistema decidió crear un job para esta memoria" y "el sistema examina esa memoria." Hoy, `focusMemoryId` promete exactamente eso ("evita que Knowledge procese evidencia distinta a la que lo disparó") y el filtro de rank lo incumple en el 97.8% de los casos. |
| Riesgos | Bajos — el efecto está acotado a memorias que ya dispararon un job real (nunca abre la puerta a contenido arbitrario), y solo dentro de `processKnowledgeJob`, no en el chat ni en Morning Brief. |
| Costo | Muy bajo — un condicional adicional en `assembleRealitySnapshot` o en `processKnowledgeJob`. |
| Complejidad | Baja. |
| Compatibilidad Architecture V1 | Total — ajuste de comportamiento dentro de código ya existente. |
| Impacto Responsible AI | Ninguno. |
| Impacto sobre sesgo | Reduce un sesgo específico y medible: hoy el sistema le promete a sí mismo examinar la memoria que disparó el trabajo, y sistemáticamente no lo hace. |
| Impacto sobre varianza | Ninguno — sigue siendo determinista. |
| Impacto sobre evaluabilidad futura | Alto — after implementarlo (si se decide), el mismo cruce de conjuntos de esta investigación (E2) es el experimento correcto para confirmar que cerró la brecha. |

**Nota de alcance:** R4 no reemplaza resolver la causa raíz (R1-R3 de
la investigación anterior) — solo repararía la promesa específica de
`focusMemoryId`. El 97.8% de memorias que nunca disparan un job
porque nunca cruzan rank ≥ 45 en primer lugar seguiría exactamente
igual sin tocar el matcher mismo.
