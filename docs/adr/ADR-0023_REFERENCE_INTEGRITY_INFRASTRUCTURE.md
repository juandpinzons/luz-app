# ADR-0023 Reference Integrity Infrastructure

Status: Accepted\
Date: August 2026\
Owner: Founder

## Context

LUZ's schema has 15 reference points, across 13 tables, that are not
real Postgres foreign keys — 9 are polymorphic `type`+`id` pairs
(`entityType`/`entityId`, `sourceType`/`sourceId`, `refType`/`refId`),
structurally impossible to express as an FK since Postgres has no
constraint whose target table varies by another column's value; 6 are
single "bare" id columns deliberately left without an FK so the column
can evolve without a migration. Before this module: zero validation of
any of them, at runtime or in the database — no `CHECK constraint`
ties a `type` value to a closed vocabulary, and `EntityType` exists
only as a TypeScript annotation, never verified once code runs.

The module was built 2026-07-31 but never committed — found sitting
untracked in the working tree three days later (2026-08-02), during an
unrelated session close-out, after surviving many intervening commits
from concurrent sessions without being lost or overwritten. Founder's
instruction on finding it: review it for real (15–20 minutes, not a
glance), then commit it with an ADR if it holds value, or delete it —
explicitly not leave it indefinitely uncommitted.

Review performed this session: read all 957 lines across 20 files:
confirmed zero consumers anywhere in `app/`, `features/`, `core/`,
`worker/`, `smoke/` (purely additive, nothing currently depends on
it); confirmed `core/` dependency purity (every import resolves to
`core/db/client`, `drizzle-orm`, or the module itself — nothing from
`features/`); ran `tsc --noEmit` and `eslint` against it, both clean;
cross-checked its 5 recommended index additions against the
already-shipped Index Optimization audit (2026-07-31, commit
`c9bc045`) for duplication — none found, all 5 are genuinely new
findings.

## Decision

Accept and commit `core/reference-integrity/` as-is: a read-only
audit/repair toolkit for LUZ's polymorphic and bare reference columns.

What it provides:

- `registry/` — a declarative inventory of all 15 reference points,
  each backed by real code evidence rather than theory. Surfaces two
  findings that were previously undocumented anywhere: (a) `EntityType`
  is ambiguous between legacy tables (`entity_relations`/`evidence`,
  scoped by `userId`) and current tables (`memory_embeddings`/
  `knowledge_jobs`, scoped by `lifeGraphId`) — the same type value
  resolves to a different destination table depending on which column
  it came from; (b) three separate "type" vocabularies (`EntityType`,
  `importance_scores`'s own, `contradictions`'s own) collide on shared
  values like `"insight"` without ever being reconciled.
- `integrity/` — `runIntegrityCheck`/`findAllOrphans`, batch-queried
  (never N+1, the same discipline Graph Performance Phase I
  established), returning a three-way honest result per row — healthy,
  orphan, or unsupported (a target this module cannot verify yet) —
  never collapsing "unsupported" into a false healthy or false orphan.
- `validators/` — `validateBareReference`/`validatePolymorphicReference`,
  write-guards that throw `ReferenceValidationError` instead of
  silently accepting a dangling reference. Not called from any
  repository yet — deliberately.
- `repair/` — `buildRepairPlan` (pure, deterministic, no I/O) and
  `executeRepairPlan` (the only mutating function in the module;
  requires an explicit `{ confirm: true }`, runs inside a single
  transaction, batch-deletes/nullifies by reference point). Verified
  against local Postgres with a deliberately inserted orphan; never run
  with `confirm: true` against any shared or production database.

What this ADR explicitly does **not** authorize — each is a separate
future decision, gated the same way every other piece of infrastructure
work has been gated this session:

- Running `executeRepairPlan` against the 26 real orphans this module
  found in local dev (`contradictions.left`/`.right` 1 each,
  `knowledge_engine_reasoning_evidence.ref` 2, `belief_evidence.insightId`/
  `.memoryId` 4 each, `concept_evidence.insightId`/`.memoryId` 6 each,
  `knowledge_engine_evidence.memoryId` 2), or against production. They
  stay exactly as they are.
- Wiring either validator into any live write path.
- Adding the 5 recommended indexes (`evidence_source_idx`,
  `knowledge_jobs_source_idx`, `beliefs_subject_person_id_idx`,
  `belief_evidence_memory_id_idx`, `concept_evidence_memory_id_idx`) to
  a migration.
- Reconciling the three colliding "type" vocabularies, or the
  legacy-vs-current `EntityType` ambiguity — both are now documented,
  neither is fixed; either is a real data-model change.
- Cross-tenant verification. The module confirms an id exists, never
  that it belongs to the same LifeGraph/user as the row referencing it.
  `ReferenceTarget.scopeColumn` exists in the type for this, unused by
  any checker today.

## Consequences

### Positive

- Closes a gap the module itself measured as exactly zero beforehand —
  no runtime or database-level validation existed for any of these 15
  reference points.
- Zero risk to merge: no consumers, no schema changes, nothing wired
  into an existing flow. Purely additive.
- Surfaces two real architectural findings (the `EntityType` ambiguity,
  the three-way type-vocabulary collision) that were previously
  undocumented anywhere in the codebase.
- Gives any future decision to repair the 26 known orphans, add the 5
  indexes, or wire validation into write paths a tested, reviewed
  starting point instead of a from-scratch build.

### Trade-offs

- Built and left uncommitted for roughly two days before being found —
  nearly lost to no fault of the code itself. Not a process failure
  specific to this module, but a reminder that finished work only
  persists once it's committed; an untracked directory has no
  protection against a lost session or an accidental `clean`.
- Ships with known, documented gaps (tenancy-crossing, vocabulary
  reconciliation) rather than a complete solution. Accepted
  deliberately — closing either would be a real data-model change, out
  of scope for this pass.

### Future

- Repairing the 26 real orphans, adding the 5 indexes, and wiring
  validators into write paths are each their own future decision, not
  pre-approved by this ADR.
- Reconciling the three "type" vocabularies is a data-model change and
  needs its own investigation under
  `TECHNICAL_INVESTIGATION_METHODOLOGY_V1.md` before a design, the same
  standard ADR-0022 was held to.

## Related

- ADR-0018 Architecture V1 Frozen — this is audit/tooling
  infrastructure, not a new engine; no amendment needed.
- Graph Performance Phase I (2026-07-29) and the Index Optimization
  audit (2026-07-31, commit `c9bc045`) — same batch-query discipline
  this module follows; its 5 recommended indexes were cross-checked
  against that work and don't duplicate it.
- `core/reference-integrity/README.md` — full inventory, findings, and
  verification detail.
