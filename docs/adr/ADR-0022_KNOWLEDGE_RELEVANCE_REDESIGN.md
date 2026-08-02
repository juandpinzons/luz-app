# ADR-0022 Knowledge Relevance Redesign

Status: Proposed — awaiting Founder review\
Date: 2026-08-02 (Revision 3 — architecture/policy separation pass)\
Owner: Founder (decision), LEOS (proposal)\
Depends on evidence from:
`docs/engineering/investigations/2026-08-02_knowledge_engine_memory_rank_score.md`,
`docs/engineering/investigations/2026-08-02_pipeline_loss_before_ranking.md`,
`docs/engineering/investigations/2026-08-02_knowledge_job_to_insight_conversion.md`
— all three read as prerequisites; this document does not re-derive
their evidence, only designs against it.\
**Nothing in this document has been implemented.** This is a proposal
per `docs/legal/AI_DEVELOPMENT_POLICY.md`'s lifecycle — it moves to
Accepted only on the Founder's explicit decision.

**Revision 3 note:** Revisions 1 and 2 mixed architecture with policy
— a fixed budget number, a fixed list of categories, fixed validation
thresholds. Numbers and lists like that are expected to change as real
data comes in; an ADR that has to be re-opened every time a category
gets added or a budget gets retuned is not a stable record of anything.
This revision removes every value of that kind, keeps only what
should still be true years from now regardless of what the numbers
say this quarter, and states explicitly, in its own section, where
each removed value now belongs. Nothing about the design changed —
only what kind of document is allowed to hold which kind of fact.

---

## 0. Mission

**Knowledge Engine turns memories that reveal something durable about
who a person is into structured, evolving knowledge** — Insights
backed by real evidence, Beliefs consolidated from repeated Insights,
Concepts and Contradictions connecting them. It is not a summarizer of
everything a person says, and it is not a second copy of Memory
Engine's job (Memory Engine already remembers the conversation itself,
completely and unconditionally — Invariant 1).

Selectivity is a permanent, intentional feature of Knowledge Engine,
not a defect this ADR removes. Processing every memory through an
attention-costing pipeline has real, unbounded cost at scale; some
mechanism must always decide what's worth that cost. What this ADR
fixes is that the current mechanism answers three different questions
with one signal, and one of those answers is wrong far more often than
right. Success for this design is never "every memory becomes an
insight" — it is "the selection mechanism's error rate is measured,
bounded, and owned by the right part of the system," permanently, not
just today's number.

---

## 1. Ownership

```
┌───────────────────────────┐         ┌────────────────────────────────┐
│        Memory Engine         │         │        Knowledge Engine           │
│                              │         │                                    │
│  Memory entity                │◄────────│  reads Memory (type only)           │
│  Classification                │         │  Eligibility decision (§3)          │
│  rank_score (relevance)        │         │  Extract → Classify → Relate →      │
│  Capture/Connect/Archive/       │         │  Generate → Validate → Persist      │
│  Forget lifecycle               │         │  Insight/Belief/Concept/             │
│                              │         │  Contradiction                      │
└───────────────────────────┘         └────────────────────────────────┘
              ▲                                        ▲
              │                                        │
              └────────────────┬───────────────────────┘
                                │
                      Orchestration layer
              (today: features/chat/services/send-message.ts;
               any future caller follows the same rule)
```

**Rules, both directions enforced:**

- Memory Engine (`core/memory-engine`) never imports from Knowledge
  Engine (`core/knowledge-engine`). It has no concept of eligibility,
  insights, or jobs — only of memories and their own intrinsic
  properties.
- Knowledge Engine may depend on Memory Engine's public types
  (`Memory`, read access via `MemoryRepository`) but never reaches
  into Memory Engine's internals or triggers Memory Engine behavior.
- **Eligibility (§3) is Knowledge Engine's decision about itself, not
  a property of the Memory.** It lives at
  `core/knowledge-engine/eligibility/` — this is why it is a separate
  contract from `rank_score` (a Memory Engine field) rather than an
  extension of it.
- The **orchestration layer** — never either engine — is the only code
  permitted to know about both and call them in sequence. Neither
  engine calls the other directly, now or in any future extension of
  this design.

This applies ADR-0002 (Domain Isolation)'s existing one-directional
dependency rule to a boundary that was previously blurred —
`rank_score`, a Memory Engine field, was being read by Knowledge
Engine as if it were Knowledge Engine's own decision.

