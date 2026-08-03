import { eq } from "drizzle-orm";
import {
  beliefEvidence,
  beliefs,
  concepts,
  conceptEvidence,
  conversationMessages,
  conversations,
  contradictions,
  documents,
  entityRelations,
  evidence,
  goals,
  habits,
  importanceScores,
  journalEntries,
  knowledgeEngineEvidence,
  knowledgeEngineInsights,
  knowledgeEngineReasoningConclusions,
  knowledgeEngineReasoningEvidence,
  knowledgeJobs,
  lifeGoals,
  lifeHabits,
  lifeProjects,
  memories,
  memoryEmbeddings,
  people,
  persons,
  projects,
  insights,
} from "../../db/schema";
import type { ReferencePoint, ReferenceTarget } from "../domain";

/**
 * Inventario declarativo de TODOS los puntos de referencia polimórfica
 * o "sin FK por diseño" del esquema -- una fila por cada hallazgo real
 * de la auditoría (ver `providers/apple/AUDIT.md`... no, ver el
 * reporte de esta misión). Ninguna consulta corre aquí -- este archivo
 * es puro, solo describe DÓNDE están y QUÉ deberían apuntar.
 *
 * ## Vocabulario `EntityType` -- legado vs. actual (hallazgo real)
 *
 * `entity_relations`/`evidence` (`core/db/schema/relations.ts`) son
 * LEGADAS, escopadas por `userId` (cero consumidores confirmado en
 * auditorías previas) -- sus valores de tipo apuntan a las tablas
 * legadas correspondientes (`projects`/`goals`/`habits`/`people`/
 * `insights` de `knowledge.ts`).
 *
 * `memory_embeddings`/`knowledge_jobs` usan el MISMO vocabulario
 * `EntityType` (`core/db/schema/entity-type.ts`) pero son tablas
 * ACTUALES -- si alguna vez escriben `"project"`/`"goal"`/`"habit"`/
 * `"person"`/`"insight"` (no observado en código real al momento de
 * este análisis; ver reporte), lo correcto es que apunten a las
 * tablas ACTUALES (`lifeProjects`/`lifeGoals`/`lifeHabits`/`persons`/
 * `knowledgeEngineInsights`), no a las legadas -- son conceptos
 * distintos con el mismo nombre de tipo. Este registro NUNCA asume un
 * único mapeo universal de `EntityType` -- cada punto declara sus
 * propios `targets`.
 *
 * `"memory"` como valor de tipo en las tablas LEGADAS (`entity_relations`/
 * `evidence`) es estructuralmente no verificable: `memories` está
 * escopada por `lifeGraphId`, no por `userId` -- no hay una columna de
 * usuario en `memories` contra la cual cruzar. Marcado `unsupported`,
 * nunca reportado como huérfano ni como sano.
 *
 * ## Vocabularios propios (no `EntityType`)
 *
 * `importance_scores.entityType`, `contradictions.leftRefType`/
 * `rightRefType`, y `knowledge_engine_reasoning_evidence.refType` NO
 * usan `EntityType` -- cada uno tiene su propio vocabulario, libre por
 * diseño (ver docblocks de sus tablas). Los `targets` declarados abajo
 * son los valores REALMENTE observados en el código (`grep` real sobre
 * `updateImportance(...)`/`refType: "..."`), no una lista teórica --
 * un valor nuevo que el dominio empiece a usar mañana aparecerá como
 * `unsupported` hasta que se agregue aquí (fail-safe: nunca un falso
 * "sano").
 */

