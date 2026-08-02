# Conversational Variety V1

Misión: el usuario nunca debe sentir que LUZ está obsesionada con un
solo tema. `computeConversationVariety` responde una sola pregunta --
**¿han dominado las conversaciones recientes un solo dominio de vida?**
-- midiendo frecuencia histórica, diversidad, fatiga temática, tiempo
desde la última conversación por dominio y balance entre dominios, y
traduciéndolo a una señal que el pipeline conversacional ya existente
consume.

Sin IA, sin aleatoriedad, sin repositorio propio, sin tabla nueva --
una sola consulta de solo lectura sobre `conversations.category`, ya
persistido por `features/conversations/services/generate-title.ts`.
Vive en `features/`, no en `core/` -- mismo criterio que
`features/home/`, `features/narrative/` y `features/identity-evolution/`
(ver ADR-0018): es interpretación sobre datos que otro módulo ya
persistió, nunca una fuente de verdad nueva.

## Esto NO es

- **No es Narrative.** No decide qué capítulo está activo, qué merece
  continuación, ni conecta historias meses aparte -- eso es
  `features/narrative/`, sin tocar. Narrative opera sobre `ContinuityLoop`s
  concretos ("¿qué asunto sigue abierto?"); esto opera sobre la
  CATEGORÍA de conversaciones enteras a través del tiempo ("¿de qué
  hemos hablado, cuánto, y hace cuánto?") -- ninguna de las dos
  preguntas puede responder la otra.
- **No es Identity Evolution.** No decide quién es la persona hoy ni
  qué dimensión/tema debería liderar su identidad -- eso es
  `features/identity-evolution/`, sin tocar. Identity mide qué tan
  VIGENTE es un tema en la vida real de la persona (evidencia
  estructurada: beliefs, concepts); esto mide qué tan REPETIDO ha
  estado un dominio en la CONVERSACIÓN, sin importar si hay evidencia
  estructurada detrás. Una persona puede seguir hablando genuinamente
  de algo que sigue siendo su identidad -- eso no es monotonía, es
  consistencia; la distinción entre las dos es exactamente lo que este
  módulo NO intenta resolver por su cuenta (ver "Debilidades
  conocidas").
- **No es `core/knowledge-gaps`.** `DomainCoverage` mide qué tan
  *estructurado* está un área de vida (goals/beliefs/concepts reales)
  -- su propio docblock: *"Nunca 'la persona nunca habló de esto'...
  siempre 'esto es lo que LUZ tiene estructurado hasta ahora'"*. No
  puede responder "hemos hablado mucho de esto últimamente" -- esa es
  exactamente la pregunta que faltaba y que este módulo responde.
- **No es mi propio mecanismo de diversidad turno-a-turno**
  (`features/chat/context-builder/conversation-signal-log.ts` +
  `diversity-cooldown.ts`, redesign del pipeline conversacional,
  Beta). Ese opera sobre TIPO DE ESTRATEGIA CONVERSACIONAL e IDs de
  memoria/insight puntuales, ventana corta (10 conversaciones,
  cooldown de 2 repeticiones). Cero concepto de dominio de vida, cero
  ventana larga. Este módulo es una escala de tiempo y de grano
  distintos -- "¿ha dominado un ÁREA DE VIDA entera el último mes?",
  no "¿se repitió la misma memoria en el turno anterior?".
- **No es un motor de recomendación.** Produce un
  `ConversationVarietySnapshot` de solo lectura; sus dos traductores
  (`integrations/`) son datos crudos para que `CuriosityStrategyRule`/
  `AvoidTopicMonotonyRule` decidan, nunca una decisión tomada aquí.

## Filosofía

**La fuente de verdad ya existe.** `conversations.category` se asigna
una vez por conversación, en el primer intercambio, ya clasificado por
IA y persistido (`generate-title.ts`). Este módulo no inventa
instrumentación nueva -- agrega esa misma columna a través del
tiempo. Cero tabla nueva, cero evento nuevo, cero migración.

**Cada número se explica en una frase.** `shareOfWindow` es un
conteo dividido por un conteo. `diversityScore` es cuántas categorías
distintas aparecieron sobre cuántas son posibles. `dominantDomainStreak`
es "cuántas de las más recientes, sin interrupción, son la misma" --
el mismo algoritmo que `apply-rotation.ts` ya usa para la rotación de
tarjetas de Home. Nada de esto necesita justificarse con estadística:
una fórmula que se explica por teléfono es más auditable que una que
necesita cálculo (mismo criterio que ya declara
`core/knowledge-gaps/services/compute-domain-coverage.ts`).

**Dos disparadores de monotonía, independientes, cualquiera basta.**
Un dominio puede dominar por PROPORCIÓN (la mitad o más de una ventana
real, `windowSize >= 6`) o por RACHA (cuatro seguidas, sin importar el
tamaño de la ventana) -- una ventana chica con una racha real (4
conversaciones seguidas sobre lo mismo) es monotonía real aunque no
haya historial suficiente para hablar de proporción; una ventana con
proporción alta pero sin racha (el tema vuelve, pero intercalado con
otros) también lo es. Ninguno de los dos por sí solo cubre ambos casos
reales.

## Estructura

```
conversational-variety/
  domain/          ConversationVarietyEntry (input crudo) + ConversationVarietySnapshot (el contrato)
  services/        compute-conversation-variety.ts -- única función pura, streak local
  application/      assemble-conversational-variety.ts -- el único archivo que toca Database
  integrations/    to-conversation-strategy-signal (-> Curiosity) + to-conversation-rule-signal (-> AvoidTopicMonotonyRule)
  tests/           fixtures.ts + script standalone (npx tsx), sin framework de unit tests en este repo
```

## Frontera de dependencia

`core/conversation-strategy-engine` es `core/*` -- nunca puede
importar un tipo de `features/conversational-variety` (`features/*`).
`integrations/to-conversation-strategy-signal.ts` traduce hacia el
primitivo más pequeño posible (`LifeDomainType | null`, tipo que ya
vive en `core/life`), nunca el snapshot completo -- mismo criterio que
ya usa `core/reality/knowledge-gaps-snapshot.ts` frente a
`core/knowledge-gaps`.

El cruce real `features/chat` → `features/conversational-variety` vive
en `features/chat/services/assemble-conversation-variety-context.ts`
-- mismo lugar exacto donde ya viven los otros dos cruces de este tipo
(`assemble-reality-snapshot.ts` → `features/identity-evolution`,
`assemble-reconnection-context.ts` → `features/narrative`), nunca en
`features/chat/context-builder/`.

`consecutiveStreak` (el algoritmo de racha) está duplicado localmente
en `services/compute-conversation-variety.ts`, no importado de
`core/context-engine/scoring/diversity-cooldown.ts` (que ya tiene la
misma función) -- ese archivo no se re-exporta desde el `index.ts`
público de `core/context-engine`, y no existe en todo el repo un solo
precedente de importar más allá del barrel público de otro módulo.
Tercera copia de las mismas 15 líneas, mismo criterio que ya justifica
las dos anteriores.

## Integración con el pipeline existente

```
conversations.category (ya persistido) ──→ assembleConversationalVariety ──→ ConversationVarietySnapshot
                                                                                        │
                                                    ┌───────────────────────────────────┼──────────────────────┐
                                                    ▼                                                            ▼
                                    toCuriosityFatiguedDomain                                    toConversationVarietyRuleSignal
                                    (LifeDomainType | null)                                       (ConversationVarietyRuleSignal)
                                                    │                                                            │
                                                    ▼                                                            ▼
                              CuriosityStrategyRule (excluye ese dominio             AvoidTopicMonotonyRule (nueva ConversationRule
                              antes de elegir el menos cubierto)                     aditiva -- nombra el dominio dominante,
                                                                                       pide margen para otras áreas)
```

Ambos consumidores son enriquecimiento de decisiones YA existentes --
ninguno reemplaza a Narrative ni a Identity Evolution, ninguno decide
por su cuenta qué decir.

## Validación

```bash
npx tsx features/conversational-variety/tests/compute-conversation-variety.examples.ts
```

Nueve escenarios: ventana vacía, ventana diversa, monotonía por share
(sin racha), monotonía por racha (ventana chica, share fuera de
alcance), no-monótono con share alto pero racha corta en ventana chica
(falso positivo evitado), no-monótono justo por debajo de ambos
umbrales, `"general"` participando como cualquier categoría,
`daysSinceLastConversation` exacto y `null` para dominios ausentes, y
determinismo (misma entrada -> mismo JSON).

`tsc --noEmit` y `eslint features/conversational-variety` limpios. Sin
verificación contra Postgres real en este sandbox (sin
`DATABASE_URL`) -- `assemble-conversational-variety.ts` es
deliberadamente delgado (una consulta, un índice ya existente,
reutilizado tal cual de `list-conversations.ts`) para que el riesgo
real quede casi enteramente en `computeConversationVariety`, que sí
está validada.

## Debilidades conocidas

- **Constantes de primera iteración.** `VARIETY_WINDOW_SIZE` (30),
  `MIN_WINDOW_FOR_SHARE_CHECK` (6), `MONOTONY_SHARE_THRESHOLD` (0.5),
  `MONOTONY_STREAK_THRESHOLD` (4) -- elegidas por razonamiento, no
  contra volumen real de uso todavía. Recalibrar cuando haya datos
  reales de cuántas conversaciones por semana genera una persona real.
- **No distingue monotonía de consistencia genuina.** Una persona que
  de verdad está atravesando un solo asunto grande (una mudanza, un
  duelo) puede disparar `isMonotonous` igual que alguien a quien LUZ
  simplemente sigue trayendo el mismo tema -- este módulo no puede ver
  esa diferencia, solo mide repetición de categoría. `AvoidTopicMonotonyRule`
  compensa esto en su propio texto (nunca corta el tema si la persona
  lo trae de nuevo), pero la distinción real -- "¿esto sigue siendo
  necesario o ya es reflejo?" -- es la pregunta que Identity Evolution
  sí puede empezar a responder (`trajectory`/`momentum`), no este
  módulo.
- **`daysSinceLastConversation` se mide pero no gatilla nada en V1.**
  El founder pidió medirlo explícitamente; "reenganchar con un dominio
  descuidado" es, a propósito, del resorte de Curiosity/Narrative, no
  de este módulo -- ver "Extensiones futuras".
- **`category` solo existe tras el primer intercambio de cada
  conversación** (clasificación en segundo plano, puede fallar en
  silencio) -- una persona muy nueva, o con varias conversaciones cuya
  clasificación falló, tiene una ventana más chica de lo real. Se
  degrada a `windowSize` más chico, nunca se rellena con una categoría
  inventada.
- **Sin verificación contra Postgres real** -- ver "Validación".

## Extensiones futuras (máximo 5)

1. **Usar `daysSinceLastConversation` para sugerir, no solo suprimir**
   -- un dominio ausente hace mucho, con evidencia estructurada real
   detrás (`core/knowledge-gaps` con cobertura > 0), es un candidato
   más rico para Curiosity que "el menos cubierto" a secas.
2. **Cruzar con Identity Evolution** para distinguir consistencia
   genuina (trajectory `consolidating`, momentum `stable`/`renewing`)
   de repetición sin fondo -- el módulo correcto para resolver la
   debilidad nombrada arriba, sin duplicar su lógica aquí.
3. **Recalibrar constantes con datos reales** una vez haya volumen
   suficiente por usuario.
4. **Granularidad de tema, no solo de dominio** -- hoy la categoría es
   uno de 9 valores fijos; cruzar con `Concept`/`core/concept-graph`
   podría detectar fatiga de un TEMA específico dentro de un dominio
   amplio (ej. "trabajo" en general vs. "esa negociación puntual").
5. **Wiring en Presence/Experience** -- hoy solo Conversation
   Strategy/Conversation Rules lo consumen; Home podría usar la misma
   señal para variar qué tipo de tarjeta prioriza.
