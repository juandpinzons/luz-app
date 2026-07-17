# M2 Completion Report — Memory Engine, Phase B

Phase II (Behavior Implementation), Milestone 2. Covers `core/memory-engine`
persistence, orchestration, and the structured half of ADR-0004's hybrid
retrieval — the structured arc of `MEMORY_ENGINE_MIGRATION_PLAN.md`'s
Phase B. Delivered as eleven sequential, individually reviewed PRs
(PR-007 through PR-017). PR-018 through PR-021 (semantic/embeddings
retrieval) remain ahead — deliberately not part of this report.

## Objectives achieved

- Every `core/memory-engine` contract that had zero implementation
  before this milestone — `MemoryRepository`, `MemoryClassifier`,
  `CaptureStage`, `ArchiveStage`, `ForgetStage`, `MemoryRankingStrategy`,
  `ConnectStage`, `MemoryRetrievalStrategy` (structured half),
  `MemoryEngine` — now has a real, tested implementation. Nothing in
  `core/memory-engine` is a stub anymore except the semantic retrieval
  path, which was always sequenced last.
- `DefaultMemoryEngine.capture()` runs the full Capture → Rank →
  Connect sequence exactly as `MEMORY_ENGINE_SPEC.md` orders it,
  verified by execution: call order, rank persistence, and the
  connect step receiving the already-ranked memory were all confirmed
  with fakes, not just asserted.
- The central product-philosophy distinction — **memory type is
  descriptive, memory value is relational** — is now load-bearing in
  the code, not just documentation: `DeterministicMemoryClassifier`
  and `DeterministicMemoryRankingStrategy` never reference each
  other's outputs, verified directly (two same-typed memories scored
  19 and 69; `personId` proven to have zero effect on rank).
- Every deterministic strategy (classifier, ranking, connect) was
  smoke-tested against real invariants before being marked complete —
  same-type/different-value, recency-never-crosses-a-value-tier,
  quality-gated connections with no arbitrary count cap, dedup on
  multi-signal matches — not just compiled and assumed correct.

## Architectural decisions preserved

- **ADR-0004 (Hybrid Memory)**: structured and semantic retrieval
  remain genuinely separate strategy implementations of the same
  `MemoryRetrievalStrategy` contract, as designed. Only the structured
  half exists yet; the contract shape needed zero changes to
  accommodate it.
- **ADR-0012 (Memory Engine Consolidation)**: all M2 work targeted
  `core/memory-engine` exclusively — Phase A's rule ("new work never
  touches the old `core/memory`") was not violated once.
- **Type ≠ value**, established explicitly across three review rounds
  on PR-014: ranking never uses `memory.type`, and — per the final
  refinement — never uses `personId` either. Both were verified absent
  from the scoring logic by execution, not just by reading the code.
- **Memory stays independent of Knowledge**: `pattern` remains
  unclassifiable by `DeterministicMemoryClassifier` (needs cross-memory
  comparison), "recurring struggle" in ranking only detects
  self-*reported* recurrence within one memory's own text, and
  `ConnectStage`'s two signals (same-origin, same-person) are both
  structural facts, never semantic similarity or inferred patterns.
