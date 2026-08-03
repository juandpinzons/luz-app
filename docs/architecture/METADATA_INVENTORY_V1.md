# METADATA INVENTORY V1

**Status:** Investigación — sin cambios de código\
**Fecha:** 2026-08-03\
**Alcance:** Memory, Knowledge (Insight/Belief/Concept/Contradiction/Reasoning), Context, Voice — toda la metadata real que estos sistemas ya calculan o persisten, dónde nace, dónde se pierde, dónde llega a la persona.\
**Método:** lectura directa de cada entidad real (`core/*/entities`, `core/*/value-objects`) y de cada consumidor real (`features/chat/context-builder`, `app/life`, `app/memories`, `app/dashboard`) — sin inferencia sobre lo que "debería" existir.\
**No propone cambios.** Es el mapa que pediste para priorizar después.

---

## Cómo leer esto

Por cada categoría: qué existe, dónde nace, dónde se pierde, dónde llega hoy a la persona, y potencial (Alto/Medio/Bajo) para percepción de inteligencia si se cerrara la brecha. "Se pierde" no siempre significa "bug" — varias veces es una capa que decidió no propagar algo a propósito. Lo marco igual, para que la priorización sea tuya, no mía.

---

## 1. Tiempo

| Dato | Nace en | Se pierde en | Llega al usuario en |
|---|---|---|---|
| `Memory.occurredAt`/`createdAt` | Captura (`DefaultCaptureStage`) | Ya no — `ContextItem` no lo cargaba, corregido (Incremento 2, `favor-prioritized-context-rule.ts`) | `/memories`, `/life` timeline, y **ahora también chat** |
| `Belief.firstObservedAt`/`lastReinforcedAt` | Consolidación (`consolidate-belief-from-insight.ts`) | La fecha en sí no se pierde (se puede ver en `/life/beliefs/[id]`), pero la **tendencia derivada** (`deriveBeliefTrend()`, `core/belief-engine/services/belief-trend.ts:13-30`: new/strengthening/weakening/stable) nunca se cita como tal en ningún texto — ni en `/life/identity`, ni en `ConfirmStrategyRule`/`ReflectStrategyRule` (citan `statement`+`confidence`, nunca la dirección del cambio) | Solo indirectamente, vía `core/predictive-engine`'s `PendingPrediction` — y solo si el patrón se confirmó 2+ veces |
| `BeliefHistoryEntry` (`previousConfidence`, `newConfidence`, `changeReason`, `changedAt`) | Cada cambio real de confianza de un Belief | **Completamente** — es un changelog append-only real de cómo cambió el entendimiento, y no encontré ningún consumidor fuera de `deriveBeliefTrend()` comparando las últimas dos filas | En ningún lugar como changelog visible — ni `/life/beliefs/[id]`, ni chat |
| `EvolutionEvent` (`belief_created/strengthened/weakened/expired/retracted`, `insight_discovered` + `description` real) | `core/temporal-evolution`, derivado de `belief_history`/insights en cada consulta | La descripción **individual** de cada evento se agrega/resume (cuenta, o color de mood) antes de llegar a cualquier texto — `describe-evolution.ts` la convierte en "Entendí N cosas nuevas sobre ti" (un número), `identity-evolution` la convierte en el color del avatar (nunca texto) | `/life/identity` ("Últimos N días"), Dashboard (mood del avatar, sin texto) — la frase específica de cada evento, nunca |
| `InsightExplanation.spanDays`/`daysSinceMostRecentEvidence` | `explainInsight()` | Ya no para insights (Incremento 1, hoy) | `/memories`, chat |
| `CuriosityQuestion.coverageScoreAtCreation` | Generación de la pregunta | Sí — solo se usa internamente para decidir si la pregunta caducó (`resolveStaleCuriosityQuestions`), nunca se muestra "esto lo noté hace X" | En ningún lado |

**Potencial: Alto para `BeliefHistoryEntry` y la tendencia de Belief.** Es la diferencia entre "creo que te importa la disciplina" y "he visto que esto se ha vuelto más importante para ti en los últimos dos meses" — exactamente el tipo de frase que hace que alguien piense "no entiendo cómo se acordó de eso", con datos ya reales detrás, cero inferencia nueva.

