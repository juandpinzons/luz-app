# ADR-0022 Knowledge Relevance Redesign

Status: Proposed — awaiting Founder review\
Date: 2026-08-02 (Revision 5 — minimality, terminology, and principle pass)\
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

**Revision 5 note — this one removes more than it adds.** Three
questions drove it: is this the minimum architecture the investigations
actually demonstrate is needed; is "Eligibility" defined before it's
used; does the ADR's central principle generalize beyond the one field
that motivated it. The answer to the first was no. Revisions 1-4 built
a full second decision tier — its own contract, a composition model,
a resource budget, an audit table — justified by one real but narrow
fact (some false negatives have no lexical anchor) that supports
*acknowledging* a residual gap, not *architecting its solution* before
anyone has decided what that solution is. Every weakness revision 4
had to patch in that tier (the audit table's missing `life_graph_id`,
the evaluate-once race, the composition gap) was a symptom of building
it too early, not an independent bug. It's removed here, replaced with
an explicit, honest deferral. What remains is smaller and is fully
accounted for by the three investigations.

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
not a defect this ADR removes. Some mechanism must always decide what
justifies the cost of the pipeline below. What this ADR fixes is that
the mechanism doing that job today answers three different questions
with one signal, and one of those answers is wrong far more often than
right.

### Terminology

Defined here, once, before any interface uses these words:

- **Eligibility** is Knowledge Engine's own determination of whether a
  specific `Memory` justifies being processed by its pipeline (Extract
  through Persist, §4.3). It is never a property of the `Memory`
  itself — that would make it Memory Engine's concern, contradicting
  §1 — and never a probability or a score with a threshold — that
  would recreate the exact failure this ADR exists to fix.
- A **verdict** is the outcome of one eligibility determination for one
  memory: eligible or not, and why (§2.1).
- A **category** is a named reason a verdict can cite — drawn from a
  taxonomy maintained outside this ADR (§4.4), never invented ad hoc by
  a caller.

### Principle

**A decision belongs to exactly one owner; extending it to a second
consumer with different stakes requires the same evidence-based case
this ADR itself is built on, not silent reuse.** This is Invariant 3.
It is the whole reason this ADR exists — `rank_score` was a
perfectly good decision for one consumer, reused without re-examination
for two more whose error tolerance was completely different. Nothing
introduced by this ADR is exempt from the same rule, including
`EligibilityVerdict` itself (§2.1).

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
- **Eligibility is decided in the orchestration layer, strictly after
  `MemoryEngine.capture()` returns — never inside Memory Engine.**
  `Memory.capture()` returns a `Memory`; only then does the
  orchestrator ask Knowledge Engine whether it's eligible.
- The **orchestration layer** — never either engine — is the only code
  permitted to know about both and call them in sequence.

This applies ADR-0002 (Domain Isolation)'s existing one-directional
dependency rule to a boundary that was previously blurred —
`rank_score`, a Memory Engine field, was being read by Knowledge
Engine as if it were Knowledge Engine's own decision.

---

## 2. Contracts

### 2.1 Eligibility

```ts
// core/knowledge-engine/eligibility/eligibility-strategy.ts

/** A named identifier from the maintained taxonomy — see §4.4. */
export type EligibilityCategory = string;

export interface EligibilityVerdict {
  /** Derived, never set independently of `categories`: true iff categories.length > 0. */
  readonly eligible: boolean;
  /** Every category that applied. Empty, never null/undefined, when nothing matched. Never contains duplicates. */
  readonly categories: readonly EligibilityCategory[];
  readonly decidedAt: Date;
}

export interface KnowledgeEligibilityStrategy {
  /**
   * MUST NOT throw as a means of signaling "not eligible" — an error
   * means the decision could not be made, a different, separately-
   * observable condition (§9) from a genuine negative verdict.
   * Callers MUST treat a thrown error as `eligible: false` for any
   * downstream decision (Invariant 10) while logging it distinctly.
   */
  evaluate(
    context: LifeGraphContext,
    memory: Memory,
  ): Promise<EligibilityVerdict>;
}
```

A verdict cannot report `eligible: true` with an empty `categories`
array — the type itself prevents a gate detached from any inspectable
reason. Eligibility is a **named, categorical decision**, never a bare
boolean and never a numeric score with a threshold someone has to
remember.

