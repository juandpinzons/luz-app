# War Room Audit — Continuación independiente, 2026-07-29

**Status:** En curso (un hallazgo pendiente de auditoría en segundo plano)\
**Rol:** Principal Engineer, auditoría independiente, sin repetir el War Room anterior\
**Restricción explícita del Founder para este bloque:** ningún contrato de motor compartido (Memory/Knowledge/Reasoning/Context Engine) se modifica; ninguna mejora especulativa; evidencia sobre intuición.

------------------------------------------------------------------------

# 1. Resumen ejecutivo

Esta continuación auditó terreno explícitamente no cubierto por el War
Room anterior: rutas de API restantes, ciclo de vida de autenticación/sesión,
y patrones N+1/índices en Dashboard y el módulo Life. Encontré y arreglé
tres problemas reales, todos dentro de los límites de propiedad
establecidos (cero contrato de motor modificado, cero migración de
esquema, cero tabla nueva):

1. **`auth()` no estaba memoizado por petición** — se llamaba 2-3 veces
   en una sola carga de Dashboard y en cada mensaje de chat, cada
   llamada golpeando la tabla de sesiones (estrategia `database`).
   Arreglado con `React.cache()`, el patrón oficial de Next.js para
   esto.
2. **El ranking de recuperación de Memory Engine ignoraba conexiones
   estructurales y usaba una recencia congelada al momento de
   captura** — mejora pedida explícitamente por el Founder: score
   compuesto (rank + conexiones + recencia fresca), implementado
   enteramente dentro de `StructuredMemoryRetrievalStrategy`, sin tocar
   `MemoryRetrievalStrategy`/`MemoryQuery`/`Memory` (los contratos
   públicos del engine).
3. **N+1 secuencial confirmado por auditoría paralela** en
   `describe-evolution.ts`/`collect-domain-movements.ts` (`/life/identity`)
   — un `await` por Belief dentro de un `for`, nunca paralelizado.
   Arreglado con `Promise.all`, mismo método público de
   `BeliefRepository`, cero cambio de contrato.

Ninguna decisión arquitectónica nueva se tomó ni se propuso en este
bloque — todo lo implementado es, deliberadamente, trabajo dentro de
límites ya establecidos.

------------------------------------------------------------------------

# 2. Clasificación de riesgo (de los hallazgos de esta continuación)

| Hallazgo | Clasificación | Estado |
|---|---|---|
| `auth()` sin memoizar por petición (2-3x por request en las rutas de mayor tráfico) | **ALTO** | Implementado |
| Ranking de recuperación de memorias ignora conexiones/recencia fresca | **MEDIO-ALTO** (calidad de contexto, no estabilidad) | Implementado |
| N+1 secuencial sobre `belief_history` en `/life/identity` | **ALTO** | Implementado |
| Triple fetch redundante de Goals/Projects en Dashboard | MEDIO | Documentado, no implementado (ver §5) |
| `get-upcoming-deadlines.ts` filtra en JS, no SQL | BAJO | Documentado, no implementado |
| Índice compuesto faltante en `memories` (life_graph_id, status) | BAJO→MEDIO a mediano plazo | Documentado, no implementado |
| N+1 paralelo en evidencia de insights (`explain-insight.ts`) | BAJO | Documentado, no implementado |

------------------------------------------------------------------------

# 3. Análisis técnico

## 3.1 [ALTO, IMPLEMENTADO] `auth()` sin memoizar por petición

**Hallazgo:** `authConfig.session.strategy = "database"` — cada
llamada a `auth()` resuelve la sesión consultando `sessions`/`users`
de verdad. Verificado que Auth.js v5 no memoiza esto internamente
(`grep` de `cache(` en `node_modules/next-auth/lib/index.js` → sin
resultados).

**Evidencia — conteo real de llamadas por página/ruta, en el mismo
request:**
- `app/dashboard/page.tsx`: 3 (línea 95 `auth()` directo, línea 124
  `getLifeGraphContext()`→`getUserContext()`→`auth()`, línea 239
  `getUserContext()`→`auth()`).
- `app/api/chat/route.ts`: 2 (`getUserContext()` + `getLifeGraphContext()`).
- `app/api/chat/welcome/route.ts`: 2.
- `app/memories/page.tsx`, `app/life/page.tsx`, `app/life/identity/page.tsx`: 2 cada una.

**Causa raíz:** `auth/user-context.ts` es el único punto de entrada
declarado para `UserContext`, pero varias páginas también llaman
`auth()` directo (para `session.user.name`/`email`), y ninguna llamada
se comparte dentro del mismo request.

