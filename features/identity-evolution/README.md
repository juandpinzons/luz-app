# Identity Evolution Engine

Misión: "Identity Evolution Engine" -- hoy LUZ recuerda con precisión, pero no *evoluciona*. Una creencia que fue extremadamente cierta hace seis meses ("está en recuperación de ketamina") puede seguir dominando cómo LUZ representa a la persona hoy, aunque la persona ya haya pasado meses construyendo otra cosa. Eso está mal: los humanos recuerdan su pasado, pero no se definen para siempre por su capítulo más difícil. `buildIdentitySnapshot` responde una sola pregunta -- **no "¿qué le pasó a esta persona?", sino "¿quién es esta persona HOY?"**

Sin IA, sin aleatoriedad, sin repositorio de dominio propio, sin tabla nueva. Vive en `features/`, no en `core/` -- mismo criterio que `features/home/`, `features/experience/`, `features/presence/` y `features/narrative/` (ver ADR-0018): es orquestación/representación sobre evidencia que otros módulos ya persistieron, nunca una fuente de verdad nueva.

## Esto NO es

- **No es un sistema de memoria.** No decide qué recordar ni cuándo olvidar -- `core/belief-engine`/`core/concept-graph` siguen siendo los únicos dueños de esa evidencia, y nunca se modifican, se leen. Identity Evolution nunca borra, expira ni retracta un `Belief`; eso sigue siendo responsabilidad exclusiva de `decayStaleBeliefs`.
- **No es un sistema narrativo.** No decide qué capítulo está activo ni qué merece continuación/celebración/silencio -- eso es `features/narrative/`, sin tocar. Identity Evolution opera en una escala de tiempo distinta (meses/años, "quién es esta persona") mientras Narrative opera en la escala de un asunto concreto (días/semanas, "qué historia sigue abierta").
- **No es otro motor de recomendación.** No sugiere una acción ni decide qué mostrar en pantalla -- produce un `IdentitySnapshot` de solo lectura; cuatro campos de "Guidance" (ver más abajo) son datos crudos para que un consumidor real decida, nunca una decisión tomada aquí.

Su responsabilidad es fundamentalmente distinta a las tres: **representación, no evidencia; identidad, no historia.**

## Filosofía

**LUZ debe recordarlo todo. LUZ debe representar en quién se está convirtiendo la persona, no en quién fue.** La evidencia nunca desaparece -- el `Belief`/`Concept` original sigue exactamente donde estaba, con su `confidence` intacta. Lo único que cambia es la REPRESENTACIÓN: cuánto peso tiene ese fragmento de evidencia en la lectura de identidad de HOY.

**El peso no es frecuencia, ni recomendación, ni la conversación de hoy.** `IdentityDimension.weight`/`IdentityTheme.weight` nunca se calculan contando mensajes recientes ni recomendaciones activas -- son un agregado de evidencia de largo plazo (`LOOKBACK_DAYS = 365`), con una ventana de decaimiento propia (`RECENCY_DECAY_DAYS = 90`) que apaga cualquier tema sin refuerzo real reciente, sin importar cuánta evidencia haya acumulado en el pasado.

**La identidad migra, nunca salta.** Un tema nuevo no puede llegar a dominar tras un solo mensaje (`COMPARISON_WINDOW_DAYS = 45` es la ventana mínima para hablar de un cambio real), y un tema que se apaga no desaparece de golpe -- decae en línea recta, con memoria de su propio pico (`peakWeight`) para siempre.

## Principios