**This contract's meaning is scoped to Knowledge Engine enqueueing,
permanently.** A future consumer with a different question — different
acceptable error rate, different cost of being wrong — defines its own
named decision, following the same case this ADR itself had to make
(Invariant 3; the procedure is `docs/engineering/TECHNICAL_INVESTIGATION_METHODOLOGY_V1.md`,
not ad hoc judgment). Reading `EligibilityVerdict` off a memory as a
proxy for something else is the exact mistake `rank_score` made, under
a new name.

### 2.2 Enqueueing requires a verdict

The function that creates a `knowledge_job` takes an
`EligibilityVerdict` as a required argument, not an optional one — a
caller cannot construct a call to it without having already obtained
one. This is a structural guarantee, not a convention: a future caller
cannot bypass eligibility by simply forgetting to check it, the way
today's code can (and did) bypass `focusMemoryId`'s guarantee (§4.2)
by omission.

There is exactly one implementation of `KnowledgeEligibilityStrategy`
in this design — see §4.4 for why a second one is deliberately not
specified here.

---

## 3. Invariants

Hold regardless of implementation choice, regardless of how many years
pass. A change that requires violating one of these is a new ADR, not
an extension of this one.

- **INV-1 (Memory completeness).** Every user message becomes exactly
  one `Memory`, unconditionally, synchronously, regardless of content.
  Nothing introduced by this ADR may cause a capture to fail — see
  INV-10.
- **INV-2 (Hot-path AI-free).** No step in the synchronous
  request/response path — inside `MemoryEngine.capture()` or in the
  orchestration layer's eligibility check (§1) — makes an external
  network/AI call.
- **INV-3 (Single-purpose decisions).** No single score or decision
  governs two consumers whose acceptable-error-rate or cost profile
  differ, without the same evidence-based case this ADR itself makes
  (§0, Principle) — never silent reuse because a field or a verdict
  happens to already exist.
- **INV-4 (Triggered-memory guarantee).** A memory passed as
  `focusMemoryId` into `assembleRealitySnapshot` is always present in
  `snapshot.memory.items`, regardless of any relevance or eligibility
  filter applied to other candidates in that snapshot.
- **INV-5 (Async pipeline).** Knowledge Engine's own processing —
  Extract through Persist — never executes inside a request/response
  cycle a user is waiting on. (Already true today; this ADR does not
  touch it.)
- **INV-6 (Deterministic).** The eligibility decision is deterministic
  and side-effect-free: same input always produces the same output, no
  network calls, testable as a pure function.
- **INV-7 (Explainability).** Every eligibility verdict carries a
  reason (`categories`), never a bare boolean.
- **INV-8 (Fail closed).** Any error raised while producing an
  eligibility verdict is treated as `eligible: false` by every caller,
  unconditionally, and is never allowed to propagate into a path
  Invariant 1 depends on. The error itself is logged as a distinct,
  separately-observable event (§9) — never silently recorded as an
  ordinary negative verdict.

---

## 4. Boundaries

### 4.1 `rank_score`'s role

| Consumer | Uses `rank_score`? |
|---|---|
| Knowledge Engine enqueueing | **No** — governed by the `KnowledgeEligibilityStrategy` verdict (§2.1) instead |
| `assembleRealitySnapshot`'s memory filter (feeds Extract) | **No**, for the focused memory (§4.2) — still used to rank/select the *other*, non-triggering candidates in that snapshot |
| Memory Connection candidacy | **Unchanged** — the one remaining consumer for which a same-turn, low-stakes, recoverable-if-wrong signal is the correct fit |

`rank_score` is, permanently, a Memory-Engine-owned relevance signal
for cheap synchronous decisions where a false negative is recoverable.
It is never again read as a proxy for Knowledge Engine eligibility
anywhere in the system (Invariant 3).

### 4.2 `focusMemoryId`'s guarantee

Direct application of Invariant 4. A memory passed as `focusMemoryId`
is exempt from every relevance/eligibility filter applied to the
snapshot it's included in — filtering happens to the other candidates
first, the focused memory is attached afterward, unconditionally. The
existence of a `knowledge_job` already *is* the eligibility decision
for its triggering memory (guaranteed structurally by §2.2, not by
caller discipline); nothing downstream re-asks that question.

