# Investigación: qué recuerda LUZ realmente, contra lo que un usuario esperaría

Metodología: `docs/engineering/TECHNICAL_INVESTIGATION_METHODOLOGY_V1.md`.\
Fecha: 2026-08-02\
Alcance: representación completa de memoria en producción — almacenamiento,
embeddings, recuperación por similitud vectorial, metadata, conexiones,
y contexto final ensamblado — para hechos representativos (metas,
gastos, identidad, relaciones, rutinas, logros).\
**Ningún código de producción fue modificado durante esta
investigación.** Toda la evidencia de abajo viene de lectura directa
de código fuente y de correr las funciones reales de recuperación
(`selectContextualMemories`, `MemoryEngine.retrieve()`) contra datos
reales de producción, en modo lectura.

---

## 1. Observaciones

- **O1.** `memory_embeddings` tiene 0 filas en toda la base de
  producción. La extensión `pgvector` sí está instalada (v0.8.1), la
  columna `embedding` sí tiene tipo `vector` real — pero no existe
  ningún índice de similitud (`ivfflat`/`hnsw`) sobre esa columna, solo
  índices btree sobre `id`/`source`/`life_graph_id`. La infraestructura
  se construyó parcialmente; nunca se terminó de conectar.
  *Evidencia: `select count(*) from memory_embeddings` → 0.
  `select extname, extversion from pg_extension where extname =
  'vector'` → `{vector, 0.8.1}`. `select indexdef from pg_indexes
  where tablename = 'memory_embeddings'` → 3 índices btree, ninguno
  vectorial.*
- **O2.** Existe un módulo completo, `core/memory/` (distinto de
  `core/memory-engine/`, el que sí está vivo), con una interfaz real
  `SemanticMemoryRepository` ("recuperados por significado (embeddings
  + pgvector), no por palabra exacta") y una implementación real,
  `NotImplementedSemanticMemoryRepository`, que **lanza un error
  explícito** en vez de devolver resultados vacíos en silencio:
  *"búsqueda semántica aún no implementada (pendiente de generación de
  embeddings)."* Todo el módulo `core/memory/` tiene **cero llamadores
  reales** en `app/`, `features/`, `core/` (fuera de sí mismo), `worker/`,
  o `smoke/` — código muerto, nunca conectado a nada vivo.
  *Evidencia: `core/memory/semantic/semantic-memory.repository.ts`
  completo. `grep` de todo el árbol real por
  `semantic-memory.repository|structured-memory.repository|core/memory/memory-engine` →
  cero resultados fuera del propio módulo.*
