# ADR-0012 Memory Engine Consolidation

Status: Accepted
Date: July 2026
Owner: CTO

## Context

Milestone 3 built `core/memory-engine/` as a pure-domain contract set,
kept deliberately separate from the existing `core/memory/`
(structured memory backed directly by Drizzle, semantic memory a
`NotImplemented` stub). Two modules answering to "memory" is acceptable
short-term staging, not a long-term shape.

## Decision

`core/memory-engine/` becomes the canonical `core/memory/`. There will
be exactly one Memory module once migration completes — no duplicate
folders, no parallel contracts.

The migration is not a straight rename. `core/memory/`'s current
"structured memory" (typed snapshots of projects/goals/habits/people)
is, under Architecture V1, actually Life Graph state — it belongs to
`core/life`'s repositories (Milestone 1), not to Memory. Only the
"semantic" half (evidence retrieved by meaning, not exact structure)
maps onto the new `MemoryEngine.retrieve()`. See
`docs/architecture/MEMORY_ENGINE_MIGRATION_PLAN.md` for the full
mapping and phased plan.

Migration is not authorized to begin yet — this ADR records the
decision and target shape, not a green light to implement it.

## Consequences

### Positive

- Single source of truth for "memory" in the codebase, closing the
  Milestone 3 risk of contributor confusion between two same-named
  modules
- Forces an explicit, documented split between Life Graph state and
  Memory evidence, rather than leaving that conflation live in
  `StructuredMemorySnapshot`
- Zero current consumers of `core/memory/`'s engine (verified by
  repo-wide grep) — the lowest-risk possible moment to make this change

### Trade-offs

- `StructuredMemoryRepository` and `StructuredMemorySnapshot` are
  retired outright, not migrated — any future caller needs to compose
  the equivalent view from multiple `core/life` repositories instead
  of one call
- `core/db/schema/memory.ts` (`memory_embeddings`) needs a real schema
  migration (repoint `userId` → `lifeGraphId`) once persistence lands

### Future

Execute the migration plan once a persistence milestone is authorized.
Review this ADR if the structured/semantic split turns out to be
wrong in practice once real retrieval strategies are implemented.

## Related

- ADR-0004 Hybrid Memory
- ADR-0011 Identity Architecture
- docs/architecture/MEMORY_ENGINE_MIGRATION_PLAN.md