Memories in `status: archived` or `status: forgotten` are out of scope
for evaluation — a person who asked Memory Engine to set a memory's
status that way has, by the same act, withdrawn it from consideration
for new Knowledge Engine work. This does not affect knowledge already
derived from it before the status changed.

### 4.3 Governance boundary (ADR-0018)

The eligibility strategy is a new strategy implementation inside the
existing `core/knowledge-engine` module — the same pattern already
established by `MemoryRankingStrategy` and `InsightValidationStrategy`.
Ordinary engineering inside an engine that already exists, which
ADR-0018 does not gate. Nothing in this ADR stands up a new
`core/*-engine`.

### 4.4 What this ADR does not decide

Stated explicitly, with where each answer now lives, so its absence
here is never mistaken for an oversight:

| Not decided here | Belongs in | Why |
|---|---|---|
| The eligibility taxonomy's actual members and their definitions | Domain documentation, `core/knowledge-engine/eligibility/` (to be created at implementation time) | Expected to grow and change as real evidence accumulates. A rename or retirement never mutates or reuses an identifier for a different meaning — it's a retire-plus-introduce pair, tracked there. |
| The strategy's actual mechanism (lexical, rules, or anything else that satisfies §2.1 deterministically) | Implementation, decided at build time | A mechanism choice, not a structural one. |
| Specific recall/precision bars for promoting a strategy to production | The validation run itself, following `docs/engineering/TECHNICAL_INVESTIGATION_METHODOLOGY_V1.md` | Set by whoever reviews real benchmark results, informed by data that doesn't exist yet. |
| Historical backfill batch size and ordering (§5, Phase 3) | Implementation, tuned against real observed run-time | Operational tuning, not structure. |
| **Whether, and how, to close the residual gap investigation 1 found (false negatives with no lexical anchor at all)** | **A future ADR, proposed only after Phase 1-2 (§5) produces real data on how large that gap actually is** | Deliberately not designed here. Investigation 1 justifies *knowing this gap exists*; it does not justify committing to a specific second mechanism, a resource budget, or a composition model before the gap's real size — and whether closing it is worth the cost — is known. Any such future design inherits every invariant in §3 unchanged (in particular INV-2, INV-6, and INV-8 apply to it exactly as written) and must make its own case against Invariant 3 and its own ADR-0018 case (§4.3) at the time it's proposed. |

**What would supersede this ADR, not just extend it:** a future
redesign that replaces gating entirely — e.g., every memory entering
Knowledge Engine at a variable priority instead of a binary decision —
would replace §2 wholesale. Most of §3 would likely still hold; §4.1
and §4.2's specific boundary drawings would not. This paragraph exists
so that a future rewrite is recognized as a deliberate supersession,
not a violation of this one.

---

## 5. Rollout

- **Phase 0 — `focusMemoryId` exemption (§4.2).** Zero new schema,
  ships alone.
- **Phase 1 — eligibility strategy, shadow mode.** Writes verdicts (§8
  schema) for every new memory; enqueueing keeps using `rank_score` as
  it does today. Produces a live comparison dataset before anything
  user-facing changes.
- **Phase 2 — eligibility strategy live.** Behind a config flag,
  defaulted off, switch the enqueue decision in the orchestration
  layer to the strategy's verdict, passed through §2.2's
  required-argument enqueue function. Flip only after Phase 1's data
  is validated per §4.4. Flag reads happen fresh per request — an
  in-flight request completes under whichever value it read at start,
  a bounded, self-resolving inconsistency window at the moment of the
  flip, never a lasting one.
- **Phase 3 — historical backfill.** Sequenced after Phase 2 is live
  and validated. Applies the strategy retroactively to memories that
  predate it. Must be resumable and rate-bounded (batch size and
  ordering: §4.4); must not re-evaluate a memory that already has a
  verdict — this makes partial completion automatically safe to leave
  in place or resume later, with no special-cased cleanup logic
  required.

Every phase gate requires the validation step named in §4.4 to have
actually run against real data — no phase advances on the strength of
this document alone.

