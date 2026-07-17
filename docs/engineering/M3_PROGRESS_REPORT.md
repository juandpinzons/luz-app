# M3 Progress Report

Milestone 3 — Knowledge Engine, Phase B. Status: planning and PR-1
complete, PR-2 not yet started. No code has been written.

## Completed

- M3 objectives, 10-PR breakdown, dependency graph, risks, and
  assumptions defined and Founder-approved.
- `docs/product/HUMAN_EXPERIENCE_DATASET_V1.md` incorporated as a
  permanent reference document (same tier as Architecture V1 and the
  ADRs) — evaluation philosophy, not a feature spec, not training data.
  (Note: an identical, untracked duplicate also sits at
  `docs/research/HUMAN_EXPERIENCE_DATASET_V1.md` — unresolved, low
  priority, flagged not fixed.)
- Nine permanent architectural principles adopted for every LUZ engine
  (not just Knowledge): evolving-capability language over
  limitation-language; Knowledge interprets lives, not conversations;
  every Insight must be explainable; Knowledge is probabilistic;
  multiple time dimensions exist (Event/Conversation/Knowledge Time);
  `RealitySnapshot` is current-state-only, never a history log; privacy
  is an architectural invariant (no cross-LifeGraph access, ever); the
  LLM is a replaceable reasoning component; every PR description must
  end with a "Human Experience Impact" section.
- **PR-1 drafted** (files written, uncommitted):
  `docs/adr/ADR-0014_KNOWLEDGE_ENGINE_CONSOLIDATION.md`,
  `docs/architecture/KNOWLEDGE_ENGINE_MIGRATION_PLAN.md`, and an
  index update to `docs/adr/README.md`.
- Repo-wide grep verification (same discipline ADR-0012 used):
  `projects`/`goals`/`habits`/`people`
  (`core/db/schema/knowledge.ts`) and `entity_relations`
  (`relations.ts`) have **zero consumers**; `insights`/`evidence`/
  `knowledge_jobs` are **live**, consumed by `worker/index.ts` and
  `core/knowledge/`.

## Approved Decisions

- M3 = Knowledge Engine "Phase B," the same role M2 played for Memory
  under ADR-0012's phased-plan template.
- The 10-PR breakdown and dependency order stand as planned.
- The nine architectural principles are permanent and apply to every
  future engine, not scoped to M3.
- Human Experience Dataset V1 is evaluation-only: never consulted at
  runtime, never enriches a real user's `LifeGraph`.

## Pending PRs

**PR-1** — ADR-0014 + migration plan: drafted, **awaiting CTO
confirmation** (currently `Status: Proposed`, not `Accepted`).

In order, not yet started:

1. **PR-2** — `DeterministicClassifyStage`
2. **PR-3** — `DeterministicInsightValidationStrategy`
3. **PR-4** — `StructuralInsightRelationshipStrategy`
4. **PR-5** — Knowledge Engine DB schema + migration (blocked on PR-1
   confirmation)
5. **PR-6** — `DrizzleInsightRepository` (depends on PR-5)
6. **PR-7** — `DefaultPersistStage` (depends on PR-6)
7. *(gate)* — AIProvider structured-output decision (escalation, not a
   PR)
8. **PR-8** — `ExtractStage` implementation (depends on gate)
9. **PR-9** — `InsightGenerationStrategy` implementation (depends on
   gate)
10. **PR-10** — `DefaultKnowledgeEngine` + factory (depends on all
    above)

PR-2/3/4 have no dependency on PR-1's confirmation and can proceed in
parallel with it.

## Architectural Observations

Discoveries made during planning, intentionally deferred, documented
(not implemented) in ADR-0014:

- **Time has multiple dimensions** (Event / Conversation / Knowledge
  Time) — distinct concepts, no schema change made to represent this.
- **Knowledge is probabilistic** — `InsightStatus` is a one-way gate
  today; strengthening/weakening/replacement/expiration/invalidation is
  a future domain-model change requiring CTO escalation, not decided
  here.
- **`RealitySnapshot` stays current-state-only** — no history
  persistence; reconstruction, if ever needed, derives from persisted
  evidence/memories/insights, not from stored snapshots.
- **`core/life` has no Drizzle repositories yet** for
  `Goal`/`Project`/`Habit`/`Relationship` — a pre-existing gap that
  ADR-0014 surfaces (by retiring the dead `knowledge.ts` tables that
  were standing in for them) but does not close.
- **`AIProvider` has no structured-output contract** —
  `generateReply(): Promise<string>` only. Blocks PR-8/PR-9 until
  resolved; deliberately sequenced last so the rest of the milestone
  isn't blocked by it.

## Risks

- **ADR-0014 is unconfirmed.** PR-5 (schema) cannot start until it is
  accepted.
- **Single-entrypoint pipeline.** Unlike Memory's four independent
  public methods, `KnowledgeEngine.run()` needs all six stages real
  before it's callable end-to-end — the AI-backed half (PR-8/PR-9)
  can't be deferred indefinitely the way M2 deferred semantic
  retrieval.
- **Phase C (future cutover) has a higher blast radius than Memory's**
  — `core/knowledge/` has two live callers (`worker/index.ts`,
  `features/chat/services/send-message.ts`); `core/memory/` had none.
- **No test suite exists** for `core/memory-engine` or
  `core/knowledge-engine` — inherited from M1/M2, not created by M3,
  but not yet addressed either.
- **Zero real-world validation** of `core/knowledge-engine`'s interface
  shapes — same risk ADR-0012 named for Memory before M2 began.

## Next Session

Begin **PR-2** — implement `DeterministicClassifyStage`
(`core/knowledge-engine/lifecycle/`). No dependency on PR-1's
confirmation; can start immediately.