---

## 2. Evidencia

| Dato | Nace en | Se pierde en | Llega al usuario en |
|---|---|---|---|
| `Evidence` (Insight→Memory, texto real citable) | `enrichKnowledgeGraph` | No — ya se cita (`/memories` InsightCard, hasta 2 citas) | `/memories`. En chat: no las citas, pero sí la síntesis (`description`) |
| `BeliefEvidence` (Belief→Insight/Memory) | Consolidación de Belief | Se pierde específicamente en el camino de **chat** — `/life/beliefs/[id]` sí la muestra (evidencia real citada), pero `ConfirmStrategyRule`/`ReflectStrategyRule` solo citan `statement`+número, nunca la evidencia detrás | `/life/beliefs/[id]` únicamente |
| `ConceptEvidence` | Extracción de conceptos | Igual que arriba — reach solo en `/life/concepts/[id]` | `/life/concepts/[id]` únicamente |
| `ReasoningEvidence.role` (**"supporting" vs "contradicting"**) | Reasoning Engine, etapa Reason | **Totalmente.** Un `ReasoningConclusion` puede tener evidencia que lo respalda Y evidencia que lo contradice al mismo tiempo — ese matiz nunca se renderiza en ningún lado. `ReflectStrategyRule` (`reflect-strategy-rule.ts:56-63`) y `/life/identity` ("Conexiones que he hecho") solo muestran `statement` + `confidenceScore`, nunca de qué está hecha esa confianza | En ningún lado |
| `ReasoningConclusion.uncertaintyNotes[]` | Reasoning Engine, siempre poblado por diseño (docblock: "el sistema está diseñado para siempre declarar lo que no puede sostener todavía") | **Totalmente** — ni `ReflectStrategyRule` ni `/life/identity` lo leen | En ningún lado |

**Potencial: Alto para `uncertaintyNotes` y `ReasoningEvidence.role`.** Esto es, literalmente, la infraestructura ya construida para que LUZ diga *"he notado que sueles postergar esto cuando estás cansado — aunque la vez de la semana pasada fue distinta"* en vez de una afirmación plana. Es matiz real, no honestidad genérica: el sistema ya sabe exactamente cuál es la excepción.

---

## 3. Relaciones

| Dato | Nace en | Se pierde en | Llega al usuario en |
|---|---|---|---|
| `MemoryConnection` (memoria↔memoria, `strength`) | `DefaultConnectStage`, cada captura | Se **usa** para elegir candidatas (`select-contextual-memories.ts:98-122`) pero la relación en sí nunca se dice — ver Hallazgo 2 de la sesión anterior, ya documentado, no reabierto aquí | `/memories` (MemoryCard muestra 1 conexión + conteo, sin decir qué las conecta) |
| `InsightRelationship` (insight↔insight, `relationType`, `strength`) | Reasoning Engine, etapa Correlate (construye clusters vía BFS sobre esta misma arista) | La arista se **consume** para decidir qué insights se combinan en una `ReasoningConclusion`, pero cuál era la relación específica nunca se dice | En ningún lado directamente — solo indirectamente, como el "por qué" implícito de una conclusión ya fusionada |
| `ConceptRelation` (concepto↔concepto, ej. "Gimnasio lleva_a Disciplina") | Extracción de conceptos | No en `/life/concepts/[id]` (relations to other concepts, per investigación anterior) | `/life/concepts/[id]` — no en chat |
| `BeliefEvidence`/`ConceptEvidence`/`ReasoningEvidence` como grafo | Varios | Cubierto en la sección Evidencia arriba | — |

**Potencial: Medio-Alto.** `ConceptRelation` en particular es una capacidad narrativa real y sin usar: "Gimnasio → Disciplina" es exactamente el tipo de conexión que, dicha con naturalidad, se siente como comprensión profunda, no como un dato recuperado.

---

## 4. Importancia