---

## 2. Contracts

Interfaces only. No implementation, no concrete values — every type
below is intended to still be correct after the mechanism behind it
has changed completely.

### 2.1 Eligibility

```ts
// core/knowledge-engine/eligibility/eligibility-strategy.ts

/**
 * Opaque identifier from the maintained eligibility taxonomy.
 * The taxonomy itself — its members, their definitions, how one gets
 * added or retired — is domain documentation, not part of this
 * contract. See §5 ("What this ADR does not decide").
 */
export type EligibilityCategory = string;

export type EligibilityMethod = "primary" | "secondary";

export interface EligibilityVerdict {
  /** Derived, never set independently of `categories`: true iff categories.length > 0. */
  readonly eligible: boolean;
  /** Every category that applied. Empty, never null/undefined, when nothing matched. */
  readonly categories: readonly EligibilityCategory[];
  /** Which strategy produced this verdict — for audit trails, never for branching logic. */
  readonly method: EligibilityMethod;
  readonly decidedAt: Date;
}

export interface KnowledgeEligibilityStrategy {
  evaluate(
    context: LifeGraphContext,
    memory: Memory,
  ): Promise<EligibilityVerdict>;
}
```

A verdict cannot report `eligible: true` with an empty `categories`
array — the type itself prevents the failure this ADR exists to fix
(a gate detached from any inspectable reason). This is the permanent
part of the design: eligibility is a **named, categorical decision**,
never a bare boolean and never a numeric score with a threshold
someone has to remember. Any future strategy — regardless of internal
mechanism — implements this same interface; no caller ever depends on
a concrete class.

### 2.2 Resource bound

```ts
// core/knowledge-engine/eligibility/eligibility-budget.ts

export interface EligibilityBudget {
  readonly maxEvaluationsPerPeriod: number;
  readonly periodMs: number;
}
```

The shape of a bound, not its value. Every non-primary
`KnowledgeEligibilityStrategy` invocation path is called through a
budget of this shape (Invariant 7) — enforced by the caller, never by
the strategy itself, so the same strategy implementation stays valid
under a different budget later without any code change.

---

## 3. Invariants

Hold regardless of implementation choice, regardless of what values
populate the contracts in §2, and regardless of how many years pass.
A change that requires violating one of these is a new ADR, not an
extension of this one.

- **INV-1 (Memory completeness).** Every user message becomes exactly
  one `Memory`, unconditionally, synchronously, regardless of content.
- **INV-2 (Hot-path AI-free).** No step inside `MemoryEngine.capture()`'s
  synchronous call graph makes an external network/AI call.
- **INV-3 (Single-purpose gates).** No single score or decision
  governs two consumers whose acceptable-error-rate or cost profile
  differ, without an explicit, separately-named, separately-owned
  decision per consumer. This is the standing rule the rest of this
  design exists to satisfy.
- **INV-4 (Triggered-memory guarantee).** A memory passed as
  `focusMemoryId` into `assembleRealitySnapshot` is always present in
  `snapshot.memory.items`, regardless of any relevance or eligibility
  filter applied to other candidates in that snapshot.
- **INV-5 (Async isolation).** Knowledge Engine processing — Extract
  through Persist, and any eligibility evaluation beyond the primary
  synchronous check — never executes inside a request/response cycle
  a user is waiting on.
- **INV-6 (Idempotent evaluation).** Re-evaluating a memory's
  eligibility, or re-running Extract/Generate/Validate for a memory,
  never creates duplicate evidence, duplicate insights, or inflates
  confidence without genuinely new evidence.
- **INV-7 (Bounded resource consumption).** Any eligibility strategy
  beyond the primary, free, synchronous one operates within an
  explicit, enforced, per-period bound (§2.2) — never unconditionally,
  regardless of mechanism or the bound's actual value.
- **INV-8 (Deterministic primary path).** The primary eligibility
  decision — the one gating real-time enqueueing — is deterministic
  and side-effect-free: same input always produces the same output, no
  network calls, testable as a pure function.
- **INV-9 (Explainability).** Every eligibility verdict carries a
  reason (`categories`), never a bare boolean.

---

## 4. Boundaries

### 4.1 `rank_score`'s role