1. **Identity nunca es frecuencia de memoria, ni conteo de recomendaciones, ni solo la conversación reciente.** Es un agregado de evidencia de largo plazo -- instrucción explícita de la misión, verificada en cada fórmula de `services/decay.ts`.
2. **Nunca se borra evidencia. Nunca se oculta historia.** Solo cambia la representación -- ningún `Belief`/`Concept`/`ConceptEvidence` se modifica, ninguna fila se excluye de `IdentitySnapshot.themes`/`dimensions` por tener `weight: 0`.
3. **Un capítulo resuelto sigue siendo trazable.** `resolvedChapters`/`deemphasized` nunca implican "esto ya no existe" -- implican "esto ya no debería liderar la conversación".
4. **Todo cambio de identidad exige una ventana real de tiempo**, nunca un solo evento -- `COMPARISON_WINDOW_DAYS`/`RENEWAL_GAP_DAYS` existen exactamente para esto.
5. **Cada número es explicable.** `IdentityConfidence.reason`, `momentumReason` interno, y `IdentityRepresentation.summary` siempre citan evidencia real (Principio 3 del motor, [[luz-engine-design-principles]]) -- nunca una intuición sin respaldo.
6. **El texto es plantilla + datos reales, nunca IA.** Cero import de un `AIProvider` en todo el módulo -- Identity Evolution es tan determinista y auditable como Narrative/Presence/Experience.
7. **Un capítulo puede volver.** `renewing` existe porque una identidad humana no es monótona -- alguien puede alejarse de algo importante y volver a acercarse, y eso es distinto de que algo sea nuevo (`emerging`).
8. **La confianza en la lectura es un eje distinto del peso.** Que algo pese mucho HOY no significa que LUZ esté igual de segura de esa lectura que de un patrón sostenido durante meses -- `IdentityConfidence` existe para separar ambas preguntas.
9. **Nunca se fabrica una identidad principal.** `primaryIdentity`/`secondaryIdentity`/`trajectory` son `null`/`insufficient_evidence` honestamente cuando no hay evidencia real que los respalde -- nunca se rellena con lo que haya, por poco que sea.

## Estructura

```
identity-evolution/
  domain/          IdentitySnapshot y sus tipos (el contrato)
  services/        decaimiento, momentum, ranking, shifts, representación, guidance
  application/      build-identity-snapshot (puro) + assemble-identity-evolution (toca Database)
  integrations/    contratos hacia Conversation/Narrative/Presence/Experience -- sin wiring
  tests/           fixtures.ts + script standalone con los ocho escenarios de la misión + verificaciones estructurales
```

## Relación con las fuentes permitidas

```
core/belief-engine (Belief + BeliefHistoryEntry)  ─┐
core/knowledge-engine (Insight validado)           ─┼──→ describeEvolution()  ──→  EvolutionEvent[]  ──┐
                     (features/identity/, SIN MODIFICAR, reutilizado tal cual)                          │
                                                                                                          ▼
core/concept-graph (Concept + ConceptEvidence) ────────────────────────────→ IdentityThemeEvidenceInput[] ┤
                     (consumido directo, solo lectura)                                                   │
                                                                                                          ▼
                                                                                    buildIdentitySnapshot()
                                                                                                          │
                                                                                                          ▼
                                                                                          IdentitySnapshot
```

`assemble-identity-evolution.ts` es el ÚNICO archivo de todo el módulo que importa `Database`/un repositorio -- la frontera anti-corrupción, mismo rol que `describeEvolution`/`assembleRealitySnapshot` cumplen para sus propios módulos. Reutiliza `describeEvolution` (`features/identity/services/`, sin modificarlo) para la evidencia de nivel dimensión, y consulta `core/concept-graph` directamente (repositorio público, solo lectura) para la evidencia de nivel tema -- ninguna consulta nueva a `core/belief-engine`.

**Deliberadamente NO usa `buildIdentityModel`/`PersonIdentityModel`** (`features/identity/services/build-identity-model.ts`): ese objeto es una foto del estado actual (top-8 creencias, evolución de los últimos 30 días) pensada para mostrarse tal cual; este módulo necesita la historia completa dentro de `LOOKBACK_DAYS` para poder comparar "hoy" contra "hace `comparisonWindowDays`", que `PersonIdentityModel` no expone. Tampoco mina `openContradictions`/`pendingPredictions`/`topReasoningConclusions`/`RealitySnapshot`/`NarrativeState` en v1 -- ver "Debilidades conocidas".