| Dato | Nace en | Se pierde en | Llega al usuario en |
|---|---|---|---|
| `Memory.rank.score` | `DeterministicMemoryRankingStrategy` | El **número** sobrevive; **cuáles de las 9 categorías** (`life_transition`, `vulnerability`, `important_decision`...) hicieron que puntuara así se calculan y se descartan en la misma función (`deterministic-memory-ranking-strategy.ts:228-230`) — nunca se persisten | Solo el número, indirectamente, en el orden de aparición |
| `ImportanceScore.reason` (**campo de texto real, distinto del score**) | `core/importance-engine` | El número (`score`) se usa en `DeterministicContextScoringStrategy.importanceBonus()` y en `rankByImportance()` (`build-identity-model.ts`) — **`reason` (el string) no lo leí usado en ningún lado** | En ningún lado — solo el número influye en orden, nunca la razón como texto |
| `Contradiction`/`ReasoningConclusion`/`Belief.confidence` | Varios | Ya cubierto (Evidencia, Tiempo) | Parcial |

**Potencial: Alto para las categorías de rank descartadas.** Saber que una memoria puntuó alto específicamente por `vulnerability` + `important_decision` (no solo "puntuó alto") es la diferencia entre tratarla con el peso correcto y tratarla genéricamente. **Potencial: Medio para `ImportanceScore.reason`** — ya existe como texto, listo para citar, sin ningún trabajo de síntesis nuevo.

---

## 5. Identidad

| Dato | Nace en | Se pierde en | Llega al usuario en |
|---|---|---|---|
| `PersonIdentityModel` completo (`topBeliefs`, `topConcepts`, `openContradictions`, `topReasoningConclusions`, `pendingPredictions`, `recentEvolution`) | `buildIdentityModel()` | **Por diseño, declarado en su propio docblock** (`build-identity-model.ts:100-102`): *"Consumido por el endpoint de LifeGraph... y, en una fase futura, por el prompt de chat — no todavía en este bloque"* — no es un bug, es una fase pendiente ya nombrada por quien lo construyó | Solo `/life/identity` |
| `IdentityEvolution.deemphasized[]` (temas que dejaron de definir a la persona, con memoria real de largo plazo detrás) | `features/identity-evolution` | Se traduce a **color del avatar únicamente** — nunca texto, en ningún lado (confirmado: solo 2 consumidores reales de este módulo, ninguno textual) | Dashboard, como mood visual sin palabras |
| Distinción "en formación" vs. "asentada" (`GROWING_BELIEF_MAX_CONFIDENCE`) | `assemble-reality-snapshot.ts` | **No se pierde** — este es un caso donde SÍ llega igual a `/life/identity` y a chat (`ConfirmStrategyRule` usa exactamente esta banda). Lo incluyo para que el mapa no sea solo de brechas. | `/life/identity` y chat, consistente |

**Potencial: Muy alto, ya reconocido por el propio equipo.** Este es el hallazgo más grande de todo el inventario en volumen: una síntesis completa de identidad, ya construida, ya validada en `/life/identity`, con una fase futura ya nombrada para chat que nunca se ejecutó. No es un descubrimiento — es una promesa ya escrita, pendiente.

---

## 6. Emoción

**Hallazgo honesto: esta categoría está estructuralmente vacía.** No existe ningún campo persistido, en ninguna entidad de `core/`, que capture el estado emocional de la persona. Lo más cercano:

- Las categorías `vulnerability`/`emotional_turning_point` en `UNDERSTANDING_SIGNALS` (Memory ranking) — detectan la **presencia** de contenido emocional por palabra clave, para efectos de puntaje — no lo etiquetan ni lo persisten como una emoción identificable.
- `AvatarMoodSignal` (`emotion`, `intensity`, `gaze`) — es el estado de ánimo **de LUZ misma** (derivado de Presence+Experience+Narrative+Identity combinados), no una memoria del estado emocional de la persona.

No hay nada que "se pierde" aquí porque nunca se capturó estructuradamente. Lo nombro explícitamente porque el mapa pedía las 8 categorías, no porque haya encontrado una oportunidad — inventar algo aquí sería exactamente el tipo de dato fabricado que Principio 9 prohíbe.

**Potencial: No aplica a esto documento** (no hay dato real que activar). Si esto importa, es una conversación de captura, no de transmisión — fuera del alcance que definiste ("no implementes nada nuevo, haz visible lo que ya existe").

---

## 7. Objetivos