---

## 6. Rollback

| Phase | Mechanism | Data cleanup |
|---|---|---|
| 0 | Revert the code change. | None. |
| 1 (shadow) | Stop or ignore the shadow computation — production behavior is unaffected by construction. | None; written verdicts can stay, unused. |
| 2 (live) | Flip the config flag back to the legacy `rank_score` gate — no deploy required if read at request time (see Phase 2's in-flight note, §5). | None — legacy behavior resumes exactly. |
| 3 (backfill) | Stop the backfill process. Already-enqueued jobs from it are ordinary jobs, left to complete or cancelled like any other. Memories already evaluated stay evaluated — resuming later simply continues where it left off. | None. |

**Standing principle:** every phase is reversible through a flag or a
process toggle, never through a data rollback. The schema in §8 is
purely additive and inert until code reads it.

---

## 7. Observability

**Structural requirement, permanent:** every eligibility verdict is
logged and persisted with its full `EligibilityVerdict` shape (§2.1)
— never aggregated or discarded before being recorded. This is
Invariant 7 made operational.

**Evaluation errors (Invariant 8) are their own, separately-observable
event — never folded into a normal verdict.** A system that can't tell
"genuinely decided not eligible" apart from "failed to decide,
defaulted closed" cannot distinguish a correctly-selective mechanism
from a silently-broken one — exactly the ambiguity that let the
original 10.3%-recall matcher go unnoticed as long as it did.

A verdict is logged correlated to the request that produced it, using
this codebase's existing request-id convention, the same as any other
span in that request.

**What must be measurable, on an ongoing basis, not just once:**

- Eligibility rate, decomposable by category.
- Volume of Knowledge Engine work created, over time.
- Conversion rate from "work created" to "knowledge actually
  persisted" — the exact ratio investigation 3 measured once; this
  must stay measurable continuously.
- Evaluation error rate (Invariant 8), separately from eligibility
  rate.
- Chat-path latency, specifically the capture-and-eligibility step —
  checked with the same tracing infrastructure already built into
  this codebase.

Specific metric names, dashboards, and alert thresholds are
implementation detail — what's fixed is that all five of the above
must be answerable from recorded data at any time.

---

## 8. Migration strategy

No migration for `rank_score` itself — mechanism and every consumer
except Knowledge Engine enqueueing are unchanged.

**New schema, additive only, nullable/no-default so it doesn't require
a table rewrite on a hot table — the same characteristic `rank_score`
itself already has:** on `memories`, a nullable eligibility-verdict
record — `eligible`, `categories`, `checked_at` — mirroring the
existing `rank_score`/`ranked_at` pair exactly, written by the
orchestration layer once, synchronously, at the same point it decides
whether to enqueue a job. Nullable so existing rows are inert until
the backfill (Phase 3) runs or the column is naturally populated going
forward — the system is correct for all new activity the moment Phase
1 ships, independent of whether Phase 3 ever runs.

No separate audit table. One verdict per memory, written once,
co-located with the other fact Memory Engine already keeps about the
same memory (`rank_score`) — no new table means no new privacy-scoping
surface to get right, and "written once" is guaranteed by the
orchestration layer calling `evaluate()` exactly once per memory as
part of the same flow that creates it, not by a separate enforcement
mechanism.

Referential behavior: this is a column, not a foreign-keyed table — it
inherits `memories`' own lifecycle exactly, including that `forget`
changes `status` rather than deleting the row, consistent with this
product's never-truly-delete discipline applied elsewhere.

**Interface evolution:** additive changes to `EligibilityVerdict` or
`KnowledgeEligibilityStrategy` (new optional fields) do not require a
new ADR. Removing or renaming a required field does.

No down-migration is ever required to roll back code that stops
writing to this column — see §6.

---

## Reading order for implementation

§0-§4 (Mission through Boundaries) should not change as this gets
built — if implementation reveals one of them needs to change, that's
a signal to revise this ADR deliberately, not to route around it. §5-§8
are the parts meant to be executed against directly. §4.4 is the index
of everything intentionally left open, including the one deliberately
undesigned piece (the residual non-lexical gap) — check it before
inventing an answer that belongs in a future ADR instead.