Verificado: cero archivos de `core/belief-engine`, `core/knowledge-engine`, `core/concept-graph`, `features/identity`, `features/narrative` o `features/experience` modificados en esta misión -- todo se consume por contrato público ya existente.

## Arquitectura

Dos capas de grano, un solo algoritmo:

- **`IdentityDimension`** -- grano GRUESO, una de las 8 `LifeDomainType` ("wheel of life": salud, carrera, finanzas, relaciones, crecimiento personal, ocio, hogar, espiritualidad). Siempre las 8 existen en `IdentitySnapshot.dimensions`, incluso en `weight: 0` -- una dimensión sin evidencia real sigue siendo un hecho legítimo, nunca se omite. Evidencia: `EvolutionEvent` (`core/temporal-evolution`) agrupado por `domain`.
- **`IdentityTheme`** -- grano FINO, un `Concept` real ("Construyendo LUZ", "Recuperación de ketamina"). Solo existen temas para conceptos reales con evidencia dentro de `LOOKBACK_DAYS`. Evidencia: `ConceptEvidence.createdAt`.

El ejemplo de la misión mezcla ambos grados en la misma lista ("Health" junto a "Building LUZ") -- por eso `primaryIdentity`/`secondaryIdentity` se eligen sobre el pool COMBINADO (`services/rank-identity.ts`), nunca por separado.

Un mismo algoritmo (`services/compute-unit-timeline.ts`) calcula `weight`/`peakWeight`/`momentum`/`confidence` para AMBOS grados -- `build-dimensions.ts`/`build-themes.ts` solo difieren en cómo agrupan su evidencia cruda en la forma neutral `IdentityEvidenceEvent { occurredAt, weight }`.

## Filosofía de identidad (por qué este diseño y no otro)

La pregunta de diseño central: **¿qué distingue una creencia que sigue siendo VERDAD de un tema que sigue siendo IDENTIDAD?** Un ejemplo real: "Juan se recuperó de una adicción" puede seguir siendo 100% cierto (el `Belief` puede seguir `status: "active"`, `confidence.score: 95`) sin que ese tema deba seguir dominando cada conversación. Verdad y protagonismo son ejes distintos -- `core/belief-engine` ya resuelve el primero (¿es cierto?, vía `confidence`/`status`); Identity Evolution resuelve el segundo (¿debería LUZ seguir hablando de esto AHORA?, vía `weight`/`momentum`), sin tocar ni depender del primero más que para saber que la evidencia existió y cuándo.

Esto es lo que permite la regla central de la misión sin contradicción: un `Belief` puede seguir siendo `active`/confiable en `core/belief-engine` (nunca se expira solo porque Identity Evolution decidió que ya no domina) mientras su `IdentityTheme` correspondiente lee `weight: 0`, `momentum: "dormant"`. La verdad no caduca; el protagonismo sí.

## Evolution algorithm (estrategia de decaimiento de peso)

Todo en `services/decay.ts`, aritmética lineal a propósito (mismo idioma que `core/belief-engine/services/decay-stale-beliefs.ts` y `core/importance-engine`): una fórmula que se explica en una frase es más auditable que una que necesita cálculo.

**Dos horizontes de tiempo distintos, deliberadamente separados:**

| Constante | Valor | Responde |
|---|---|---|
| `LOOKBACK_DAYS` | 365 | ¿Hasta dónde mira este snapshot? (evidencia más vieja ni siquiera cuenta para `evidenceCount`/`peakWeight` -- pero la fila en `core/belief-engine`/`core/concept-graph` nunca se toca) |
| `RECENCY_DECAY_DAYS` | 90 | ¿Qué tan rápido se apaga el peso sin refuerzo? |

