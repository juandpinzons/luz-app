# Reference Integrity — auditoría + infraestructura

Infraestructura reutilizable para las referencias polimórficas de LUZ (`entityType`/`entityId`, `sourceType`/`sourceId`, `refType`/`refId`, y columnas "sin FK por diseño"). Sin cambios al modelo de datos, sin cambios a ningún contrato público. Verificado de punta a punta contra Postgres real (local).

## Inventario -- 13 puntos de referencia, 15 pares type+id/columnas

| # | Punto | Tipo | Vocabulario | Índice existente |
|---|---|---|---|---|
| 1 | `entity_relations.from` | polimórfico | `EntityType` (legado) | sí, compuesto |
| 2 | `entity_relations.to` | polimórfico | `EntityType` (legado) | sí, compuesto |
| 3 | `evidence.source` | polimórfico | `EntityType` (legado) | **no** |
| 4 | `memory_embeddings.source` | polimórfico | `EntityType` (actual) | sí, compuesto |
| 5 | `knowledge_jobs.source` | polimórfico | `EntityType` (actual) | **no** |
| 6 | `importance_scores.entity` | polimórfico | propio (insight/concept/belief/reasoning_conclusion) | sí, único compuesto |
| 7 | `contradictions.left` | polimórfico | propio (belief/goal/project/habit) | sí, compuesto |
| 8 | `contradictions.right` | polimórfico | propio | sí, compuesto |
| 9 | `knowledge_engine_reasoning_evidence.ref` | polimórfico | propio (insight/memory hoy) | sí, compuesto |
| 10 | `beliefs.subjectPersonId` | bare | -- (fijo: persons) | **no** |
| 11 | `belief_evidence.insightId` | bare, nullable | -- (fijo: knowledge_engine_insights) | sí |
| 12 | `belief_evidence.memoryId` | bare, nullable | -- (fijo: memories) | **no** |
| 13 | `concept_evidence.insightId` | bare, nullable | -- (fijo: knowledge_engine_insights) | sí |
| 14 | `concept_evidence.memoryId` | bare | -- (fijo: memories) | **no** |
| 15 | `knowledge_engine_evidence.memoryId` | bare | -- (fijo: memories) | sí |

Ver `registry/reference-registry.ts` para el detalle completo -- cada punto documenta su tabla, columnas, nullabilidad, y destinos reales (con evidencia de código, no teóricos).

## 1. Validaciones faltantes (antes de este módulo)

**Cero.** Ninguna referencia polimórfica de LUZ tenía validación alguna -- ni en runtime (grep de `orphan`/`integrity`/`validateReference` en todo `core/`/`features/`: cero resultados) ni en la base de datos (ningún `CHECK constraint` ata un valor de "type" a un vocabulario cerrado). `EntityType` existe solo como anotación de TypeScript en tiempo de compilación, nunca verificado en tiempo de ejecución.

**Ahora**: `validators/validate-reference.ts` -- `validateBareReference`/`validatePolymorphicReference`, guardas de escritura reutilizables. No están conectadas a ningún flujo de escritura existente todavía (esta misión es "implementa infraestructura", no "cablea la infraestructura en cada repositorio" -- esa integración es una decisión de un bloque futuro, deliberadamente no tomada aquí).

## 2. Referencias huérfanas (hallazgo real, verificado contra Postgres local)

`runIntegrityCheck()` corrido contra la base de datos de desarrollo local encontró **26 huérfanos reales**:

| Punto | Huérfanos | Sobre un total de |
|---|---|---|
| `contradictions.left` | 1 | 1 |
| `contradictions.right` | 1 | 1 |
| `knowledge_engine_reasoning_evidence.ref` | 2 | 4 |
| `belief_evidence.insightId` | 4 | 24 |
| `belief_evidence.memoryId` | 4 | 24 |
| `concept_evidence.insightId` | 6 | 66 |
| `concept_evidence.memoryId` | 6 | 66 |
| `knowledge_engine_evidence.memoryId` | 2 | 14 |

El resto de los puntos (7 de 15) están sanos -- `entity_relations`/`evidence`/`memory_embeddings` están vacíos en la práctica (confirma auditorías previas: legados sin consumidores, o generación de embeddings no implementada); `knowledge_jobs`/`importance_scores`/`beliefs.subjectPersonId` no tienen huérfanos.

**No reparé estos 26 huérfanos.** Esta misión pedía infraestructura, no una limpieza de la base local -- la infraestructura para hacerlo (`buildRepairPlan`/`executeRepairPlan`) está construida y verificada (ver §6), pero ejecutarla contra datos reales, aunque sean de desarrollo, es una decisión aparte que debe pedirse explícitamente.

## 3. Cascadas inexistentes

Ninguno de los 15 puntos tiene `ON DELETE CASCADE` -- **estructuralmente imposible** para los 9 polimórficos (Postgres no soporta una FK cuya tabla destino varíe según el valor de otra columna) y deliberadamente omitido para los 6 "bare" (documentado en cada schema: "sin FK real a propósito", para no cerrar la puerta a que la columna evolucione). Esto no es un descuido -- es la razón de ser de este módulo: sin cascada de base de datos, el borrado de una fila destino (un insight, una memoria, un belief) dejará huérfanos en cualquier tabla que lo referenciara, silenciosamente, para siempre, a menos que algo los detecte. Antes de esta infraestructura, nada lo hacía.

