# Investigación: Knowledge Engine sin trabajo nuevo / Memory Rank Score

Metodología: `docs/engineering/TECHNICAL_INVESTIGATION_METHODOLOGY_V1.md` (primera
investigación real bajo este estándar).\
Fecha: 2026-08-02\
Disparador: auditoría de producción de la misma fecha detectó que
`knowledge_jobs` no recibe filas nuevas desde 2026-07-26, y que 328
insights de una cuenta real trazan a solo 4 memorias fuente.\
Alcance de esta investigación: por qué el Knowledge Engine dejó de
recibir trabajo. No investiga la duplicación de insights en sí (causa
distinta, ya explicada por la ausencia de deduplicación en la
generación de insights — fuera de alcance de esta pregunta concreta).\
**Ningún código de producción fue modificado durante esta
investigación.** Todas las consultas fueron de solo lectura contra una
réplica de solo lectura lógica (la misma base de producción, sin
escrituras); todos los scripts de benchmark corrieron localmente,
fuera del código de la aplicación.

---

## 1. Observaciones

Hechos únicamente, cada uno con su evidencia exacta.

- **O1.** Las 101 memorias creadas para la cuenta del Founder
  (`life_graph_id 856fe1bd-7e14-4046-9c38-600c4b9e6848`) después de
  2026-07-23 tienen `rank_score = 19`, sin excepción.
  *Evidencia: `select rank_score, count(*) from memories where
  life_graph_id = '856fe1bd...' and created_at > '2026-07-23' group by
  rank_score` → una sola fila, `{19: 101}`.*
- **O2.** El `knowledge_job` más reciente creado en toda la base de
  producción (cualquier usuario) tiene `created_at = 2026-07-26T19:34:32Z`.
  *Evidencia: `select max(created_at) from knowledge_jobs`.*
- **O3.** La tabla `beliefs` tiene 0 filas en producción, pese a que
  `core/belief-engine` está importado y activo en
  `features/knowledge/services/enrich-knowledge-graph.ts` desde el
  commit `cd6fdac` (2026-07-26).
  *Evidencia: `select count(*) from beliefs` → 0. `git log
  --diff-filter=A -- features/knowledge/services/enrich-knowledge-graph.ts`.*
- **O4.** El feedback del Founder, enviado 2026-08-02T10:54:42Z, registra
  `helpfulness: 3`, `remembers_me: "no"`.
  *Evidencia: fila única de `feedback_responses` en esa fecha.*