| Consumer | Uses `rank_score`? |
|---|---|
| Knowledge Engine enqueueing | **No** — governed by the primary `KnowledgeEligibilityStrategy` (§2.1) instead |
| `assembleRealitySnapshot`'s memory filter (feeds Extract) | **No**, for the focused memory (§4.2) — still used to rank/select the *other*, non-triggering candidates in that snapshot |
| Memory Connection candidacy | **Unchanged** — the one remaining consumer for which a same-turn, low-stakes, recoverable-if-wrong signal is the correct fit |

`rank_score` is, permanently, a Memory-Engine-owned relevance signal
for cheap synchronous decisions where a false negative is recoverable.
It is never again read as a proxy for Knowledge Engine eligibility
anywhere in the system (Invariant 3). Any future consumer proposing to
use it as a hard gate again needs the same kind of evidence this ADR
is built on, not silent reuse because the field exists.

### 4.2 `focusMemoryId`'s guarantee

Direct application of Invariant 4. A memory passed as `focusMemoryId`
is exempt from every relevance/eligibility filter applied to the
snapshot it's included in — filtering happens to the other candidates
first, the focused memory is attached afterward, unconditionally. The
existence of a `knowledge_job` already *is* the eligibility decision
for its triggering memory; nothing downstream re-asks that question.

### 4.3 Governance boundary (ADR-0018)

Nothing this ADR describes stands up a new `core/*-engine`:

- The primary eligibility strategy is a new strategy implementation
  inside the existing `core/knowledge-engine` module — the same
  pattern already established by `MemoryRankingStrategy` and
  `InsightValidationStrategy`. Ordinary engineering inside an engine
  that already exists, which ADR-0018 does not gate.
- A secondary eligibility strategy, whatever mechanism eventually
  satisfies its contract, is operational infrastructure around the
  existing Knowledge Engine pipeline — it calls the same
  `enqueueKnowledgeJob`/`knowledge_jobs` machinery that already
  exists, introduces no new domain and no new bounded context.

This reading is offered, not assumed final. If a secondary strategy's
eventual mechanism turns out to require infrastructure this reasoning
didn't anticipate, that determination is made against ADR-0018's own
test ("can this be resolved with the architecture we have") at the
point a real mechanism is on the table — not deferred further than
that, and not decided by silence either way.

### 4.4 What this ADR does not decide

Stated explicitly, with where each answer now lives, so its absence
here is never mistaken for an oversight:

| Not decided here | Belongs in | Why |
|---|---|---|
| The eligibility taxonomy's actual members and their definitions | Domain documentation, `core/knowledge-engine/eligibility/` (to be created at implementation time) | Expected to grow and change as real evidence accumulates — an ADR that has to be amended every time a category is added isn't stable. |
| The secondary strategy's actual mechanism (lexical, AI, rules, human review) | Implementation, decided at the point it's built | A mechanism choice, not a structural one — §2.1's contract is satisfied by any of them. |
| `EligibilityBudget`'s actual numbers | Implementation configuration | Tunable against real observed volume and cost; the requirement that a bound exists (Invariant 7) is what's permanent, not the number. |
| Specific recall/precision bars for promoting a strategy to production | The validation run itself, following `docs/engineering/TECHNICAL_INVESTIGATION_METHODOLOGY_V1.md` | Set by whoever reviews real benchmark results at the time, informed by data that doesn't exist yet. |
| Historical backfill batch size and ordering | Implementation, tuned against real observed run-time | Operational tuning, not structure. |

---

## 5. Rollout

Staged, smallest-and-safest first. Each phase ships as its own PR and
is independently valuable; §6 gives the exact rollback for each.

- **Phase 0 — `focusMemoryId` exemption (§4.2).** Zero new schema,
  zero new capability, ships alone.
- **Phase 1 — primary strategy, shadow mode.** New primary
  `KnowledgeEligibilityStrategy` implementation writes verdicts (§7
  schema) for every new memory; enqueueing keeps using `rank_score` as
  it does today. Produces a live comparison dataset before anything
  user-facing changes.
- **Phase 2 — primary strategy live.** Behind a config flag, defaulted
  off, switch the enqueue decision in the orchestration layer to the
  primary strategy's verdict. Flip only after the shadow-mode data
  from Phase 1 is validated per §4.4's validation row.
- **Phase 3 — secondary strategy, pilot.** Mechanism chosen at this
  point (§4.4), built against the §2.1 contract, piloted against a
  bounded, limited real population before wider rollout. Requires its
  own validation pass (§4.4) and confirmed adherence to its
  `EligibilityBudget` before Phase 4.
