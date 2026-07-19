# ADR-0014 Knowledge Engine Consolidation

Status: Proposed — awaiting Founder confirmation\
Date: July 2026\
Owner: Founder

## Context

`core/knowledge-engine/` exists today as a pure-domain contract set —
entities, value objects, a repository interface, six lifecycle/strategy
interfaces, an engine interface, three events — with zero
implementation. It was kept deliberately separate from the existing
`core/knowledge/` (`UserContext`/`userId`-scoped, wired into
`worker/index.ts` and `features/chat/services/send-message.ts`, one
real `DrizzlePersistStage` and five `NotImplemented` stages). This is
the same staging pattern ADR-0012 named for Memory: two modules
answering to "knowledge" is acceptable short-term coexistence, not a
long-term shape.

`core/db/schema/knowledge.ts` also repeats the conceptual error
ADR-0012 found in `memory.ts`'s structured half: it holds `projects`,
`goals`, `habits`, and `people` tables, which under Architecture V1
(`DOMAIN_MODEL_V1.md`) are Life Graph entities, not Knowledge — already
Milestone 1's responsibility, not this module's. Repo-wide grep
confirms zero consumers of these four tables anywhere in the codebase.

Unlike Memory's `core/memory/`, the legacy `core/knowledge/` **is
live**: `worker/index.ts` imports `createKnowledgeEngine` from it, and
`features/chat/services/send-message.ts` imports `enqueueKnowledgeJob`
from `core/knowledge/jobs.ts`. This ADR's cutover phase therefore
carries a strictly higher blast radius than Memory's still-pending
Phase C.

## Decision

`core/knowledge-engine/` becomes the canonical `core/knowledge/`.
There will be exactly one Knowledge module once migration completes —
no duplicate folders, no parallel contracts. As with ADR-0012, this
ADR records the decision and target shape; it does not authorize
executing the cutover (Phase C, below).

The migration is not a straight rename:

| Old | New home | Notes |
|---|---|---|
| `projects`, `goals`, `habits`, `people` (`knowledge.ts`) | Retired, no replacement in this module | Life Graph state under Architecture V1; belongs to `core/life`, which — as of this writing — has no Drizzle-backed repository yet for these four entities either (only `LifeGraph` and `Person` do). That gap pre-exists this ADR and isn't created by it; retiring these tables removes no working capability (zero consumers), but it also leaves no interim replacement. Flagging for Founder awareness, not solving here. |
| `insights` (`knowledge.ts`, `userId`-scoped) | New `insights` table, `life_graph_id`-scoped, matching `core/knowledge-engine/entities/insight.ts` | Same treatment `memory_embeddings.user_id` got in ADR-0012 |
| `evidence` (`relations.ts`, polymorphic `sourceType`/`sourceId`, `userId`-scoped) | New `evidence` table, `memoryId`-only, `life_graph_id`-scoped, matching `core/knowledge-engine/entities/evidence.ts` | Narrower by design — ADR-0013 already restricted `Evidence.memoryId` to a single `EntityId`; the polymorphic shape isn't needed |
| — (no prior equivalent) | New `insight_relationships` table, matching `core/knowledge-engine/entities/insight-relationship.ts` | Insight-to-insight only |
| `entity_relations` (`relations.ts`) | Untouched, out of scope | Zero consumers anywhere — not even the legacy pipeline uses it. A separate, pre-existing dead table; flagged for a future cleanup decision, not part of this ADR |
| `knowledge_jobs`, `core/knowledge/jobs.ts`, `core/knowledge/knowledge-engine.ts`, `core/knowledge/pipeline/*`, `worker/index.ts`, `features/chat/services/send-message.ts` | Untouched through Phase A/B | Live consumers — cutover is Phase C, its own future milestone |

## Phased plan

**Phase A — now.** No behavior change. Both folders coexist; anything
new that needs knowledge capabilities is written against
`core/knowledge-engine`'s contracts, never against the old module.

**Phase B — persistence (this ADR authorizes M3 to execute this).**
Implement `core/knowledge-engine`'s interfaces: a Drizzle-backed
`InsightRepository`, deterministic `ClassifyStage`/
`InsightValidationStrategy`/`InsightRelationshipStrategy`
implementations, then the AI-backed `ExtractStage` and
`InsightGenerationStrategy`, then `DefaultKnowledgeEngine`. Requires
its own migration for the three new tables above.