| Dato | Nace en | Se pierde en | Llega al usuario en |
|---|---|---|---|
| `Goal`/`Project`/`Habit` — título, `domain`, `dueDate`/`targetDate` | `core/life` | `DeterministicContextFilterStrategy` (`deterministic-context-filter-strategy.ts:29-49`) traduce cada uno a `ContextItem{label: item.title, dueDate}` — **`domain` no viaja, y no hay ningún campo que diga si es un Goal, un Project o un Habit** — el modelo ve "Maratón" sin saber si es una meta, un proyecto o un hábito | `/life` (con toda la distinción real), Dashboard (arbitrado), chat (solo título + urgencia implícita en el orden) |
| `dueDate` → urgencia | `urgencyBonus()` (Context Engine scoring) | El **puntaje** de urgencia sí influye en el orden — pero el texto nunca dice "vence en 3 días": el mismo patrón exacto del Incremento 2, sin corregir todavía para `life` | Solo como orden implícito, nunca como frase |
| `status` (`active`/`completed`/`abandoned`/`cancelled`) | `core/life` | Filtrado aguas arriba (`listActiveGoals` solo trae `active`) — la distinción entre las otras 3 nunca llega a `ContextItem` tampoco, aunque para chat probablemente no haga falta (solo lo activo es candidato) | `/life` (con status real, incl. "celebrado" si completado) |

**Potencial: Alto, y es literalmente el mismo arreglo que ya hicimos en el Incremento 2, aplicado a `life` en vez de `memory`.** Es el candidato más directo y de menor riesgo de todo este inventario si se prioriza implementación.

---

## 8. Contexto

| Dato | Nace en | Se pierde en | Llega al usuario en |
|---|---|---|---|
| `CalendarSignal` | Calendar Foundation | No — ya llega (`FavorPrioritizedContextRule`, sección "signal") | Chat, `/calendar` |
| `CommunicationPreferenceSnapshot` | Fast User Understanding (Beliefs `category: communication_style`) | No — ya llega a Voice (`userPreferenceNotes`) | Chat (implícito en el tono, nunca mostrado como regla) |
| `ConversationVarietyRuleSignal.fatiguedDomain` | `features/conversational-variety` | Se usa para **suprimir** un tema — la supresión en sí nunca se explica ("no te pregunto de X porque ya hablamos mucho de eso") — pero esto probablemente sea silencio correcto (Principio 4), no una pérdida real | Nunca, por diseño razonable |
| `ReconnectionContext`/`NarrativeState` (`activeThread`, `chapterLabel`, `summary`, `changes[]`) | `assembleReconnectionContext` | No — ya llega (`FrameReconnectionRule`) | Chat, al reabrir tras un vacío real |

**Potencial: Bajo** — esta es la categoría más sana del inventario. La mayoría de lo que nace aquí ya llega a donde debe.

---

## Resumen — potencial por categoría, ordenado

| Categoría | Potencial | Por qué |
|---|---|---|
| Identidad | **Muy alto** | Síntesis completa ya construida, fase de chat ya nombrada y pendiente, cero trabajo de diseño nuevo necesario para decidir *qué* mostrar — solo *cómo* dosificarlo |
| Evidencia | **Alto** | `uncertaintyNotes` y `ReasoningEvidence.role` son matices ya calculados, listos para dar honestidad con textura en vez de genérica |
| Tiempo | **Alto** | `BeliefHistoryEntry` es el changelog real de "cómo cambiaste" que nadie ha mostrado nunca |
| Objetivos | **Alto** | Mismo arreglo exacto que Incremento 2, ya probado, aplicado a un dato distinto |
| Importancia | **Alto / Medio** | Categorías de rank descartadas (alto valor, requiere persistir un campo nuevo) vs. `ImportanceScore.reason` (medio esfuerzo, el texto ya existe) |
| Relaciones | **Medio-Alto** | `ConceptRelation` sin usar; `MemoryConnection` ya nombrado como más complejo de lo que parece |
| Contexto | **Bajo** | Ya está mayormente bien conectado |
| Emoción | **N/A** | No hay dato real que activar — esto es captura, no transmisión |

Sin implementar nada, como pediste. Cuando quieras priorizar, este documento es el punto de partida.