const LEGACY_ENTITY_TARGETS: readonly ReferenceTarget[] = [
  { typeValue: "conversation", table: conversations, tableName: "conversations", idColumn: conversations.id },
  {
    typeValue: "conversation_message",
    table: conversationMessages,
    tableName: "conversation_messages",
    idColumn: conversationMessages.id,
  },
  { typeValue: "journal_entry", table: journalEntries, tableName: "journal_entries", idColumn: journalEntries.id },
  { typeValue: "document", table: documents, tableName: "documents", idColumn: documents.id },
  { typeValue: "project", table: projects, tableName: "projects", idColumn: projects.id },
  { typeValue: "goal", table: goals, tableName: "goals", idColumn: goals.id },
  { typeValue: "habit", table: habits, tableName: "habits", idColumn: habits.id },
  { typeValue: "person", table: people, tableName: "people", idColumn: people.id },
  { typeValue: "insight", table: insights, tableName: "insights", idColumn: insights.id },
  {
    typeValue: "memory",
    table: memories,
    tableName: "memories",
    idColumn: memories.id,
    unsupported: {
      reason:
        "entity_relations/evidence están escopadas por userId; memories está escopada por lifeGraphId -- no hay columna de usuario en memories contra la cual verificar.",
    },
  },
];

const CURRENT_ENTITY_TARGETS: readonly ReferenceTarget[] = [
  { typeValue: "conversation", table: conversations, tableName: "conversations", idColumn: conversations.id },
  {
    typeValue: "conversation_message",
    table: conversationMessages,
    tableName: "conversation_messages",
    idColumn: conversationMessages.id,
  },
  { typeValue: "journal_entry", table: journalEntries, tableName: "journal_entries", idColumn: journalEntries.id },
  { typeValue: "document", table: documents, tableName: "documents", idColumn: documents.id },
  { typeValue: "project", table: lifeProjects, tableName: "life_projects", idColumn: lifeProjects.id },
  { typeValue: "goal", table: lifeGoals, tableName: "life_goals", idColumn: lifeGoals.id },
  { typeValue: "habit", table: lifeHabits, tableName: "life_habits", idColumn: lifeHabits.id },
  { typeValue: "person", table: persons, tableName: "persons", idColumn: persons.id },
  {
    typeValue: "insight",
    table: knowledgeEngineInsights,
    tableName: "knowledge_engine_insights",
    idColumn: knowledgeEngineInsights.id,
  },
  { typeValue: "memory", table: memories, tableName: "memories", idColumn: memories.id },
];