**Phase C — cutover (not authorized).** Retire
`core/knowledge/structured` equivalents (`pipeline/`,
`knowledge-engine.ts`, `types.ts`), move `core/knowledge-engine/*` to
`core/knowledge/*`, migrate `worker/index.ts` and
`features/chat/services/send-message.ts` to the new engine and
`LifeGraphContext`, retire the old `insights`/`evidence` tables and
`knowledge_jobs`'s `userId` column in favor of `life_graph_id`.

**Phase D — verify.** Full-project `tsc`/`eslint`, grep for any
remaining `core/knowledge-engine` or old-schema reference, confirm
zero.

## Consequences

### Positive

- Single source of truth for "knowledge" in the codebase, same benefit
  ADR-0012 delivered for Memory
- Forces the same explicit split ADR-0012 made for Memory: Life Graph
  state stays in `core/life`, Knowledge stays evidence-and-meaning only
- `insights`/`evidence`/`insight_relationships` become `life_graph_id`-
  scoped from creation — no repository method in
  `core/knowledge-engine/repositories/insight.repository.ts` accepts
  anything but a `LifeGraphContext`, so no implementation written
  against it can accidentally cross a tenant boundary (Human Experience
  Dataset principle 7 — every LifeGraph is isolated by construction,
  not by convention)

### Trade-offs

- `projects`/`goals`/`habits`/`people` retirement is safe today (zero
  consumers) but doesn't fill `core/life`'s pre-existing persistence
  gap for those four entities — a separate, already-existing risk this
  ADR surfaces rather than creates
- Phase C's blast radius is real (two live consumers), unlike Memory's
  zero-consumer Phase C — future authorization for Phase C should
  budget for that difference explicitly

### Future

Execute Phase B once this ADR is confirmed. Phase C requires its own
future authorization, same gating Memory's Phase C still has.

## Architectural notes for future milestones

Carried forward per the Founder's standing principles (2026-07-16),
documented here rather than solved:

- **Time has multiple dimensions.** Event Time (when something
  happened), Conversation Time (when the user told LUZ), and Knowledge
  Time (when LUZ became capable of understanding it) are conceptually
  distinct. The schema introduced by this ADR uses one timestamp family
  per table (`createdAt`, `occurredAt`) and does not attempt to
  represent this distinction. Not solved here — preserved as future
  architectural knowledge.
- **Knowledge is probabilistic.** `InsightStatus`
  (`proposed`/`validated`/`rejected`) is a one-way gate today. A living
  person's insights should eventually support strengthening, weakening,
  replacement, expiration, and invalidation, not just a single
  validate-or-reject moment. Changing `InsightStatus`/`Insight`'s shape
  is a domain-model change (`12_DECISION_BOUNDARIES.md`) — explicitly
  out of scope for this ADR and for M3.
- **RealitySnapshot stays current-state-only.** Per ADR-0013,
  `RealitySnapshot` is a point-in-time read, not historical storage. If
  historical reconstruction is ever needed, it should be derived from
  persisted evidence, memories, relationships, and validated insights —
  never from persisting arbitrary snapshots. This ADR makes no change
  to `core/reality`.
- **The LLM remains a reasoning component, not the intelligence
  itself.** `InsightGenerationStrategy` and `ExtractStage` stay
  swappable strategies behind `core/knowledge-engine`'s contracts. No
  implementation written against this ADR's schema should import an LLM
  SDK directly.
- **Explainability is already structural, not additive.** `Insight`
  always carries `confidence` (with `assignedAt`) and is never created
  without it; `Evidence` always points `insightId → memoryId`. An
  implementation built on this schema can already answer "why do you
  believe this / what evidence / how confident" without any shape
  change — this ADR confirms that, it doesn't need to add anything for
  it to be true.

## Related

- ADR-0004 Hybrid Memory
- ADR-0008 Reality Model
- ADR-0011 Identity Architecture
- ADR-0012 Memory Engine Consolidation
- ADR-0013 Reality Snapshot Contract
- `docs/architecture/KNOWLEDGE_ENGINE_MIGRATION_PLAN.md`
- `docs/product/HUMAN_EXPERIENCE_DATASET_V1.md`