La separación existe por una razón concreta, encontrada al validar contra el propio ejemplo de la misión: con una sola rampa de 365 días, una racha real de evidencia vieja (ej. "habló de esto todos los días" hace 8-12 meses) todavía puede sumar suficiente peso decaído para saturar `weight` HOY, solo por pura cantidad acumulada -- exactamente lo que la misión prohíbe ("anxiety... no longer identity" tras 8 meses de silencio). Con `RECENCY_DECAY_DAYS = 90` como rampa real, cualquier evidencia sin refuerzo en los últimos ~3 meses deja de aportar del todo a `weight`, sin importar cuánta haya habido antes -- la única forma de mantener `weight` alto es seguir generando evidencia real, no haber generado mucha alguna vez. `LOOKBACK_DAYS` (365) sigue existiendo para no perder el pico histórico (`peakWeight`) ni la fecha de evidencia más antigua.

**La fórmula, paso a paso** (`weightFromEvents`):

1. Cada evento de evidencia tiene un peso base fijo según su tipo (`SIGNAL_BASE_WEIGHT`): `belief_created`/`concept_evidence` = 3, `belief_strengthened`/`belief_weakened` = 2, `belief_expired`/`belief_retracted` = 1.
2. Rampa lineal de recencia: `multiplier = clamp(1 - edadEnDías / 90, 0, 1)` -- 1.0 hoy, 0.0 a los 90 días o más.
3. `raw = Σ peso_base(evento) × multiplier(edad(evento))` sobre todos los eventos.
4. `weight = clamp(round(raw / 14 × 100), 0, 100)` -- 14 "puntos de evidencia decaída" saturan a 100, capado y lineal (mismo criterio que `Math.min(60, evidenceCount × 12)` en `core/importance-engine`).

**`peakWeight`** -- la misma fórmula, muestreada en 13 checkpoints regulares (cada 30 días) a lo largo de todo `LOOKBACK_DAYS`, cada uno simulando "¿cómo se habría leído esto desde ese punto en el tiempo?". El mayor valor observado. Nunca decae -- es la prueba permanente de que algo SÍ importó alguna vez, incluso cuando `weight` hoy es 0.

**`delta`/momentum** -- se compara `weight` (hoy) contra `weightAtComparisonCheckpoint` (`weight` calculado con `asOf = now - 45 días`, usando SOLO evidencia que ya existía en ese momento). `|delta| <= 6` (`STABILITY_THRESHOLD`) cuenta como "sin cambio real".

**Primera iteración, no un techo** (Principio 1 del motor): estas constantes son un punto de partida razonable sin datos reales de uso todavía (Alpha, pocos usuarios) -- pensadas para recalibrarse con evidencia real, nunca como una verdad matemática definitiva sobre cómo evoluciona una identidad humana.

## IdentityMomentum -- los cinco estados

`services/compute-unit-timeline.ts`, función `classifyMomentum`:

| Momentum | Condición exacta | Corresponde a (misión) |
|---|---|---|
| `emerging` | `delta > 6`, y NO hubo un pico significativo previo con silencio real antes | growth |
| `renewing` | `delta > 6`, Y `peakWeight >= 40` en algún momento, Y hubo un silencio real (`>= 60 días`) inmediatamente antes de la ventana de comparación | renewal |
| `stable` | `|delta| <= 6` (y no cumple la condición de `dormant`) | stability |
| `declining` | `delta < -6` | decay |
| `dormant` | `peakWeight >= 40` alguna vez, Y `weight` HOY `< 15`, Y `weightAtComparisonCheckpoint` TAMBIÉN `< 15` | -- capítulo ya resuelto, distinto de "cayendo ahora mismo" |