export const REFERENCE_POINTS: readonly ReferencePoint[] = [
  // ---- Grupo A: pares type+id atados a EntityType ----
  {
    kind: "polymorphic",
    name: "entity_relations.from",
    description: "Extremo origen de una relación genérica entre entidades (legado, sin consumidores confirmados).",
    table: entityRelations,
    tableName: "entity_relations",
    ownIdColumn: entityRelations.id,
    typeColumn: entityRelations.fromType,
    idColumn: entityRelations.fromId,
    nullable: false,
    targets: LEGACY_ENTITY_TARGETS,
  },
  {
    kind: "polymorphic",
    name: "entity_relations.to",
    description: "Extremo destino de una relación genérica entre entidades (legado).",
    table: entityRelations,
    tableName: "entity_relations",
    ownIdColumn: entityRelations.id,
    typeColumn: entityRelations.toType,
    idColumn: entityRelations.toId,
    nullable: false,
    targets: LEGACY_ENTITY_TARGETS,
  },
  {
    kind: "polymorphic",
    name: "evidence.source",
    description: "Fuente concreta que respalda un insight legado.",
    table: evidence,
    tableName: "evidence",
    ownIdColumn: evidence.id,
    typeColumn: evidence.sourceType,
    idColumn: evidence.sourceId,
    nullable: false,
    targets: LEGACY_ENTITY_TARGETS,
  },
  {
    kind: "polymorphic",
    name: "memory_embeddings.source",
    description: "Origen de un embedding de memoria (tabla actual, generación de embeddings no implementada aún -- probablemente vacía en la práctica).",
    table: memoryEmbeddings,
    tableName: "memory_embeddings",
    ownIdColumn: memoryEmbeddings.id,
    typeColumn: memoryEmbeddings.sourceType,
    idColumn: memoryEmbeddings.sourceId,
    nullable: false,
    targets: CURRENT_ENTITY_TARGETS,
  },
  {
    kind: "polymorphic",
    name: "knowledge_jobs.source",
    description: "Qué disparó un job de Knowledge Engine -- en la práctica, casi siempre una memoria recién capturada.",
    table: knowledgeJobs,
    tableName: "knowledge_jobs",
    ownIdColumn: knowledgeJobs.id,
    typeColumn: knowledgeJobs.sourceType,
    idColumn: knowledgeJobs.sourceId,
    nullable: false,
    targets: CURRENT_ENTITY_TARGETS,
  },

  // ---- Grupo B: pares type+id con vocabulario propio ----
  {
    kind: "polymorphic",
    name: "importance_scores.entity",
    description: "Entidad puntuada por el Importance Engine -- vocabulario propio, valores observados en código: insight/concept/belief/reasoning_conclusion.",
    table: importanceScores,
    tableName: "importance_scores",
    ownIdColumn: importanceScores.id,
    typeColumn: importanceScores.entityType,
    idColumn: importanceScores.entityId,
    nullable: false,
    targets: [
      { typeValue: "insight", table: knowledgeEngineInsights, tableName: "knowledge_engine_insights", idColumn: knowledgeEngineInsights.id },
      { typeValue: "concept", table: concepts, tableName: "concepts", idColumn: concepts.id },
      { typeValue: "belief", table: beliefs, tableName: "beliefs", idColumn: beliefs.id },
      {
        typeValue: "reasoning_conclusion",
        table: knowledgeEngineReasoningConclusions,
        tableName: "knowledge_engine_reasoning_conclusions",
        idColumn: knowledgeEngineReasoningConclusions.id,
      },
    ],
  },
  {
    kind: "polymorphic",
    name: "contradictions.left",
    description: "Extremo izquierdo de una tensión detectada -- vocabulario propio, valores observados: belief/goal/project/habit.",
    table: contradictions,
    tableName: "contradictions",
    ownIdColumn: contradictions.id,
    typeColumn: contradictions.leftRefType,
    idColumn: contradictions.leftRefId,
    nullable: false,
    targets: [
      { typeValue: "belief", table: beliefs, tableName: "beliefs", idColumn: beliefs.id },
      { typeValue: "goal", table: lifeGoals, tableName: "life_goals", idColumn: lifeGoals.id },
      { typeValue: "project", table: lifeProjects, tableName: "life_projects", idColumn: lifeProjects.id },
      { typeValue: "habit", table: lifeHabits, tableName: "life_habits", idColumn: lifeHabits.id },
    ],
  },
  {
    kind: "polymorphic",
    name: "contradictions.right",
    description: "Extremo derecho de una tensión detectada -- mismo vocabulario que el izquierdo.",
    table: contradictions,
    tableName: "contradictions",
    ownIdColumn: contradictions.id,
    typeColumn: contradictions.rightRefType,
    idColumn: contradictions.rightRefId,
    nullable: false,
    targets: [
      { typeValue: "belief", table: beliefs, tableName: "beliefs", idColumn: beliefs.id },
      { typeValue: "goal", table: lifeGoals, tableName: "life_goals", idColumn: lifeGoals.id },
      { typeValue: "project", table: lifeProjects, tableName: "life_projects", idColumn: lifeProjects.id },
      { typeValue: "habit", table: lifeHabits, tableName: "life_habits", idColumn: lifeHabits.id },
    ],
  },
  {
    kind: "polymorphic",
    name: "knowledge_engine_reasoning_evidence.ref",
    description: "Evidencia (a favor o en contra) de una conclusión de razonamiento -- vocabulario propio, hoy solo insight/memory (belief/concept planeados, no usados todavía).",
    table: knowledgeEngineReasoningEvidence,
    tableName: "knowledge_engine_reasoning_evidence",
    ownIdColumn: knowledgeEngineReasoningEvidence.id,
    typeColumn: knowledgeEngineReasoningEvidence.refType,
    idColumn: knowledgeEngineReasoningEvidence.refId,
    nullable: false,
    targets: [
      { typeValue: "insight", table: knowledgeEngineInsights, tableName: "knowledge_engine_insights", idColumn: knowledgeEngineInsights.id },
      { typeValue: "memory", table: memories, tableName: "memories", idColumn: memories.id },
    ],
  },

  // ---- Grupo C: columnas id sueltas, "sin FK por diseño" ----
  {
    kind: "bare",
    name: "beliefs.subjectPersonId",
    description: "A quién describe la creencia -- casi siempre la persona dueña del LifeGraph.",
    table: beliefs,
    tableName: "beliefs",
    ownIdColumn: beliefs.id,
    idColumn: beliefs.subjectPersonId,
    nullable: false,
    target: { typeValue: null, table: persons, tableName: "persons", idColumn: persons.id },
  },
  {
    kind: "bare",
    name: "belief_evidence.insightId",
    description: "Insight de Knowledge Engine que respalda una creencia, si aplica.",
    table: beliefEvidence,
    tableName: "belief_evidence",
    ownIdColumn: beliefEvidence.id,
    idColumn: beliefEvidence.insightId,
    nullable: true,
    target: {
      typeValue: null,
      table: knowledgeEngineInsights,
      tableName: "knowledge_engine_insights",
      idColumn: knowledgeEngineInsights.id,
    },
    nullify: async (db, ownId) => {
      await db.update(beliefEvidence).set({ insightId: null }).where(eq(beliefEvidence.id, ownId));
    },
  },
  {
    kind: "bare",
    name: "belief_evidence.memoryId",
    description: "Memoria que respalda una creencia, si aplica.",
    table: beliefEvidence,
    tableName: "belief_evidence",
    ownIdColumn: beliefEvidence.id,
    idColumn: beliefEvidence.memoryId,
    nullable: true,
    target: { typeValue: null, table: memories, tableName: "memories", idColumn: memories.id },
    nullify: async (db, ownId) => {
      await db.update(beliefEvidence).set({ memoryId: null }).where(eq(beliefEvidence.id, ownId));
    },
  },
  {
    kind: "bare",
    name: "concept_evidence.insightId",
    description: "Insight que originó o refuerza un concepto, si aplica.",
    table: conceptEvidence,
    tableName: "concept_evidence",
    ownIdColumn: conceptEvidence.id,
    idColumn: conceptEvidence.insightId,
    nullable: true,
    target: {
      typeValue: null,
      table: knowledgeEngineInsights,
      tableName: "knowledge_engine_insights",
      idColumn: knowledgeEngineInsights.id,
    },
    nullify: async (db, ownId) => {
      await db.update(conceptEvidence).set({ insightId: null }).where(eq(conceptEvidence.id, ownId));
    },
  },
  {
    kind: "bare",
    name: "concept_evidence.memoryId",
    description: "Memoria de evidencia de un concepto -- siempre presente (notNull).",
    table: conceptEvidence,
    tableName: "concept_evidence",
    ownIdColumn: conceptEvidence.id,
    idColumn: conceptEvidence.memoryId,
    nullable: false,
    target: { typeValue: null, table: memories, tableName: "memories", idColumn: memories.id },
  },
  {
    kind: "bare",
    name: "knowledge_engine_evidence.memoryId",
    description: "Memoria de evidencia de un insight -- neutral a propósito (preparada para fuentes no-Memory a futuro).",
    table: knowledgeEngineEvidence,
    tableName: "knowledge_engine_evidence",
    ownIdColumn: knowledgeEngineEvidence.id,
    idColumn: knowledgeEngineEvidence.memoryId,
    nullable: false,
    target: { typeValue: null, table: memories, tableName: "memories", idColumn: memories.id },
  },
];