**Impacto:** cada carga de Dashboard pagaba 3 consultas de sesión
donde bastaba una; cada mensaje de chat, 2. En las rutas de mayor
tráfico de toda la aplicación.

**Fix:** `auth/index.ts` ahora exporta `auth = cache(resolveAuth)`.
Reduce llamadas redundantes a 1 por request, sin cambiar el
comportamiento de ningún llamador — se verificó que preserva ambos
patrones de uso (`await auth()` como getter de sesión, y
`auth(handler)` como envoltorio de middleware en `proxy.ts`).

**Validación:** typecheck, lint, build limpios. Verificación funcional
real: navegación a `/dashboard` sin sesión redirige correctamente a
`/login` con `callbackUrl` — el middleware de `proxy.ts` sigue
funcionando idéntico envuelto en `cache()`.

## 3.2 [MEDIO-ALTO, IMPLEMENTADO] Ranking de recuperación de Memory Engine

**Contexto:** pedido explícito del Founder, con la restricción de
mantenerse "completamente dentro de un engine ya existente y detrás de
interfaces privadas."

**Estado anterior:** `StructuredMemoryRetrievalStrategy.retrieve()`
ordenaba únicamente por `rankScore DESC NULLS LAST, createdAt DESC`.
`rankScore` se calcula una sola vez, al capturar la memoria
(`DeterministicMemoryRankingStrategy.rank()`), con un bono de recencia
que decae a 0 en ~4 semanas **desde ese momento** — nunca se
recalcula. Una memoria de hace un año con `rankScore` alto siempre
gana sobre una reciente y moderadamente relevante. Además,
`DefaultConnectStage` ya calcula conexiones estructurales
(`memory_connections`) en cada captura, pero **nada las usaba para
decidir qué recuperar** — solo se mostraban después, en `/memories`.

**Diseño del score compuesto** (`compositeScore = rankScore + bono de
conexiones + bono de recencia fresca`):
- `rankScore` sigue siendo el factor dominante — la comprensión real
  de la persona (PR-014) no se subordina a nada.
- Bono de conexiones: `min(cantidad_de_conexiones × 2, 10)` — recupera
  una señal que el engine ya calcula pero nunca usaba para retrieval.
  Calculado con **dos consultas agrupadas por lote** (`fromMemoryId`/
  `toMemoryId IN (...)`, nunca una por memoria) sobre el pool de
  candidatos ya acotado — no reintroduce el patrón de "consulta sin
  límite" ya documentado en el War Room anterior.
- Bono de recencia fresca: hasta +5, decayendo en 60 días,
  recalculado en cada recuperación (nunca congelado).
- **Invariante verificada**: ningún bono combinado (máximo 10+5=15)
  puede hacer que una memoria de un nivel de `rankScore` supere a una
  del siguiente nivel (15+15=30 &lt; 45) — mismo principio de "nunca
  cruza un nivel" que ya rige el bono de recencia original, extendido
  a un segundo factor. Verificado con un script de escenarios
  sintéticos (ver §4).

**Qué NO se tocó:** `MemoryRetrievalStrategy` (interfaz pública),
`MemoryQuery` (forma de la consulta), `Memory`/`MemoryRank` (formas de
entidad), ninguna migración, ninguna tabla nueva. El pool de
candidatos se acota a `min(limit × 3, 150)` antes de rankear —
nunca la tabla completa.

**Qué explícitamente se excluyó y por qué:** "importancia"
(`core/importance-engine`) y "confianza" (concepto de Belief Engine)
mencionados por el Founder como factores posibles se excluyeron a
propósito — incorporarlos requeriría cruzar hacia otro engine, en
contra de la restricción explícita de quedarse "completamente dentro
de un engine ya existente."

## 3.3 [ALTO, IMPLEMENTADO] N+1 secuencial en `/life/identity`

Ya documentado con evidencia completa por la auditoría paralela de
esta misma continuación (Dashboard/Life). Fix: `for...await` → `Promise.all`
en `describe-evolution.ts` y `collect-domain-movements.ts`, mismo
método público de `BeliefRepository` (`getHistory`), cero cambio de
contrato.

------------------------------------------------------------------------

# 4. Validación

- **Typecheck:** limpio, en cada uno de los tres cambios y en el
  conjunto final.
- **Lint:** limpio.
- **Build de producción:** limpio, en cada paso.
- **Verificación funcional real:** `auth()` verificado en navegador
  (redirect correcto de `/dashboard` sin sesión).