- **O3.** El mecanismo de recuperación que sí está vivo
  (`core/memory-engine/`) documenta, en tres archivos distintos, de
  forma explícita, que no usa embeddings:
  `select-contextual-memories.ts` ("sin embeddings, sin infraestructura
  nueva"), `memory-retrieval-strategy.ts` ("recuperación semántica...
  no existe todavía"), `structured-memory-retrieval-strategy.ts`
  ("sin embeddings... la mitad semántica... todavía no construida,
  PR-020").
- **O4.** El mecanismo real, verificado por lectura de código:
  - **Con mensaje actual** (`selectContextualMemories`, el camino del
    chat): trae un pool de 30 candidatas por `rank_score` (ya real),
    puntúa cada una por *tokens compartidos* con el mensaje actual
    (peso 20 por token, coincidencia de subcadena exacta tras
    minúsculas, sin stemming ni sinónimos) + bono de 15 si el tipo de
    memoria coincide con el tipo del mensaje + `rank.score × 0.3`.
  - **Sin mensaje actual** (`MemoryEngine.retrieve()`, usado p. ej. sin
    un mensaje puntual que anclar): ordena directamente por
    `rank.score` (dominante) + bono de conexiones estructurales + bono
    de recencia recalculado en cada consulta.
  - Ninguno de los dos caminos compara significado — ambos son
    coincidencia léxica y aritmética sobre `rank_score`, nunca
    similitud vectorial.
- **O5 (empírico — el hallazgo central).** Se corrió la función real
  `selectContextualMemories` (importada del código fuente, no
  reimplementada) contra los datos reales de la cuenta del Founder,
  con 6 consultas representativas en lenguaje natural, una por
  categoría pedida (metas, gastos, identidad, relaciones, rutinas,
  logros). Resultado, memoria por memoria, en el Apéndice. Resumen: de
  30 lugares de contexto devueltos (6 consultas × 5 resultados), **solo
  1 era genuinamente relevante para la pregunta que lo trajo (3.3%)**,
  y **18 de los 30 (60%) venían de un mismo cúmulo de 4 memorias** —
  las mismas 4 que investigación 1 (`2026-08-02_knowledge_engine_memory_rank_score.md`)
  ya había identificado como las únicas con `rank_score >= 45` en toda
  la historia de esta cuenta.
- **O6.** La consulta "¿Qué logros tengo?" no devolvió la memoria real
  de logro (el servicio militar) en ningún lugar de los 5 resultados.
  Esto no es una construcción artificial de esta investigación — el
  propio Founder ya vivió exactamente este fallo en una conversación
  real: pidió explícitamente que se anotara ese logro
  ("Quiero que lo anotes como Logro y lo pongas en mi mapa de vida"),
  y más tarde, al preguntar por sus logros, escribió textualmente "No
  sale en logros mi ida al ejercito... No estas recordando??" — esta
  investigación reproduce ese fallo real, end-to-end, con código real,
  contra los mismos datos reales.
- **O7.** 557 de 557 `memory_connections` de esta cuenta (100%) tocan
  al menos una de las mismas 4 memorias de `rank_score >= 45`. Las 557
  tienen `strength = 50` (`SAME_PERSON_STRENGTH`, el detector
  `samePersonMatches` de `DefaultConnectStage`, que explícitamente
  exige `rank.score >= 45` en el candidato) — cero tienen `strength =
  100` (`sameOriginMatches`, mismo origen exacto). El grafo de
  conexiones de esta cuenta es, en la práctica, una estrella con 4
  centros, no una red real.
  *Evidencia: cruce directo entre `memory_connections` y `memories`
  filtradas por `rank_score >= 45`, población completa.*
- **O8.** El camino "sin mensaje actual" (`MemoryEngine.retrieve()`,
  usado cuando no hay un mensaje puntual al que anclar la recuperación)
  devuelve, de forma no condicional, esas mismas 4 memorias en los
  primeros lugares — es una consecuencia matemática directa de que
  `rank_score` domina ese ordenamiento y solo esas 4 memorias tienen un
  `rank_score` que se distinga del resto.

---

## 2. Mediciones

| Métrica | Valor |
|---|---|
| % de memorias con embedding real | 0% (0/179 cuenta del Founder, 0/285 sistema completo) |
| Índice de similitud vectorial existente | Ninguno |
| Llamadores reales de `core/memory/` (el módulo con embeddings diseñados) | 0 |
| Lugares de contexto genuinamente relevantes, 6 consultas reales × 5 resultados (N=30) | 1 (3.3%) |
| Lugares de contexto provenientes del cúmulo de 4 memorias de alto rank (mismo N=30) | 18 (60%) |
| `memory_connections` que tocan ese mismo cúmulo de 4 | 557/557 (100%) |
| Distribución de `strength` en `memory_connections` | 100% en 50 (`samePersonMatches`), 0% en 100 (`sameOriginMatches`) |

---

## 3. Hipótesis

- **H1.** La ausencia de búsqueda semántica explica, por sí sola, la
  mayoría de lo que no se recupera — contenido parafraseado sin
  coincidencia léxica exacta nunca puede encontrarse por significado
  porque esa capacidad no existe.
- **H2.** Incluso sin búsqueda semántica, la heurística de tokens
  compartidos + `rank_score` + conexiones debería bastar para
  recuperar razonablemente contenido real cuando SÍ hay coincidencia
  léxica — los fallos observados tienen una causa distinta, no la
  simple ausencia de embeddings.
- **H3.** La concentración observada (60% de los lugares de contexto,
  100% de las conexiones) tiene la misma causa raíz que ya identificaron
  las tres investigaciones de esta mañana: el filtro `rank_score >= 45`
  (10.3% de recall medido) deja solo 4 memorias "elegibles" en toda la
  cuenta, y esas 4 terminan dominando cualquier mecanismo que use
  `rank_score` como señal de peso — no solo el encolado de Knowledge
  Engine, también la recuperación de contexto y la candidatura de
  conexiones.
- **H4 (nula).** La recuperación funciona razonablemente bien; las
  consultas representativas elegidas para esta investigación
  simplemente no fueron las más favorables.

---

## 4. Experimentos

### E1 — Estado real de la infraestructura de embeddings

- **Objetivo:** confirmar o refutar H1 en su forma más básica — ¿existe
  siquiera la posibilidad técnica de búsqueda semántica hoy?
- **Metodología:** consulta directa a `memory_embeddings`,
  `pg_extension`, `pg_indexes`; lectura de
  `core/memory/semantic/semantic-memory.repository.ts` completo;
  búsqueda de todo el árbol real por cualquier llamador de ese módulo.
- **Métricas:** filas en `memory_embeddings`; llamadores reales del
  módulo semántico.
- **Criterio de éxito (para H1):** 0 filas, 0 llamadores reales.
- **Criterio de fracaso:** cualquier evidencia de uso real.

### E2 — Simulación real de recuperación contra consultas representativas

- **Objetivo:** medir, con la función real de producción, qué tan bien
  se recupera contenido real para preguntas naturales representativas
  de las 6 categorías pedidas.
- **Metodología:** `selectContextualMemories` (importada del código
  fuente real, no reimplementada) corrida contra los datos reales de la
  cuenta del Founder, una consulta por categoría, límite 5 resultados
  cada una. Clasificación de cada resultado como "relevante" o "no
  relevante" para la consulta que lo trajo, hecha después de tener los
  resultados (no ciega — a diferencia de la investigación 1, aquí el
  juicio es sobre relevancia tema-a-tema, no sobre las mismas 9-10
  categorías ya validadas esa vez).
- **Variables:** fijo = contenido real de la cuenta, sin alterar.
  Medido = qué se recupera para cada consulta.
- **Métricas:** % de resultados relevantes; % de resultados
  provenientes del cúmulo de 4 memorias de alto rank.
- **Criterio de éxito (para H2/H3):** baja relevancia Y alta
  concentración en el mismo cúmulo ya identificado esta mañana.
- **Criterio de éxito (para H4):** alta relevancia general.

### E3 — Concentración del grafo de conexiones

- **Objetivo:** confirmar o refutar si la concentración observada en
  recuperación (E2) también aparece, de forma independiente, en
  `memory_connections` — una estructura que no depende de ninguna
  consulta en lenguaje natural, solo de `rank_score` en el momento de
  la captura.
- **Metodología:** cruce directo entre `memory_connections` y
  `memories` filtradas por `rank_score >= 45`, población completa (no
  muestra).
- **Métricas:** % de conexiones que tocan el cúmulo de 4; distribución
  de `strength`.
- **Criterio de éxito (para H3):** concentración alta, coherente con
  E2, y explicable directamente por el mismo umbral de 45 puntos.

---

## 5. Resultados

**E1.** `memory_embeddings`: 0 filas. Índice vectorial: ninguno.
Llamadores reales de `core/memory/`: 0. `NotImplementedSemanticMemoryRepository`
lanza explícitamente en vez de fallar en silencio.

**E2.** Ver Apéndice para el detalle memoria-por-memoria de las 6
consultas. Resumen: 1/30 lugares de contexto relevantes (3.3%); 18/30
(60%) provenientes de un cúmulo de 4 memorias. La consulta de "metas"
fue la única con una recuperación real y relevante en el primer lugar
(coincidencia léxica directa de la palabra "metas"); las otras 5
consultas (gastos, identidad, relaciones, rutinas, logros) no
recuperaron, en ninguno de sus 5 lugares, el contenido real más
directamente relevante que sí existe en la cuenta.

**E3.** 557/557 conexiones (100%) tocan el mismo cúmulo de 4 memorias.
100% de las conexiones son `strength: 50` (`samePersonMatches`,
gateado por `rank.score >= 45`); 0% son `strength: 100`
(`sameOriginMatches`, sin ese gate).

---

## 6. Conclusiones

- **C1 — H1 CONFIRMADA parcialmente, no como causa única. Confianza:
  alta.** La ausencia de búsqueda semántica es real y estructural
  (E1) — pero **no explica, por sí sola, la magnitud de lo observado**.
  La consulta de "metas" tuvo éxito precisamente porque hubo
  coincidencia léxica directa, lo que demuestra que el mecanismo actual
  SÍ puede funcionar cuando las palabras coinciden — el problema mayor,
  medido en E2/E3, es otro.
- **C2 — H3 CONFIRMADA. Confianza: alta.** El mismo umbral de 45 puntos
  que las tres investigaciones de esta mañana ya responsabilizaron por
  el 10.3% de recall en el encolado de Knowledge Engine es, verificado
  aquí de forma independiente, **también** la causa directa de que:
  (a) 60% de los lugares de contexto en consultas reales terminen
  ocupados por las mismas 4 memorias sin importar el tema de la
  pregunta, y (b) el 100% del grafo de conexiones de esta cuenta gire
  alrededor de esas mismas 4. No son tres hallazgos de esta mañana más
  uno nuevo — es la cuarta manifestación medida, de forma
  independiente, de la misma causa raíz.
- **C3 — H2 CONFIRMADA como el efecto dominante. Confianza: alta.**
  Incluso para preguntas con coincidencia léxica razonable disponible
  (identidad: "Trabajador, asertivo, soñador..." existe literalmente en
  la cuenta; logros: el servicio militar existe, con la palabra
  "Logro" en su propio texto), esa coincidencia perdió sistemáticamente
  contra el peso de `rank.score × 0.3` de las 4 memorias del cúmulo —
  no porque esas 4 fueran más relevantes, sino porque su `rank_score`
  (49) es 2.5× más alto que el de casi cualquier otra memoria (19), una
  ventaja que ningún conteo razonable de tokens compartidos logra
  revertir de forma consistente.
- **C4 — H4 (nula) REFUTADA. Confianza: alta, con evidencia
  corroborante fuera de esta investigación.** El caso de "logros" no es
  una consulta desafortunada elegida al azar — es, palabra por palabra,
  el mismo fallo que el propio Founder ya reportó viviendo en una
  conversación real ("No sale en logros mi ida al ejercito... No estas
  recordando??"). Esta investigación reproduce ese reporte real con
  código real contra datos reales, no lo inventa.

**Tensión honesta con una decisión ya cerrada hoy:** `ADR-0022`
(cerrada esta misma fecha) dejó explícitamente `rank_score` como
señal legítima, sin cambios, para "candidatura de conexión entre
memorias" — descrita ahí como *"el uso de bajo riesgo, síncrono, para
el que esa señal sigue siendo la correcta... un falso negativo es
recuperable más adelante."* Esta investigación mide que ese mismo uso
concentra el 100% del grafo de conexiones reales de esta cuenta
alrededor de 4 memorias — un efecto bastante mayor que "ocasionalmente
imperfecto." No propongo reabrir ADR-0022 — el Founder pidió
explícitamente cerrarla y no seguir iterando sobre ese documento
específico. Este hallazgo es nuevo alcance (recuperación de contexto,
no elegibilidad de Knowledge Engine) y, si amerita una corrección
arquitectónica, la sección de cierre de ADR-0022 (§4.4) ya previó
exactamente este caso: una investigación futura que encuentre algo
nuevo sobre `rank_score` es una ADR nueva que sucede a la 0022, nunca
una edición sobre ella.

---

## 7. Recomendaciones

Ninguna implementada. Presentadas como opciones para una futura
decisión, no como una propuesta de arquitectura completa (eso, si se
persigue, es su propio documento).

- **Sobre embeddings (E1):** completar la implementación pendiente
  (generar embeddings reales al capturar cada memoria, agregar un
  índice de similitud) es una opción real, con infraestructura de base
  ya existente (`pgvector` instalado, columna `vector` ya en el
  schema) — el costo principal sería una llamada real de embeddings
  por memoria capturada (una decisión de costo/latencia, mismo tipo de
  análisis que ya se hizo hoy para Knowledge Engine) más construir el
  índice ANN y la consulta de similitud, hoy inexistentes.
- **Sobre la concentración de conexiones (E3):** independiente de si
  se resuelve el problema raíz de `rank_score` (que ya tiene su propio
  proceso, cerrado por hoy), el detector `samePersonMatches` podría
  usar un criterio de candidatura distinto al que gatea el encolado de
  Knowledge Engine — hoy comparte exactamente el mismo umbral por
  coincidencia de nombre de constante, no por una decisión explícita de
  que ambos usos deban tener el mismo criterio.
- **Sobre la heurística de tokens compartidos (E2):** el peso relativo
  entre `rank.score × 0.3` y el conteo de tokens compartidos (`× 20`)
  determina, en la práctica, si una coincidencia léxica real puede
  ganarle a un `rank_score` alto pero fuera de tema — hoy, con la
  distribución real de esta cuenta (scores de 17-19 vs. 48-49), casi
  nunca puede. Recalibrar esos pesos no requiere resolver primero el
  problema de recall de `rank_score` — son ajustes independientes.

**Ninguna de estas tres opciones se excluye entre sí** — atacan capas
distintas del mismo problema (si algo se recuerda en absoluto, si se
puede encontrar por significado, y si lo que se encuentra por
coincidencia léxica logra competir contra el ruido de un cúmulo
pequeño de memorias con score artificialmente alto).

---

## Apéndice — resultado completo, 6 consultas reales

Cada bloque: consulta, y los 5 resultados reales devueltos por
`selectContextualMemories` contra la cuenta del Founder, en orden.
`[cluster]` marca las 4 memorias de `rank_score >= 45` (dos son el
mismo texto duplicado del hallazgo de la auditoría de producción de
esta mañana).

**Metas** — "¿Cuáles son mis metas actuales?"
1. ✅ *relevante* — "Mis metas para los próximos 30 días son..."
2. `[cluster]` "...no me deje llevar por el impulso... Nicolas, el dealer..."
3. `[cluster]` "Juanma, te he tratado como un hermano..."
4. `[cluster]` "Juanma, te he tratado como un hermano..." (duplicado)
5. "No estás recordando Luz."

**Gastos** — "¿Cuánto he gastado esta semana?"
1. `[cluster]` dealer
2. "Ayer te dije cuánto me gasté 1 de agosto" (referencia, no el gasto real)
3. `[cluster]` Juanma
4. `[cluster]` Juanma (duplicado)
5. "No estás recordando Luz."

**Identidad** — "¿Qué sabes de mí?"
1. "Que sabes hoy de mi?" (eco de su propia pregunta pasada, no una respuesta)
2. `[cluster]` "...decidí cortar el vínculo..."
3. `[cluster]` dealer
4. `[cluster]` Juanma
5. `[cluster]` Juanma (duplicado)

**Relaciones** — "¿Cómo va mi relación de pareja?"
1. "10 KM semanal... mejorar relación con mamá..." (lista de metas, no pareja)
2. "Espero usarte todo el día... generar una relación..." (sobre LUZ, no pareja)
3. `[cluster]` dealer
4. `[cluster]` "...decidí cortar el vínculo..."
5. `[cluster]` Juanma

**Rutinas** — "¿Cuál es mi rutina diaria?"
1. `[cluster]` dealer
2. `[cluster]` Juanma
3. `[cluster]` Juanma (duplicado)
4. "No estás recordando Luz."
5. "Como así que no guardas montos exactos??"

**Logros** — "¿Qué logros tengo?"
1. "Ya hemos hablado de mis relaciones y logros pero no las has clasificado..." (queja, no el logro)
2. "Tengo un audi a4 2018 2.0T..." (un hecho real, pero no el logro del servicio militar)
3. "Si! Preferiría que ancles mi historia sobre todo eso..."
4. `[cluster]` "...decidí cortar el vínculo..."
5. `[cluster]` dealer

Ninguna de las 6 consultas recuperó, en sus 5 resultados, el hecho
específico más directamente relevante que sí existe en la cuenta —
salvo "metas," que lo recuperó en primer lugar.