`transition` (el quinto término que pide la misión) no es un estado de reposo -- una transición es un EVENTO, no algo en lo que algo "está". Se modela como `IdentityShift` (ver abajo) a nivel de unidad, y como `IdentityTrajectory.state === "transitioning"` a nivel de snapshot completo (cuando el puesto #1 de TODA la identidad cambió de dueño). Ver "Self Audit" para el razonamiento completo de este rediseño.

**Ajuste encontrado durante validación** (ver "Debilidades conocidas"): la condición de `dormant` originalmente exigía `|delta| <= 6` en vez de comparar los dos valores absolutos contra el umbral -- eso podía leer un capítulo ya apagado como `declining` por ruido de dos números ya pequeños. Corregido para exigir que AMBOS puntos (hoy y hace 45 días) estén ya por debajo del umbral, sin importar la diferencia entre ellos.

## IdentityShift / IdentityTrajectory

- **`IdentityShift`** -- un registro por cada unidad cuyo `momentum` actual difiere de su propio `previousMomentum` (el mismo algoritmo, recalculado con `now' = now - 45 días`, recursivamente). `"stable" -> "stable"` nunca genera un shift.
- **`IdentityTrajectory`** -- compara quién lideraba el ranking completo (dimensiones + temas) hace 45 días contra quién lidera hoy. `consolidating` (mismo #1), `transitioning` (#1 cambió de dueño), o `insufficient_evidence` (nadie cruza el umbral mínimo hoy). Reutiliza el MISMO criterio de desempate que decide `primaryIdentity` (`services/rank-identity.ts`, `topUnitBy`) -- un bug real encontrado durante la validación: con dos criterios de desempate distintos, `trajectory.primaryKey` podía contradecir a `primaryIdentity.key` en un empate. Corregido antes de este commit.

## Representation strategy

`IdentityRepresentation.summary` (`services/derive-representation.ts`) es plantilla + números reales del propio `momentum`/`weight`/`peakWeight` -- nunca IA. Cinco plantillas, una por `IdentityMomentum`, cada una citando la evidencia real que la respalda (Principio 3). Distinta de `momentumReason` (interno, técnico, para debugging/explicabilidad) -- `representation.summary` es la versión para un consumidor final.

## Ranking y desempate

`services/rank-identity.ts` combina dimensiones y temas en un solo pool, ordenado por `weight` descendente. Cuando varias unidades saturan `weight: 100` a la vez (frecuente con compromiso denso y sostenido), el desempate es: `confidenceScore` (más evidencia real, mejor repartida en el tiempo) → tema antes que dimensión (más específico gana un empate real) → clave (determinismo final). Este desempate se corrigió durante la validación: con solo `weight` + clave alfabética, el ejemplo propio de la misión (LUZ/equipo/Colombia Tech, los tres saturados a 100) elegía `primaryIdentity` por accidente alfabético ("career" le ganaba a "Construyendo LUZ" solo porque "c-a" ordena antes que "c-o"). Con el desempate por confianza + especificidad, "Construyendo LUZ" gana correctamente.

`primaryIdentity`/`secondaryIdentity`/`stableThemes` solo consideran unidades con `weight >= 8` (`PRESENCE_THRESHOLD`) -- por debajo de eso, una dimensión/tema sigue existiendo en `dimensions`/`themes` pero no compite por protagonismo. `resolvedChapters` (`momentum === "dormant"`) y `deemphasized` (unión de `declining` + `dormant`, filtrada a `peakWeight >= 40`) son la respuesta directa a "Resolved chapters" y "Things that should no longer dominate conversations" de la misión.

## Guidance outputs

Cuatro campos, cada uno una proyección DERIVADA del ranking ya calculado (nunca una segunda decisión independiente, mismo criterio anti-duplicación que el resto del repo) -- datos crudos, nunca una frase lista:

- **`conversationGuidance`** -- `leadWithDomain`/`leadWithTheme` (identidad principal de hoy), `worthAcknowledging` (emerging + renewing), `avoidDominating` (deemphasized).
- **`narrativeGuidance`** -- `primaryThemeKey`, `recurringThemeKeys` (temas estables con buen historial), `resolvedChapterKeys`.
- **`presenceGuidance`** -- `suggestedFocusDomain`, `deemphasizeDomains`.
- **`experienceGuidance`** -- `spotlightThemeKey`, `retireThemeKeys`.

## Integraciones -- contratos, sin wiring

Ningún llamador real hoy (cero import cruzado desde `features/presence`/`features/narrative`/`features/experience`/`core/conversation-strategy-engine`, verificado) -- mismo criterio que `features/narrative/integrations/`: contrato listo, sin wiring profundo:

- `toIdentityConversationSignal(snapshot)` -- añade `isIdentityInTransition` (derivado de `trajectory.state`).
- `toIdentityPresenceSignal(snapshot)` -- añade `primaryMomentum` (calibra tono de saludo).
- `toIdentityNarrativeSignal(snapshot)` -- añade `trajectoryState`.
- `toIdentityExperienceSignal(snapshot)` -- añade `hasRecentIdentityShift`.

## Cómo se cumple cada regla de la misión

- **Never delete memories / never hide history**: cero `DELETE`, cero filtro que excluya una unidad de `dimensions`/`themes` por peso bajo -- verificado en el escenario "nunca se borra nada".
- **Identity ≠ memory frequency / recommendation count / recent conversation only**: `weight` nunca cuenta mensajes ni recomendaciones -- solo `EvolutionEvent`/`ConceptEvidence` con decaimiento de 90-365 días.
- **Not instantly, not after one message**: `COMPARISON_WINDOW_DAYS = 45` es el piso para hablar de cambio real; un solo evento nunca cruza `STABILITY_THRESHOLD` por sí solo salvo que ya no hubiera nada más (ver escenario "parenthood": 13 eventos reales en 25 días, no uno).
- **No new `core/*-engine`, no modification to Memory/Knowledge/Narrative/Experience**: verificado -- `git diff` de esta misión toca únicamente `features/identity-evolution/`.
- **Consume public outputs only**: `describeEvolution` (`features/identity/`, función pública, sin modificar) + `ConceptRepository` (`core/concept-graph`, interfaz pública, solo lectura).
- **Deterministic**: `buildIdentitySnapshot` no tiene IO, no tiene IA, no tiene `Math.random()` -- ver escenario "determinismo".

## Validación

```bash
npx tsx features/identity-evolution/tests/build-identity-snapshot.examples.ts
```

Los ocho escenarios de la misión, más cuatro verificaciones estructurales -- los doce pasando:

| Escenario | Qué verifica |
|---|---|
| Recovery from addiction | Pico real (12→6 meses), silencio total después: `dormant`, sigue en `resolvedChapters` y `deemphasized`, nunca gana `primaryIdentity` |
| Career change | Tema viejo se apaga (`dormant`/`declining`), tema nuevo `emerging` en el MISMO dominio -- el dominio "career" sigue vivo, el tema específico migra |
| Startup founder journey | Compromiso denso y sostenido durante meses, todavía activo: se asienta en `stable` a peso alto (≥80), no se queda `emerging` para siempre |
| Relationship recovery | Pico real, silencio real (>60 días), vuelve a crecer: `renewing`, nunca `emerging` (si hay algo de qué regresar, se nota) |
| Parenthood | Tema sin ningún historial previo: `emerging`, nunca `renewing` (nada de qué "volver") |
| University graduation | Historia larga y sostenida que llega a un cierre real y calla: se enfría (`declining`/`dormant`), nunca sigue `stable` como si nada |
| Long-term illness | Evidencia sostenida y moderada durante 300 días, sin saltos dramáticos: `stable`, no mal-clasificada por ruido |
| Major life transition | Un tema pierde el puesto #1 frente a otro que emerge: `trajectory.state === "transitioning"`, `recentShifts` real |
| Cuenta vacía | Las 8 dimensiones existen igual, `weight: 0`, `primaryIdentity`/`secondaryIdentity` `null`, `trajectory: "insufficient_evidence"` -- nunca fabricado |
| Determinismo | Misma entrada + mismo `now` -> mismo JSON, byte a byte |
| Nunca se borra nada | Un tema totalmente dormido sigue presente en `themes[]` |
| Límites | `weight`/`peakWeight`/`confidence.score` nunca salen de `[0, 100]` incluso con evidencia extrema |

**Verificación adicional, contra el ejemplo textual de la propia misión** (Building LUZ / Leading engineering / Colombia Tech / Health / Ketamine recovery, reconstruido en un escenario ad-hoc durante el desarrollo, no parte del script permanente): con compromiso denso en los tres temas de carrera y silencio total en el tema de salud desde hace 6 meses, el resultado real fue `primaryIdentity: "Construyendo LUZ"` (peso 100), `secondaryIdentity: "Liderando un equipo de ingeniería"` (peso 100), "Preparando Colombia Tech Week" en `weight: 100` pero `momentum: "emerging"` (delta +79 en 45 días -- todavía demostrándose), "Recuperación de ketamina" en `weight: 0`, `peakWeight: 100`, `momentum: "dormant"`. La forma exacta del ejemplo de la misión, reproducida con evidencia sintética real.

`tsc --noEmit` y `eslint features/identity-evolution` limpios. Sin verificación contra Postgres real -- módulo sin persistencia propia, mismo criterio que `features/narrative`/`features/continuity`: validación 100% escenarios sintéticos + tipos + lint. `assemble-identity-evolution.ts` (el único archivo con IO) es deliberadamente delgado -- reutiliza `describeEvolution` (ya verificado contra Postgres real en su propia misión) y una consulta directa de solo lectura a `core/concept-graph`, sin lógica propia que pudiera fallar de forma distinta a sus dos dependencias.

## Self Audit

*¿Haría esto que el usuario se sienta comprendido?* Sí, de una forma que el `PersonIdentityModel` actual no logra: hoy, una persona que superó una adicción hace medio año y le cuenta a LUZ que esa etapa fue su "peor capítulo, ya superado" seguiría viendo esa etapa listada junto a sus creencias top si simplemente tuvo suficiente evidencia acumulada alguna vez. Con Identity Evolution, esa etapa decae a `weight` bajo, aparece en `resolvedChapters`, y dos temas realmente vigentes (construir LUZ, liderar un equipo) ganan `primaryIdentity`/`secondaryIdentity` en su lugar -- validado, no hipotético (ver "Verificación adicional" arriba).

*¿Reduciría conversaciones repetitivas?* Sí, indirectamente: `conversationGuidance.avoidDominating` existe exactamente para que un futuro `ConversationStrategyEngine` sepa qué NO traer de vuelta sin que nadie se lo pida. Hoy es un contrato listo sin wiring (ver "Debilidades conocidas") -- el efecto real depende de que alguien lo conecte.

*¿Haría sentir a LUZ más viva?* Sí -- la diferencia entre un sistema que archiva hechos y uno que nota que "esto ya no es lo que más importa, aunque siga siendo cierto" es, literalmente, la diferencia entre un registro y una persona que te conoce.

*¿Dejaría de anclar al usuario a versiones viejas de sí mismo?* Es la pregunta que más forzó el diseño: la primera versión mental de este algoritmo (una sola rampa de decaimiento de 365 días) SÍ seguía anclando -- una racha vieja de evidencia bastaba para saturar el peso de hoy con pura cantidad acumulada, sin importar cuánto silencio hubiera después. Encontrado y corregido durante la validación (`RECENCY_DECAY_DAYS` separado de `LOOKBACK_DAYS`, ver "Evolution algorithm") antes de considerar el diseño terminado -- la respuesta a esta pregunta pasó de "no" a "sí" a mitad del desarrollo, no fue el diseño original.

## Debilidades conocidas

- **Constantes de calibración de primera iteración, no verdad definitiva.** `LOOKBACK_DAYS`, `RECENCY_DECAY_DAYS`, `SCORE_SATURATION_POINTS`, los umbrales de momentum -- todos elegidos por razonamiento (validados contra ocho escenarios sintéticos + el ejemplo textual de la misión), ninguno contra uso real todavía (Alpha, pocos usuarios). Deben recalibrarse cuando haya evidencia real de cuántos eventos por semana genera una persona real.
- **Compromiso denso y sostenido satura varios temas a `weight: 100` a la vez**, perdiendo diferenciación fina entre "muy dominante" y "extremadamente dominante" (el ejemplo de la misión distingue 98 de 94 de 93; esta implementación, con evidencia igual de densa en los tres, los lee a los tres en 100). El desempate por `confidenceScore` + especificidad (ver "Ranking y desempate") resuelve CUÁL gana `primaryIdentity`, pero no recupera la diferenciación de peso en sí -- ver "Extensiones futuras".
- **Decaimiento lineal por punto de muestra, no por integral continua.** Para evidencia MUY espaciada y perfectamente periódica (ej. cada 10 días exactos, sin variación), el desfase entre el punto de muestra de hoy y el de hace 45 días puede introducir ruido de unos pocos puntos de `weight` por pura coincidencia de calendario -- encontrado durante la validación (escenario "long-term illness" con espaciado de 10 días fallaba por esto), mitigado ajustando la densidad de evidencia del escenario (7 días, más realista) más un ajuste real al umbral de `dormant` (ver "IdentityMomentum"). Un patrón de evidencia real (nunca perfectamente periódico) no debería tropezar con esto, pero la sensibilidad teórica sigue ahí.
- **No mina `RealitySnapshot`/`NarrativeState`/`Contradiction`/`PendingPrediction` en v1.** Deliberado -- minarlos aparte arriesgaría la "lógica de ranking duplicada entre módulos" que Home/Experience/Presence/Narrative ya advierten evitar en sus propios README, ya que la evidencia real detrás de esos campos ya llega a Identity Evolution indirectamente vía `Belief`/`Concept` (los contradicciones y predicciones ya se consolidan desde beliefs). Una contradicción ABIERTA sobre un tema que Identity Evolution ya marcó `dormant` no se refleja hoy -- candidato real a v2 si la práctica lo pide.
- **`insight_discovered` nunca aporta a `weight` por dimensión** (el `EvolutionEvent` de ese tipo nunca trae `domain`) -- sí aporta a `overallConfidence` (nivel snapshot). Aceptado: la mayoría de insights ya se consolidan en `Belief`s con dominio, que sí cuentan.
- **`themeKey` es el `Concept.id`, no la etiqueta.** Correcto para estabilidad (una etiqueta puede editarse), pero significa que si `core/concept-graph` alguna vez fusiona dos `Concept`s duplicados, Identity Evolution no lo sabría -- heredaría el problema de deduplicación de conceptos tal cual existe hoy en `core/concept-graph`.
- **Sin verificación contra Postgres real** -- ver "Validación".

## Extensiones futuras (máximo 5)

1. **Wiring real de `integrations/`** hacia `core/conversation-strategy-engine`/`features/presence`/`features/narrative`/`features/experience`.
2. **Recalibrar constantes con datos reales de uso** una vez haya suficiente volumen de eventos por usuario para medir en vez de razonar.
3. **Diferenciación fina entre temas saturados** -- una función de saturación con retornos decrecientes más suave que el cap lineal actual, si en la práctica varios temas dominantes a la vez resultan ser el caso común (no solo el sintético).
4. **Minar `Contradiction`/`PendingPrediction` abiertos** como un modificador acotado sobre `weight`/`momentum`, si la práctica muestra que una tensión real abierta debería frenar la clasificación `dormant` de un tema.
5. **Deduplicación de temas por similitud semántica**, si `core/concept-graph` gana esa capacidad -- hoy un tema es 1:1 con un `Concept`, sin fusión.