- **Phase 4 — secondary strategy, general availability.** Only after
  Phase 3's pilot results are reviewed and explicitly accepted.
- **Phase 5 — historical backfill.** Sequenced after Phase 2 is live
  and validated; independent of Phase 3/4. Applies the primary
  strategy retroactively to memories that predate it. Must be
  resumable and rate-bounded (batch size and ordering: §4.4);
  must not re-evaluate a memory that already has a verdict
  (Invariant 6).

Every phase gate (moving from one phase to the next) requires the
validation step named in §4.4 to have actually run against real data
— no phase advances on the strength of this document alone.

---

## 6. Rollback

| Phase | Mechanism | Data cleanup |
|---|---|---|
| 0 | Revert the code change. | None. |
| 1 (shadow) | Stop or ignore the shadow computation — production behavior is unaffected by construction. | None; written verdicts can stay, unused. |
| 2 (live) | Flip the config flag back to the legacy `rank_score` gate — no deploy required if read at request time. | None — legacy behavior resumes exactly. |
| 3 (pilot) | Disable the secondary strategy's trigger for the pilot population. | None — scope was already bounded to the pilot. |
| 4 (GA) | Same flag as Phase 3, scope narrowed back. | None. |
| 5 (backfill) | Stop the backfill process. Already-enqueued jobs from it are ordinary jobs, left to complete or cancelled like any other. | None. |

**Standing principle:** every phase is reversible through a flag or a
process toggle, never through a data rollback. The schema in §7 is
purely additive and inert until code reads it — removing it later, if
ever wanted, is unforced housekeeping with no dependency on any
rollback above.

---

## 7. Observability

**Structural requirement, permanent:** every eligibility verdict,
from either strategy role, is logged and persisted with its full
`EligibilityVerdict` shape (§2.1) plus which strategy instance produced
it — never aggregated or discarded before being recorded. This is
Invariant 9 made operational: a system whose eligibility decisions
aren't individually inspectable has silently stopped being
explainable, no matter how good the underlying mechanism is.

**What must be measurable, on an ongoing basis, not just once:**

- Eligibility rate, decomposable by category and by which strategy
  role (primary/secondary) produced the verdict.
- Volume of Knowledge Engine work created, over time.
- Conversion rate from "work created" to "knowledge actually
  persisted" — the exact ratio investigation 3 measured once; this
  must stay measurable continuously, not require a one-off audit each
  time someone wants to know it.
- Secondary strategy budget utilization against its configured bound
  (§2.2) — sustained saturation is a signal worth surfacing, not
  silently absorbed.
- Chat-path latency, specifically the capture step — must show no
  regression, checked with the same tracing infrastructure already
  built into this codebase.

**Specific metric names, dashboards, and alert thresholds are
implementation detail**, not fixed here — what's fixed is that all
five of the above must be answerable from recorded data at any time,
without re-deriving them the way today's three investigations had to.

---

## 8. Migration strategy

No migration for `rank_score` itself — mechanism and every consumer
except Knowledge Engine enqueueing are unchanged.

**New schema, additive only:**

1. On `memories`: a nullable eligibility-verdict record (mirroring the
   existing `rank_score`/`ranked_at` pair in spirit) — `eligible`,
   `categories`, `checked_at`, written by the **primary** strategy at
   capture time. Nullable so existing rows are inert until the
   backfill (Phase 5) runs or the column is naturally populated going
   forward. The system is correct for all new activity the moment
   Phase 1 ships, independent of whether Phase 5 ever runs.
2. A new, append-only table recording every verdict from **both**
   strategy roles (`memory_id`, `checked_at`, `eligible`, `categories`,
   `method`) — the durable audit trail Invariant 9 requires, and the
   mechanism a secondary strategy uses to know what it has and hasn't
   already evaluated (never re-evaluate a memory with an existing
   `method: 'secondary'` row — Invariant 6). Kept separate from
   `memories` deliberately: this bookkeeping is Knowledge Engine's own
   concern (§1), not Memory Engine's table.

No down-migration is ever required to roll back code that stops
writing to either — see §6.

---

## Reading order for implementation

§0-§4 (Mission through Boundaries) should not change as this gets
built — if implementation reveals one of them needs to change, that's
a signal to revise this ADR deliberately, not to route around it. §5-§8
(Rollout, Rollback, Observability, Migration) are the parts meant to
be executed against directly. §4.4 is the index of everything
intentionally left open — check it before inventing an answer that
belongs somewhere else.
