# Memory Engine Migration Plan

Version: 1.0\
Status: Accepted — frozen (proposal only, not authorized to execute)\
Related: ADR-0012, core/memory-engine, core/memory

## Purpose

Retire the parallel `core/memory/` and `core/memory-engine/` modules
into a single canonical `core/memory/`, without leaving dead code or
silently dropping capability. This document is the mapping and the
phasing — not a green light to execute it.

## Current state

`core/memory/` (Drizzle-coupled):
- `memory-engine.ts` — `MemoryEngine` class, `recall()` combines a
  structured snapshot with an optional semantic search
- `structured/structured-memory.repository.ts` —
  `DrizzleStructuredMemoryRepository`, reads `projects`/`goals`/
  `habits`/`people` tables directly
- `semantic/semantic-memory.repository.ts` —
  `NotImplementedSemanticMemoryRepository`, throws until embeddings
  exist
- `core/db/schema/memory.ts` — `memoryEmbeddings` table (pgvector),
  structure ready, `embedding` column nullable, generation not
  implemented

`core/memory-engine/` (pure domain, Milestone 3): entities, value
objects, repository/lifecycle/ranking/retrieval/classification
interfaces, engine contracts, events. No implementation.

**Verified by repo-wide grep: nothing outside `core/memory/` itself
imports from it.** `createMemoryEngine`/`MemoryEngine` are unused
today — no live caller to break.

## The one conceptual correction

`StructuredMemoryRepository.getSnapshot()` returns projects, goals,
habits, and people — but under Architecture V1 (ADR-0011,
`DOMAIN_MODEL_V1.md`), those are Life Graph entities, not Memory.
"Structured memory" was, in effect, an early approximation of what
`core/life`'s repositories now do properly, scoped by `lifeGraphId`
instead of read ad hoc from typed tables. This migration is not a
rename of that repository — it's a retirement, with its actual
responsibility already covered by Milestone 1.

Memory's real, permanent job is the "semantic" half: evidence
retrieved by meaning, not exact structure. That's what
`core/memory-engine/retrieval/memory-retrieval-strategy.ts` formalizes.

## Mapping

| Old (`core/memory/`) | New home | Notes |
|---|---|---|
| `MemoryEngine` class | `core/memory-engine/engine/memory-engine.ts` interface | Old class becomes one implementation of the new interface once persistence is authorized |
| `MemoryEngine.recall()` | Split in two | Structured half → call `core/life`'s `GoalRepository`/`HabitRepository`/`PersonRepository`/`ProjectRepository` directly; semantic/evidence half → `MemoryEngine.retrieve()` |
| `StructuredMemoryRepository` / `DrizzleStructuredMemoryRepository` | Retired | No replacement type — callers assemble what they need from individual `core/life` repositories |
| `StructuredMemorySnapshot` | Retired | Same reasoning |
| `SemanticMemoryRepository` / `NotImplementedSemanticMemoryRepository` | `core/memory-engine/retrieval/memory-retrieval-strategy.ts` | A semantic `MemoryRetrievalStrategy` implementation is the direct successor |
| `core/db/schema/memory.ts` (`memoryEmbeddings`) | Kept, adapted | Already close to what a semantic retrieval implementation needs to persist; `userId` column repoints to `lifeGraphId` |
| `core/memory/structured/`, `core/memory/semantic/` folders | Deleted at cutover | |
| `core/memory-engine/*` | Moved into `core/memory/`, replacing its current contents | The rename that makes Memory Engine canonical |

## Phased plan

**Phase A — now.** No behavior change. Both folders coexist; anything
new that needs memory capabilities is written against
`core/memory-engine`'s contracts, never against the old repository.

**Phase B — persistence (not yet authorized).** Implement
`core/memory-engine`'s interfaces: a Drizzle-backed `MemoryRepository`,
a semantic `MemoryRetrievalStrategy` over `memoryEmbeddings`, and
concrete ranking/classification strategies. Requires its own migration
for `memory_embeddings.user_id` → `life_graph_id`.

**Phase C — cutover.** Delete `core/memory/structured/`,
`core/memory/semantic/`, and `core/memory/memory-engine.ts`. Move
`core/memory-engine/*` to `core/memory/*`. Update the one import path
(`core/memory-engine` → `core/memory`) anywhere it was used during
Phase A/B.

**Phase D — verify.** Full-project `tsc`/`eslint`, grep for any
remaining `core/memory-engine` reference, confirm zero.

## Non-goals

- Deciding the embeddings model or vector dimensions (already fixed at
  1536 in `core/db/schema/memory.ts`, unrelated to this migration)
- Deciding whether `forget` hard-deletes or soft-marks
  `status: "forgotten"` — a Phase B implementation decision
- Any change to `core/knowledge`, which already treats Memory as an
  opaque upstream dependency and needs no changes for this migration

## Risks

- Zero current consumers means this module's interface shape hasn't
  been validated against real usage — Phase B implementation may
  surface a missing method that only becomes obvious when someone
  tries to wire `features/chat` to real memory recall.
- The structured/semantic split is a judgment call made without a
  working retrieval implementation to test it against — flagged in
  ADR-0012 as the thing most likely to need revisiting.