- **No architecture changes.** Every real design tension encountered
  (the LifeGraph↔Person circular reference in M1's precedent, and in
  M2, `MemoryRankingStrategy`'s deliberate statelessness) was resolved
  by adding a collaborator or a small, justified constant — never by
  editing a frozen contract or interface.
- **Soft-delete for forget**, decided in PR-013 exactly as
  `MEMORY_ENGINE_MIGRATION_PLAN.md` left open for Phase B: `forget`
  sets `status: "forgotten"`, never a hard `DELETE`. Content and rank
  survive both archive and forget untouched.

## Files added

- `core/db/schema/memory.ts` (extended, not new) — `memories`,
  `memory_connections` tables, three enums, two check constraints
- `core/db/migrations/0005_add_memories_and_memory_connections.sql`,
  `0006_repoint_memory_embeddings_to_life_graph.sql` (+ matching
  `meta/` snapshots)
- `core/memory-engine/repositories/drizzle-memory.repository.ts` —
  `DrizzleMemoryRepository`
- `core/memory-engine/classification/deterministic-memory-classifier.ts`
  — `DeterministicMemoryClassifier`
- `core/memory-engine/lifecycle/default-capture-stage.ts`,
  `default-archive-stage.ts`, `default-forget-stage.ts`,
  `default-connect-stage.ts`
- `core/memory-engine/ranking/deterministic-memory-ranking-strategy.ts`
  — `DeterministicMemoryRankingStrategy`
- `core/memory-engine/retrieval/structured-memory-retrieval-strategy.ts`
  — `StructuredMemoryRetrievalStrategy`
- `core/memory-engine/engine/default-memory-engine.ts` —
  `DefaultMemoryEngine`, `createMemoryEngine`

## Files modified

- `core/memory-engine/index.ts` — barrel exports for all of the above
- `core/db/migrations/meta/_journal.json` — migration bookkeeping

## Known limitations

- **Semantic retrieval doesn't exist yet.** `MemoryRetrievalStrategy`
  only has the structured (exact-filter) implementation. `query.text`
  is matched by `ILIKE`, not meaning. PR-018–021 are the deliberately
  isolated, sequenced-last remainder of Phase B.
- **`ConnectStage` is O(n) per call.** No repository method exists to
  query "same person" or "same origin" directly — `list()` then
  filter in application code. Correct, not performant at scale. Flagged
  in the PR-016 design review as a future repository-method candidate,
  not solved now.
- **Two `createMemoryEngine` functions coexist** — the dead one in
  `core/memory/memory-engine.ts` (Phase A's old module, zero
  consumers, unchanged by M2) and the new canonical one in
  `core/memory-engine/engine/default-memory-engine.ts`. No compile
  conflict since nothing imports both, but this is exactly the
  contributor-confusion risk ADR-0012 named as the reason Phase C
  (cutover, deleting `core/memory/`) needs to happen — not yet
  authorized, same as Phase B was gated until this milestone.
- **Deterministic keyword matching has known, accepted blind spots** —
  documented at each PR (classifier, ranking, connect): rigid phrasing,
  language limited to the ES/EN samples written, no synonym or
  paraphrase detection. This is Phase B's stated ceiling, not a defect
  — "correct and reliable, not yet intelligent."
- **Nothing in M2 is wired into `features/chat`.** Every class built
  in this milestone is real and tested but uncalled from the live
  application, same posture M1 held throughout — consuming Memory in
  conversation is a distinct, later decision.
- **Migrations 0005/0006 are unapplied** — generated and schema-verified,
  not run against a live database (none available in this
  environment), same caveat as M1's report.

## Future extension points

- `ConnectStage`'s structural-match design was built to add a third
  detector (shared `GoalId`/`ProjectId`/`HabitId`) without a rewrite —
  each signal is an independent function merged by strongest match.
  Not usable yet: `Memory` has no such fields today: this is a schema
  question for whoever picks it up.
- `MIN_SCORE_WITH_UNDERSTANDING_SIGNAL`, exported from the ranking
  strategy, is now the shared quality bar between ranking and
  connecting. Any future stage needing "is this memory revelatory
  enough to act on" has a principled constant to reuse instead of
  inventing a new threshold.
- Swapping any of the three deterministic strategies (classifier,
  ranking, connect) for an LLM-based or embeddings-based
  implementation later requires writing one new class per contract —
  none of the three interfaces changed shape to accommodate the
  deterministic versions.

## Technical debt

- The `core/memory` vs `core/memory-engine` duplication (see "Two
  `createMemoryEngine` functions," above) — inherited from before M2,
  not created by it, but M2 is the milestone that makes the dead
  module's continued presence actively confusing rather than merely
  unused.
- No test suite exists yet for any of these classes — every
  verification in this milestone was an ad hoc smoke test run once
  during implementation, not a committed, repeatable test file. Real
  but consistent with M1's precedent; flagging it rather than treating
  it as resolved.

## Blockers

None encountered. Every design tension surfaced during
implementation (the ranking/connect philosophy refinements, the
rank-persistence gap in the orchestrator, the drizzle-kit interactive
rename prompt in PR-008) was resolved within Architecture V1 as
frozen, without requiring escalation.