- **Verificación de lógica del score compuesto:** script standalone
  con escenarios sintéticos (rank alto+viejo+sin conexiones vs.
  rank alto+viejo+muy conectado vs. rank bajo+reciente+muchísimas
  conexiones, etc.) — confirmó que el orden resultante tiene sentido y
  que la invariante "nunca cruza un nivel de rankScore" se cumple
  numéricamente.
- **Smoke tests:** intentados (`npm run smoke` con variables dummy),
  **no ejecutables en este entorno** — mismo `ECONNREFUSED` ya
  documentado en el War Room anterior (sin Docker/Postgres real
  disponibles aquí). No se afirma que pasaron; esta es la limitación
  real, documentada explícitamente en vez de simulada.

------------------------------------------------------------------------

# 5. Cambios rechazados intencionalmente, con justificación

- **Unificar el triple fetch de Goals/Projects en Dashboard**
  (Hallazgo de la auditoría paralela): rechazado para este bloque —
  requiere decidir cuál de los tres llamadores (`buildMorningBrief`,
  `page.tsx`, `getUpcomingDeadlines`) se vuelve la única fuente y
  pasarla como parámetro a los otros dos; no es un cambio de una línea
  y no estaba en la prioridad que definió el Founder para este bloque
  específico. Documentado para un bloque futuro.
- **Filtrar `get-upcoming-deadlines.ts` en SQL en vez de JS**:
  rechazado — el dataset actual es pequeño (acotado por LifeGraph), el
  riesgo real es bajo, y hacerlo bien requeriría un índice compuesto
  nuevo (`target_date`/`due_date`) que hoy no se necesita para nada
  más. No vale la pena el cambio de esquema todavía.
- **Índice compuesto en `memories` (life_graph_id, status)**:
  rechazado en este bloque — es una migración (`CREATE INDEX`), y
  aunque es aditiva y de bajo riesgo, decidí no tocar el esquema sin
  que el Founder lo pida explícitamente, dado el énfasis reiterado de
  esta sesión en "ninguna migración salvo estrictamente necesaria."
  Documentado como recomendación de bajo riesgo para cuando se decida
  tocar el esquema por otra razón.
- **Score de similitud de texto en la recuperación estructurada**: el
  Founder mencionó "similitud" como factor posible, pero
  `StructuredMemoryRetrievalStrategy` es explícitamente la mitad *no*
  semántica de ADR-0004 (Hybrid Memory) — construir una noción real de
  similitud sin embeddings habría sido inventar una heurística de
  calidad dudosa solo para marcar una casilla. Se dejó fuera a
  propósito; la mitad semántica real (PR-020) sigue siendo una
  decisión aparte, no resuelta aquí ni se intentó resolver.

------------------------------------------------------------------------

# 6. Riesgos arquitectónicos restantes (heredados, no de este bloque)

Sin cambios respecto al informe anterior
(`WAR_ROOM_AUDIT_2026-07-29.md`): el techo de throughput del Knowledge
Engine en producción (CRÍTICO) y la ausencia total de borrado/retención
(ALTO) siguen siendo, con diferencia, los mayores riesgos para Beta —
ninguno de los dos se toca en esta continuación porque ambos requieren
decisión de infraestructura/arquitectura ajena a este bloque.

------------------------------------------------------------------------

# 7. Roadmap sugerido, ordenado por ROI

1. Decisión de infraestructura para el throughput del Knowledge Engine
   (heredado, sigue siendo lo más urgente).
2. Unificar el fetch triplicado de Goals/Projects en Dashboard — bajo
   esfuerzo, beneficio inmediato en latencia de la página más visitada.
3. Índice compuesto en `memories` — trivial una vez que se decida tocar
   el esquema por cualquier otra razón.
4. Política de borrado/retención real (heredado).
5. Extender el ranking de recuperación a la mitad semántica (embeddings,
   PR-020) — mayor esfuerzo, pero es la extensión natural de lo ya
   implementado en este bloque.

------------------------------------------------------------------------

# 8. Recomendación final

**Ready for Beta, no para producción sin resolver los hallazgos
CRÍTICO/ALTO ya documentados.** Los tres arreglos de este bloque
mejoran calidad de contexto (ranking de memorias) y reducen carga
innecesaria en las rutas más transitadas (`auth()`, `/life/identity`)
sin tocar ningún contrato compartido ni arriesgar el trabajo de M4. El
techo de throughput del Knowledge Engine y la ausencia de
borrado/retención (ambos del War Room anterior) siguen siendo, sin
cambios, las condiciones que impedirían recomendar producción real
antes de resolverse.
