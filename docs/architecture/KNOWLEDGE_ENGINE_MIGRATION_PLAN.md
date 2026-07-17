# Knowledge Engine Migration Plan

Version: 1.0\
Status: Accepted — frozen (proposal only, not authorized to execute
Phase C)\
Related: ADR-0014, core/knowledge-engine, core/knowledge

## Purpose

Retire the parallel `core/knowledge/` and `core/knowledge-engine/`
modules into a single canonical `core/knowledge/`, without leaving dead
code or silently dropping capability. This document is the mapping and
the phasing — not a green light to execute Phase C. Mirrors
`MEMORY_ENGINE_MIGRATION_PLAN.md`'s structure and discipline.

## Current state

`core/knowledge/` (Drizzle-coupled, live):
- `knowledge-engine.ts` — `KnowledgeEngine` class, composes five
  `NotImplemented` stages and one real `DrizzlePersistStage`
- `types.ts` — `PipelineContext extends UserContext`, all stage
  contracts
- `pipeline/` — `extract.ts`, `classify.ts`, `relate.ts`, `generate.ts`,
  `validate.ts` throw `NotImplementedError`; `persist.ts` is real,
  writes `insights`/`evidence` directly
- `jobs.ts` — `enqueueKnowledgeJob`, called from
  `features/chat/services/send-message.ts`
- Consumed by `worker/index.ts` (polls `knowledge_jobs`, runs the
  pipeline) — **this module has live callers**, unlike `core/memory/`
  at the time of ADR-0012

`core/knowledge-engine/` (pure domain): entities (`Insight`, `Evidence`,
`InsightRelationship`), value objects, `InsightRepository`, six
lifecycle/strategy interfaces (`ExtractStage`, `ClassifyStage`,
`InsightRelationshipStrategy`, `InsightGenerationStrategy`,
`InsightValidationStrategy`, `PersistStage`), `KnowledgeEngine` engine
interface, three events. No implementation.

**Verified by repo-wide grep:** `projects`/`goals`/`habits`/`people`
(`core/db/schema/knowledge.ts`) and `entity_relations`
(`core/db/schema/relations.ts`) have zero consumers anywhere in the
codebase. `insights`/`evidence`/`knowledge_jobs` are live, consumed
exclusively by `core/knowledge/` and `worker/index.ts`.

## The one conceptual correction

`core/db/schema/knowledge.ts`'s `projects`/`goals`/`habits`/`people`
tables are — under Architecture V1 (ADR-0011, `DOMAIN_MODEL_V1.md`) —
Life Graph entities, not Knowledge. This is not a rename of that
table set; it's a retirement, with the responsibility already assigned
to `core/life` since Milestone 1. Unlike Memory's equivalent
correction, `core/life` does not yet have Drizzle-backed repositories
for `Goal`/`Project`/`Habit`/`Relationship` (only `LifeGraph` and
`Person` do) — a pre-existing gap this plan surfaces but does not
close.

Knowledge's real, permanent job is unchanged from `KNOWLEDGE_MODEL.md`:
turning memory ("what happened") into connected meaning ("what it
means"), scoped to a `LifeGraph`, never to a single conversation.

## Mapping

| Old (`core/knowledge/`, `core/db/schema/knowledge.ts`, `relations.ts`) | New home | Notes |
|---|---|---|
| `KnowledgeEngine` class | `core/knowledge-engine/engine/knowledge-engine.ts` interface | Old class becomes one implementation of the new interface once Phase C executes |
| `PipelineContext extends UserContext` | `core/knowledge-engine/pipeline-context.ts` (`extends LifeGraphContext`) | Identity contract upgrade, same as Memory's |
| `ExtractStage` (`UserContext` → raw source) | `ExtractStage` (`RealitySnapshot` → items) | ADR-0013: Knowledge interprets reality, not a single memory |
| `RelateStage` / `RelatedEntityRef` (polymorphic `EntityType`) | `InsightRelationshipStrategy` / `RealityMemoryItem` | Narrower, memory-only relation surface per ADR-0013 |
| `projects`, `goals`, `habits`, `people` (`knowledge.ts`) | Retired | No replacement in this module; see conceptual correction above |
| `insights` (`userId`-scoped) | New `insights`, `life_graph_id`-scoped | Column rename + FK repoint |
| `evidence` (`relations.ts`, polymorphic, `userId`-scoped) | New `evidence`, `memoryId`-only, `life_graph_id`-scoped | Narrower by design |
| — | New `insight_relationships` | No prior equivalent; `entity_relations` is not reused (zero consumers, separate cleanup) |
| `core/knowledge/jobs.ts`, `knowledge_jobs` table, `worker/index.ts` | Untouched through Phase A/B | Live consumers; migrating them is Phase C |

## Phased plan

**Phase A — now.** No behavior change. Both folders coexist; anything
new needing knowledge capabilities is written against
`core/knowledge-engine`'s contracts, never against the old module.

**Phase B — persistence (M3, authorized by ADR-0014 once confirmed).**
Implement `core/knowledge-engine`'s interfaces end to end: a
Drizzle-backed `InsightRepository`, deterministic `ClassifyStage` /
`InsightRelationshipStrategy` / `InsightValidationStrategy`, then the
AI-backed `ExtractStage` and `InsightGenerationStrategy`, then
`DefaultKnowledgeEngine`. Requires a migration for the three new
tables. `core/knowledge`'s live callers (`worker/index.ts`,
`send-message.ts`) are not touched.

**Phase C — cutover (not authorized).** Delete
`core/knowledge/pipeline/`, `knowledge-engine.ts`, `types.ts`, `jobs.ts`
equivalents once replaced; move `core/knowledge-engine/*` to
`core/knowledge/*`; migrate `worker/index.ts` and
`features/chat/services/send-message.ts` to the new engine and
`LifeGraphContext`; repoint or retire `knowledge_jobs.user_id`. Higher
blast radius than Memory's Phase C — this module has live callers
today, Memory's didn't.

**Phase D — verify.** Full-project `tsc`/`eslint`, grep for any
remaining `core/knowledge-engine` or old-schema reference, confirm
zero.

## Non-goals

- Deciding `InsightStatus`'s future lifecycle states (strengthening,
  weakening, replacement, expiration, invalidation) — a domain-model
  change, out of scope here and for M3 (see ADR-0014's architectural
  notes)
- Representing Event Time / Conversation Time / Knowledge Time as
  distinct fields — preserved as a documented distinction, not solved
  (see ADR-0014)
- Any `RealitySnapshot` history or reconstruction mechanism — per
  ADR-0013, `RealitySnapshot` stays current-state-only
- Deciding how `ExtractStage`/`InsightGenerationStrategy` get
  structured output from `AIProvider` (currently
  `generateReply(): Promise<string>` only) — a public-interface
  question requiring its own CTO decision, sequenced last in M3's PR
  order precisely because it's unresolved
- The fate of `entity_relations` (zero consumers, not touched by this
  plan)

## Risks

- Zero validated real-world usage of `core/knowledge-engine`'s
  interface shape — same risk ADR-0012 named for Memory; Phase B may
  surface a missing method once real data is run through it
- Phase C here is strictly riskier than Memory's: `core/knowledge/` has
  two live callers today (`worker/index.ts`,
  `features/chat/services/send-message.ts`), Memory's old module had
  none
- Retiring `projects`/`goals`/`habits`/`people` is safe (zero
  consumers) but does not close `core/life`'s pre-existing gap for
  those entities' persistence — flagged for Founder/CTO awareness, not
  this plan's problem to solve