- **O5.** El Founder escribió explícitamente, en al menos tres mensajes
  reales distintos, una queja sobre repetición temática ("Me estás
  trayendo solo un evento traumático y de hace tiempo... Y solo me
  hablas de la keta", "quiero encarecidamente que dejes de hablarme de
  Keta. Todos los días es la misma mierda", "Luz lo pones en todas
  partes. Me lo seguís recordando").
  *Evidencia: contenido real de `memories`, cuenta del Founder.*
- **O6.** El umbral que determina si una memoria encola trabajo para el
  Knowledge Engine (`MIN_SCORE_WITH_UNDERSTANDING_SIGNAL`) es 45.
  *Evidencia: `core/memory-engine/ranking/deterministic-memory-ranking-strategy.ts:183`.*
- **O7.** `DeterministicMemoryRankingStrategy` calcula ese score
  mediante coincidencia de subcadena exacta contra una lista fija de
  70 frases (9 categorías, español/inglés) — sin llamada a IA, por
  diseño explícito documentado en el propio archivo.
  *Evidencia: mismo archivo, líneas 6-27 (docblock) y 211-221
  ("Determinista y sin llamadas a IA a propósito... el objetivo de
  esta fase es un Memory Engine correcto y confiable, no todavía uno
  inteligente").*
- **O8.** De las 179 memorias totales de la cuenta del Founder (todo el
  historial), 4 cruzaron alguna vez el umbral de 45.
  *Evidencia: `select count(*) from memories where life_graph_id =
  '856fe1bd...' and rank_score >= 45` → 4.*
- **O9.** `knowledge_engine_insights` tiene filas en un único día
  calendario, 2026-07-25, en toda la base de producción.
  *Evidencia: `select date(created_at), count(*) from
  knowledge_engine_insights group by date(created_at)` → una sola
  fila.*
- **O10.** Las 328 insights de la cuenta del Founder trazan, vía
  `knowledge_engine_evidence`, a exactamente 4 memorias fuente
  distintas.
  *Evidencia: `select count(distinct memory_id) from
  knowledge_engine_evidence e join knowledge_engine_insights i on
  i.id = e.insight_id where i.life_graph_id = '856fe1bd...'` → 4.*
- **O11.** El único punto del código que decide si una memoria encola
  trabajo del Knowledge Engine es una comparación directa,
  `capturedMemory.rank?.score >= MIN_SCORE_WITH_UNDERSTANDING_SIGNAL`,
  dentro de `finalizeReplyInner`.
  *Evidencia: `features/chat/services/send-message.ts`, bloque que
  llama a `enqueueKnowledgeJob`.*
- **O12.** `knowledge_jobs` no tiene ninguna fila con `status` distinto
  de `completed`, y ninguna fila con `last_error` no nulo.
  *Evidencia: `select status, count(*) from knowledge_jobs group by
  status` → `{completed: 147}`.*

---

## 2. Mediciones

Solo lo directamente computable desde datos existentes. Recall,
precision y F1 se difieren a la Sección 4/5 — requieren el benchmark,
no son mediciones directas.

| Métrica | Valor | Base |
|---|---|---|
| % de memorias del Founder bajo el umbral, desde 2026-07-23 | 100% (101/101) | O1 |
| % de memorias del Founder bajo el umbral, histórico completo | 97.8% (175/179) | O8 |
| Distribución real de `rank_score`, histórico completo (N=179) | `{17: 34, 18: 65, 19: 76, 48: 4}` | consulta directa |
| Densidad de scores entre 20 y 44 (inclusive) | 0% (0/179) | misma consulta |
| `knowledge_jobs` creados por día, sistema completo (17→23 jul) | 10, 42, 50, 7, 3, 16, 18 | consulta por día |
| `knowledge_jobs` creados por día (24 jul → hoy) | 0, 0, 1, 0, 0, 0, 0, 0 (11 días) | misma consulta |
| Segunda cuenta real (Verónica Valencia), % bajo el umbral, histórico | 93.3% (28/30) | consulta equivalente |
| Segunda cuenta, densidad entre 20-44 | 0% (0/30) | misma consulta |
| Cobertura léxica del matcher | 70 frases fijas, 9 categorías | conteo directo sobre `UNDERSTANDING_SIGNALS` |

---

## 3. Hipótesis

- **H1 (primaria).** La lista léxica de frases produce un recall
  demasiado bajo, y por eso el Knowledge Engine deja de recibir
  trabajo.
- **H2 (calibración de umbral).** El matcher funciona razonablemente;
  el umbral (45) está puesto demasiado alto para su distribución real
  de scores.
- **H3 (ponderación incorrecta).** La fórmula de puntaje (bono de
  recencia + tabla por cantidad de categorías) está mal calibrada
  internamente, produciendo scores más bajos de lo que la propia
  lógica del componente pretende.
- **H4 (otra etapa limitante).** El cuello de botella no está en el
  ranking sino en una etapa anterior o posterior — Memory.capture
  fallando silenciosamente, o un segundo gate no identificado entre
  `rank()` y el encolado.
- **H5 (alcance limitado).** El problema es específico de la cuenta
  del Founder (volumen o estilo de escritura particular), no
  generalizable al resto de usuarios.
- **H6 (nula).** No hay ningún problema real: el bajo volumen de
  `knowledge_jobs` refleja correctamente que casi nada de lo escrito
  por los usuarios revela algo duradero. El sistema funciona como fue
  diseñado.

---

## 4. Experimentos

### E1 — Benchmark de recall/precision contra clasificación independiente

- **Objetivo:** confirmar o refutar H1 y H6 simultáneamente.
- **Metodología:** las 179 memorias reales de la cuenta del Founder,
  extraídas de producción, se pasaron por la clase real
  `DeterministicMemoryRankingStrategy` (importada del código fuente,
  no reimplementada) para obtener el veredicto actual del sistema.
  Por separado, cada una de las 179 se clasificó de forma
  **independiente y ciega al score real** (revisando únicamente el
  contenido, sin ver el veredicto del sistema) contra un criterio
  explícito: ¿el contenido revela al menos una de las 9 categorías que
  el propio componente declara como su objetivo (transición de vida,
  decisión importante, valor revelado, vulnerabilidad, punto de
  quiebre emocional, cambio relacional, crecimiento personal, lucha
  recurrente, aspiración de largo plazo)? Esta clasificación
  independiente **no fue realizada por un humano** — limitación
  declarada explícitamente, no ocultada; ver Sección 6.
- **Variables:** fijo = el contenido de las 179 memorias reales, sin
  alterar. Medido = veredicto del sistema real (score ≥ 45) vs.
  veredicto independiente.
- **Métricas:** precision, recall, F1, matriz de confusión completa.
- **Criterio de éxito (para H1):** recall bajo (arbitrariamente, <50%)
  con precision alta — el matcher no se equivoca cuando dispara, pero
  dispara en muy pocos casos reales.
- **Criterio de fracaso (para H1) / éxito para H6:** recall alto —
  el matcher captura la mayoría de los casos que un juicio
  independiente marcaría como relevantes.
- **Reproducibilidad:** dataset completo (179 memorias, contenido +
  score real + clasificación independiente + razones documentadas
  para casos límite) conservado en
  `.scratch/investigation/e1-*.{json,ts,txt}` de la sesión que produjo
  este documento — no versionado en git (contiene contenido real de
  usuario), regenerable ejecutando el mismo query contra producción.

### E2 — Forma de la distribución de scores

- **Objetivo:** distinguir H1 (problema de cobertura) de H2 (problema
  de calibración de umbral) sin necesitar un benchmark nuevo — mismos
  datos que O8.
- **Metodología:** histograma completo de `rank_score` sobre las 179
  memorias reales.
- **Variables:** ninguna, es una consulta directa.
- **Métricas:** forma de la distribución, densidad en el rango
  [umbral-30, umbral).
- **Criterio de éxito (para H2):** masa significativa de scores justo
  debajo de 45 (p. ej. 35-44) — indicaría que muchas memorias "casi
  califican" y que el umbral, no el matcher, es la barrera.
- **Criterio de fracaso (para H2):** vacío total entre el score base
  sin coincidencias (15 + bono) y el score con una coincidencia (45 +
  bono) — indicaría que el problema es binario (coincide o no
  coincide con alguna categoría), no de calibración fina.

### E3 — Consistencia interna de la fórmula de ponderación

- **Objetivo:** confirmar o refutar H3.
- **Metodología:** verificación matemática directa de la invariante que
  el propio código declara ("los saltos entre niveles... están todos
  por encima del bono de recencia") contra las constantes reales
  publicadas: `BASE_SCORE_BY_MATCH_COUNT = [15, 45, 65, 80, 90, 100]`,
  `MAX_RECENCY_BONUS = 4`.
- **Variables:** ninguna, son constantes fijas del código.
- **Métricas:** el menor salto entre niveles consecutivos, comparado
  contra el bono máximo de recencia.
- **Criterio de éxito (para H3):** algún salto entre niveles es menor
  o igual al bono máximo de recencia — el bono podría, en teoría,
  cruzar un nivel de comprensión que el código dice que nunca debería
  cruzar, evidencia de una ponderación mal calibrada respecto a su
  propio diseño.
- **Criterio de fracaso (para H3):** todos los saltos son mayores al
  bono máximo — la fórmula es internamente consistente con lo que
  declara.

### E4 — Verificación de una única etapa limitante

- **Objetivo:** confirmar o refutar H4.
- **Metodología:** lectura directa del código de
  `finalizeReplyInner` (`features/chat/services/send-message.ts`) para
  confirmar cuántos gates existen entre `Memory.capture` y
  `enqueueKnowledgeJob`; cruce contra evidencia real de que
  `Memory.capture` no está fallando (memorias con `rank_score` no
  nulo siguen creándose para mensajes de hoy mismo).
- **Variables:** ninguna, es lectura de código + verificación de datos
  ya extraídos.
- **Métricas:** número de gates identificados; ¿`rank_score` es nulo en
  algún caso reciente?
- **Criterio de éxito (para H4):** existe un gate adicional no
  documentado previamente, o `rank_score` aparece nulo para mensajes
  recientes (indicaría que el ranking mismo no se está ejecutando).
- **Criterio de fracaso (para H4):** un único gate confirmado
  (`rank.score >= 45`), `rank_score` presente y no nulo en el 100% de
  las memorias recientes.

### E5 — Generalización a una segunda cuenta real

- **Objetivo:** confirmar o refutar H5.
- **Metodología:** misma consulta de distribución de `rank_score`
  (histórico completo y desde 2026-07-23) aplicada a la cuenta de
  Verónica Valencia, segunda usuaria más activa del sistema por
  volumen de feedback/actividad real registrada.
- **Variables:** cuenta distinta, mismo código de producción.
- **Métricas:** % bajo el umbral, densidad en el rango 20-44.
- **Criterio de éxito (para H5):** la segunda cuenta muestra un patrón
  claramente distinto (más alto recall aparente, densidad real en la
  banda intermedia) — indicaría que el problema depende del estilo de
  escritura o volumen de una cuenta particular.
- **Criterio de fracaso (para H5):** la segunda cuenta reproduce la
  misma firma bimodal.

---

## 5. Resultados

**E1.**

```
N total: 179
Positivos según clasificación independiente: 39 (21.8%)
Positivos según el sistema real (score >= 45): 4 (2.2%)

Matriz de confusión:
  TP: 4    FP: 0
  FN: 35   TN: 140

Precision: 100.0%
Recall:    10.3%
F1:        18.6%
```

Los 4 verdaderos positivos incluyen los dos únicos casos donde el
contenido real contiene una coincidencia léxica literal ("Decidí
decirle que no lo hiciera", "decidí cortar el vínculo"). Cero falsos
positivos: el matcher, cuando dispara, siempre coincide con el juicio
independiente. Ejemplos representativos de los 35 falsos negativos
(contenido real, ninguno contiene ninguna de las 70 frases exactas):

- "Trabajador, asertivo, soñador, amoroso, inteligente, buen lector...
  Tengo 28 años. Nací en Floridablanca Santander... Me gustan los
  carros" — autodescripción explícita de rasgos.
- "Mis metas para los próximos 30 días son: retomar actividad física,
  volver a trotar... volver a hacer duolingo... programar presupuesto
  y plan de pagos... Establecer sociedad con Alejandro" — lista
  explícita de aspiraciones a 30 días.
- "Quiero contarte que cuando tenga 18 años fui al ejército, presté
  servicio militar... Quiero que lo anotes como Logro" — logro de vida
  que el propio usuario pidió explícitamente recordar.
- "Para mí en este momento lo más importante es mantenerme sobrio.
  Establecer metas tangibles..." — valor explícito + aspiración.
- "estamos entrando ya a las 60 horas de sobriedad frente a la keta" —
  hito real de un proceso de recuperación en curso.

**E2.** Distribución real, N=179: `{17: 34, 18: 65, 19: 76, 48: 4}`.
Cero memorias en el rango 20-44. La distribución es estrictamente
bimodal: o cero categorías coinciden (17-19, según el bono de
recencia en el momento del cálculo) o exactamente una coincide (48).

**E3.** Saltos entre niveles de `BASE_SCORE_BY_MATCH_COUNT`: 30, 20,
15, 10, 10. Bono máximo de recencia: 4. El salto más pequeño (10) es
2.5× mayor que el bono máximo. La invariante declarada en el código se
cumple exactamente, sin margen ajustado — no está "casi" rota en
ningún punto.

**E4.** Un único gate confirmado en `finalizeReplyInner`:
`capturedMemory && capturedMemory.rank.score >= MIN_SCORE_WITH_UNDERSTANDING_SIGNAL`.
0/179 memorias del Founder tienen `rank_score` nulo, incluyendo la más
reciente (2026-08-02T11:01:58Z, hoy).

**E5.** Verónica Valencia: 28/30 memorias (93.3%) bajo el umbral,
histórico completo. Distribución: `{19: 28, 49: 2}`. Cero memorias en
el rango 20-44 — misma firma bimodal exacta que la cuenta del Founder.

---

## 6. Conclusiones

- **C1 — H1 CONFIRMADA. Confianza: alta.** Evidencia: E1 (recall
  10.3%, precision 100%, N=179, benchmark completo y reproducible) y
  O5 (el propio usuario reportó explícitamente, en lenguaje natural,
  exactamente el síntoma que E1 predice: que LUZ solo parece
  "recordar" un evento repetido). La lista léxica captura contenido
  real con alta fidelidad cuando dispara (0 falsos positivos), pero
  dispara en una fracción mínima de los casos que genuinamente
  califican.
- **C2 — H2 DESCARTADA. Confianza: alta.** Evidencia: E2. Un problema
  de calibración de umbral predice masa de datos justo debajo del
  corte; en cambio hay un vacío total entre 20 y 44 puntos, en dos
  cuentas independientes. Bajar el umbral no movería recall de forma
  proporcional, porque no existen scores intermedios que capturar —
  solo movería la frontera entre "cero coincidencias" y "todo pasa
  sin filtro real."
- **C3 — H3 DESCARTADA. Confianza: alta (verificación matemática
  directa, no estadística).** Evidencia: E3. La fórmula de ponderación
  es internamente consistente con su propia invariante declarada, sin
  margen ajustado.
- **C4 — H4 DESCARTADA. Confianza: alta.** Evidencia: E4. Un único gate
  confirmado por lectura de código; evidencia real de que ninguna
  etapa previa (Memory.capture, el propio cálculo de `rank()`) está
  fallando silenciosamente.
- **C5 — H5 DESCARTADA. Confianza: media-alta (N=2 cuentas; no es
  exhaustivo sobre las 17 cuentas reales del sistema, pero la segunda
  cuenta se seleccionó por ser la más activa después de la del
  Founder, no una elección favorable a la hipótesis).** Evidencia: E5.
- **C6 — H6 DESCARTADA. Confianza: alta.** Evidencia: E1. Contenido que
  revela metas explícitas a 30 días, autodescripción de rasgos, y un
  logro de vida que el usuario pidió textualmente recordar, recibe
  exactamente el mismo puntaje que un "Hola" — si el sistema
  funcionara como fue diseñado, esa distinción debería existir.

**Hallazgo adicional, no anticipado en las hipótesis originales:** el
caso [145] (logro de servicio militar) no encaja limpiamente en
ninguna de las 9 categorías declaradas del matcher — "logro de vida"
no es una de ellas. Esto sugiere que incluso una lista léxica
ampliada perfectamente dentro de las 9 categorías actuales seguiría
sin capturar esta clase específica de contenido, porque la taxonomía
misma tiene un hueco, no solo su cobertura léxica. Se documenta aquí,
no se evalúa más a fondo — está fuera del alcance de las hipótesis
formuladas en la Sección 3, y una investigación futura debería
tratarlo como su propia pregunta.

---

## 7. Recomendaciones

Ninguna implementada. Cada una requiere decisión explícita del
Founder antes de cualquier cambio de código, consistente con
`docs/legal/AI_DEVELOPMENT_POLICY.md`.

### R1 — Ampliar la lista léxica (más frases, más conjugaciones, cerrar el hueco de "logro de vida")

| Dimensión | Evaluación |
|---|---|
| Impacto esperado | Recall sube desde 10.3%, pero el techo realista es limitado — varios de los 35 falsos negativos (p. ej. "Trabajador, asertivo, soñador...") no tienen ninguna frase-ancla cercana que una lista más larga pudiera capturar razonablemente. |
| Riesgos | Bajos — cambio aditivo, no toca lógica existente. |
| Costo | Bajo (horas). |
| Complejidad | Baja. |
| Compatibilidad Architecture V1 | Total — ajuste dentro de Memory Engine existente, ningún `core/*-engine` nuevo. |
| Impacto Responsible AI | Ninguno — sigue determinista, sigue 100% auditable leyendo la lista. |
| Impacto sobre sesgo | Reduce el sesgo de cobertura actual; introduce un sesgo nuevo, más pequeño, hacia los temas para los que alguien piense a escribir frases. |
| Impacto sobre varianza | Ninguno — sigue siendo 100% determinista. |
| Impacto sobre evaluabilidad futura | Alto — el mismo benchmark E1 se puede re-ejecutar después del cambio para medir la mejora real, en vez de asumirla. |

### R2 — Reemplazar el mecanismo léxico por clasificación semántica/asistida por IA

| Dimensión | Evaluación |
|---|---|
| Impacto esperado | Recall potencialmente mucho más alto — reconocería autodescripción y aspiraciones sin depender de una frase exacta. |
| Riesgos | Más altos — nueva latencia, nueva dependencia externa en una ruta que hoy es puramente local. |
| Costo | Medio-alto. |
| Complejidad | Media-alta. |
| Compatibilidad Architecture V1 | Requiere decisión explícita del Founder — técnicamente podría vivir como una nueva `MemoryRankingStrategy` (el contrato ya es reemplazable por diseño), pero contradice un principio de diseño declarado explícitamente en el código actual ("determinista y sin IA a propósito"), lo cual amerita el mismo tipo de disciplina que ADR-0018 exige para cambios de esa magnitud, no solo un PR. |
| Impacto Responsible AI | Mayor — decidir "qué revela algo duradero sobre quién es una persona" pasaría de ser 100% auditable leyendo código a depender del juicio de un modelo; cambio de gobernanza, no solo técnico. |
| Impacto sobre sesgo | Cambia el TIPO de sesgo (del sesgo léxico enumerable actual al sesgo propio, menos transparente, de un modelo de lenguaje). |
| Impacto sobre varianza | Introduce varianza real donde hoy hay cero — la misma memoria podría puntuar distinto entre llamadas, salvo control explícito. |
| Impacto sobre evaluabilidad futura | El benchmark E1 sigue sirviendo para recall/precision, pero además haría falta medir la ESTABILIDAD del clasificador (varianza real) antes de confiar en él — trabajo que R1 no requiere. |

### R3 — Combinación: ampliar la lista (R1) + agregar explícitamente una categoría "logro de vida"

| Dimensión | Evaluación |
|---|---|
| Impacto esperado | Recall sube más que R1 solo, específicamente cierra el hueco categórico que E1 reveló (no solo de cobertura léxica dentro de las categorías existentes). |
| Riesgos | Bajos, mismo perfil que R1. |
| Costo | Bajo-medio. |
| Complejidad | Baja. |
| Compatibilidad Architecture V1 | Total. |
| Impacto Responsible AI | Ninguno. |
| Impacto sobre sesgo | Igual que R1, con una reducción adicional específica del hueco categórico encontrado. |
| Impacto sobre varianza | Ninguno. |
| Impacto sobre evaluabilidad futura | Alto, igual que R1. |

**No hay una recomendación única propuesta por esta investigación** —
esa decisión es del Founder. Lo que la evidencia sí establece con
confianza alta: cualquier solución que solo mueva el umbral (45), sin
tocar el mecanismo de coincidencia, no cambiará el resultado (C2), y
el problema es real, mide 6+ días sin trabajo nuevo en todo el
sistema, y ya tiene una señal directa del propio Founder confirmándolo
en producción (O4, O5).