## 4. Integridad lógica -- dos hallazgos reales

**a) `EntityType` es ambiguo entre legado y actual.** `entity_relations`/`evidence` (escopadas por `userId`, legado) y `memory_embeddings`/`knowledge_jobs` (escopadas por `lifeGraphId`/`userId`, actuales) comparten el mismo vocabulario `EntityType`, pero el mismo valor (`"insight"`, `"person"`, `"goal"`...) resuelve a tablas DISTINTAS según de cuál columna viene -- legado apunta a `insights`/`people`/`goals` (knowledge.ts), actual apuntaría a `knowledge_engine_insights`/`persons`/`life_goals`. Nada en el código lo documenta hoy; este registro es el primer lugar donde esa distinción queda explícita (`LEGACY_ENTITY_TARGETS` vs `CURRENT_ENTITY_TARGETS`).

**b) Tres vocabularios de "type" distintos, ninguno reconciliado.** `EntityType` (10 valores, compartido por 4 puntos), el vocabulario propio de `importance_scores` (`insight`/`concept`/`belief`/`reasoning_conclusion` -- incluye `belief`/`concept`, que NO están en `EntityType`), y el de `contradictions` (`belief`/`goal`/`project`/`habit`). Un mismo string, `"insight"`, puede significar tres tablas distintas dependiendo de en qué columna aparece. Documentado explícitamente en el registro, no resuelto -- unificarlo sería un cambio de modelo de datos, fuera de esta misión.

**c) `knowledge_jobs` (escopada por `userId`) referencia memorias (escopadas por `lifeGraphId`) -- cruce de tenencia estructural.** El chequeo de existencia de este módulo confirma que el id existe, nunca que pertenece al usuario/LifeGraph correcto (ver "Qué NO hace este módulo" abajo) -- una limitación real, no silenciada.

## 5. Migraciones seguras recomendadas (NO ejecutadas -- análisis únicamente, per instrucción explícita de esta misión)

Cinco columnas de referencia sin índice, encontradas en esta auditoría y en la de "Graph Performance" previa:

```sql
CREATE INDEX "evidence_source_idx" ON "evidence" USING btree ("source_type", "source_id");
CREATE INDEX "knowledge_jobs_source_idx" ON "knowledge_jobs" USING btree ("source_type", "source_id");
CREATE INDEX "beliefs_subject_person_id_idx" ON "beliefs" USING btree ("subject_person_id");
CREATE INDEX "belief_evidence_memory_id_idx" ON "belief_evidence" USING btree ("memory_id");
CREATE INDEX "concept_evidence_memory_id_idx" ON "concept_evidence" USING btree ("memory_id");
```

Todas son aditivas (`CREATE INDEX`, sin `NOT VALID`/sin bloqueo de escritura relevante al volumen actual de estas tablas) -- seguras en el sentido de "no cambian el modelo de datos ni requieren downtime". No las apliqué: esta misión pidió explícitamente "sin cambiar el modelo de datos" para la IMPLEMENTACIÓN; quedan como recomendación para una fase de hardening futura, igual que se hizo con los índices de "Graph Performance".

## 6. Helpers reutilizables entregados

```
core/reference-integrity/
  domain/            — ReferenceTarget, ReferencePoint (polymorphic | bare), IntegrityReport, OrphanRecord
  registry/           — REFERENCE_POINTS: los 15 puntos, declarativos, con evidencia
  repositories/       — checkIdsExist/checkIdExists (por lote, inArray, nunca N+1)
  validators/         — validateBareReference/validatePolymorphicReference + ReferenceValidationError
  integrity/          — scanReferencePoint, runIntegrityCheck, findOrphansForPoint, findAllOrphans
  repair/             — buildRepairPlan (pura), executeRepairPlan (requiere confirm:true, transaccional)
```

**Verificado de punta a punta contra Postgres real** (`.scratch/verify-reference-integrity.ts`, docker local): validación de referencia válida/inválida/tipo-no-registrado, e inserción de un huérfano deliberado en `entity_relations` → detectado por `findOrphansForPoint` → plan generado por `buildRepairPlan` (estrategia `delete_row`, correcta para una columna `notNull`) → ejecutado con `executeRepairPlan(..., { confirm: true })` → confirmado que ya no aparece como huérfano. También verificado que `executeRepairPlan` sin `confirm: true` lanza sin tocar la base de datos.

## Qué NO hace este módulo (límites reales, documentados a propósito)

- **No verifica tenencia, solo existencia.** Un id real que pertenece a OTRO LifeGraph/usuario pasa el chequeo (`ReferenceTarget.scopeColumn` existe en el tipo para esto, pero no está cableado en ningún checker todavía -- extensión documentada, no implementada).
- **No está conectado a ningún flujo de escritura real.** Los validadores existen y funcionan; ningún repositorio de `core/*-engine` los llama todavía.
- **No corre automáticamente.** No hay cron, no hay job programado -- correr `runIntegrityCheck`/reparar es una decisión manual de quien lo invoque.
- **No reconcilia los tres vocabularios de "type"** (hallazgo 4b) -- documentarlo era el alcance de esta misión, unificarlo sería un cambio de modelo de datos.
