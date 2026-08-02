# ADR-0022 Knowledge Relevance Redesign

Status: Proposed — awaiting Founder review\
Date: 2026-08-02 (Revision 4 — adversarial final review pass)\
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

**Revision 4 note:** this revision follows a deliberately adversarial
review — treating revision 3 as something to break, not defend. Twenty
real weaknesses were found, including one outright internal
contradiction (§1 said Memory Engine never knows about eligibility;
§8 said eligibility is computed "at capture time," which would require
exactly that). All twenty are fixed below, folded into the same nine
sections rather than growing the document — this ADR's *shape* wasn't
what broke under review, its *content* was underspecified in ways
that would have let two competent engineers implement it two
incompatible ways.

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

**Two principles the rest of this document follows, stated once here
rather than re-justified section by section:**

- **Fail closed, always.** Any failure in a relevance or eligibility
  decision resolves to "not eligible," never to "eligible" and never
  to propagating the failure into a path that isn't allowed to fail
  (Invariant 1). A missed opportunity is recoverable; a broken chat
  response is not.
- **A decision belongs to exactly one owner, and reuse requires new
  evidence.** This is Invariant 3, and it applies to every signal this
  ADR introduces, not only to the one (`rank_score`) that motivated it
  (§4.4).

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
  a property of the Memory, and it is decided in the orchestration
  layer — never inside `MemoryEngine.capture()`, and never inside any
  other Memory Engine code path.** `Memory.capture()` returns a
  `Memory`; only after it returns does the orchestrator ask Knowledge
  Engine whether that memory is eligible. This is the one sequencing
  rule the rest of this document assumes without restating: eligibility
  is always evaluated *after* capture completes, *outside* Memory
  Engine, *before* any job is enqueued.
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

Interfaces and their behavioral obligations. No implementation, no
concrete values — every type below is intended to still be correct
after the mechanism behind it has changed completely, and after new
implementations have been composed alongside the first one.

### 2.1 Eligibility

```ts
// core/knowledge-engine/eligibility/eligibility-strategy.ts

/**
 * Opaque identifier from the maintained eligibility taxonomy (domain
 * documentation, not this ADR — see §4.4). Not a bare string in
 * practice: implementations construct it through a validating
 * registry that rejects unregistered identifiers at the boundary,
 * so a typo fails loudly at the point it's introduced rather than
 * silently never matching anything, forever.
 */
export type EligibilityCategory = string & { readonly __brand: "EligibilityCategory" };

/**
 * Describes *when* a verdict was produced relative to the request
 * that caused the memory to exist — not a ranking or priority.
 * `synchronous`: decided inline, before any job is enqueued, subject
 * to Invariants 2 and 8. `deferred`: decided later, out of the
 * request path, re-considering a memory a synchronous verdict already
 * marked ineligible, subject to Invariants 5, 6, and 7. Any number of
 * deferred strategies may exist and be composed (§2.3); there is
 * never more than one synchronous strategy in the live path at a
 * time.
 */
export type EligibilityTiming = "synchronous" | "deferred";

export interface EligibilityVerdict {
  /** Derived, never set independently of `categories`: true iff categories.length > 0. */
  readonly eligible: boolean;
  /** Every category that applied. Empty, never null/undefined, when nothing matched. Never contains duplicates. */
  readonly categories: readonly EligibilityCategory[];
  readonly timing: EligibilityTiming;
  /** The taxonomy version active when this verdict was produced — never re-interpreted against a later version. See §8 (Migration). */
  readonly taxonomyVersion: string;
  readonly decidedAt: Date;
}

export interface KnowledgeEligibilityStrategy {
  /**
   * MUST NOT throw as a means of signaling "not eligible" — an error
   * means the decision could not be made, which is a different,
   * separately-observable condition (§9) from a genuine negative
   * verdict. Callers that receive a thrown error MUST treat the
   * memory as `eligible: false` for the purpose of any downstream
   * decision (Invariant 10) while logging the error distinctly.
   */
  evaluate(
    context: LifeGraphContext,
    memory: Memory,
  ): Promise<EligibilityVerdict>;
}
```

A verdict cannot report `eligible: true` with an empty `categories`
array — the type itself prevents the failure this ADR exists to fix
(a gate detached from any inspectable reason). Eligibility is a
**named, categorical decision**, never a bare boolean and never a
numeric score with a threshold someone has to remember.

**This contract's meaning is scoped to Knowledge Engine enqueueing,
permanently.** A future consumer with a different question — different
acceptable error rate, different cost of being wrong — defines its own
named decision. Reading `EligibilityVerdict` off a memory as a proxy
for something else is the exact mistake `rank_score` made, under a new
name (§0, second principle).

### 2.2 Resource bound

```ts
// core/knowledge-engine/eligibility/eligibility-budget.ts

export interface EligibilityBudget {
  readonly maxEvaluationsPerPeriod: number;
  readonly periodMs: number;
}
```

The shape of a bound, not its value. Every `deferred` strategy
invocation path is called through a budget of this shape (Invariant
7) — enforced by the caller, never by the strategy itself, so the same
strategy implementation stays valid under a different budget later
without any code change.

### 2.3 Composition

More than one `deferred` strategy MAY exist concurrently (e.g., a
cheap heuristic tried before a more expensive one). Composition itself
MUST be expressed as another implementation of
`KnowledgeEligibilityStrategy` — never as ad hoc branching in the
caller. A composed strategy:

- Produces exactly one `EligibilityVerdict` per memory, merging
  `categories` from whichever constituent strategies matched
  (composition semantics — first-match, all-must-agree, priority-order
  — are an implementation decision, not fixed here).
- Is the only thing that writes to the audit trail (§8) for that
  evaluation — constituent strategies inside a composition never write
  independently. This keeps "one verdict per memory per timing" true
  (Invariant 6) regardless of how many strategies are composed behind
  it.

### 2.4 Enqueueing requires a verdict

The function that creates a `knowledge_job` takes an
`EligibilityVerdict` as a required argument, not an optional one — a
caller cannot construct a call to it without having already obtained
one. This is a structural guarantee, not a convention: a future caller
cannot bypass eligibility by simply forgetting to check it, the way
today's code can (and did) bypass `focusMemoryId`'s guarantee (§4.2)
by omission.

---

## 3. Invariants

Hold regardless of implementation choice, regardless of what values
populate the contracts in §2, and regardless of how many years pass.
A change that requires violating one of these is a new ADR, not an
extension of this one.

- **INV-1 (Memory completeness).** Every user message becomes exactly
  one `Memory`, unconditionally, synchronously, regardless of content.
  Nothing introduced by this ADR may cause a capture to fail — see
  INV-10.
- **INV-2 (Hot-path AI-free).** No step in the synchronous
  request/response path — inside `MemoryEngine.capture()` or in the
  orchestration layer's synchronous eligibility check (§1) — makes an
  external network/AI call. Scoped to the whole synchronous path, not
  to one function's call graph, specifically so moving eligibility out
  of Memory Engine (§1) can't accidentally create a loophole.
- **INV-3 (Single-purpose decisions).** No single score or decision
  governs two consumers whose acceptable-error-rate or cost profile
  differ, without an explicit, separately-named, separately-owned
  decision per consumer. Applies to `EligibilityVerdict` itself, not
  only to `rank_score` (§2.1).
- **INV-4 (Triggered-memory guarantee).** A memory passed as
  `focusMemoryId` into `assembleRealitySnapshot` is always present in
  `snapshot.memory.items`, regardless of any relevance or eligibility
  filter applied to other candidates in that snapshot.
- **INV-5 (Async isolation).** Knowledge Engine processing — Extract
  through Persist, and any `deferred` eligibility evaluation — never
  executes inside a request/response cycle a user is waiting on.
- **INV-6 (Evaluate-once).** A given memory is evaluated by a given
  `timing` (synchronous or deferred) at most once, ever. This is
  enforced structurally (§8's uniqueness constraint), not by
  convention, and exists specifically to prevent duplicate
  `knowledge_job` creation for the same memory — not because
  re-running a strategy is expensive (the synchronous one is free by
  construction, INV-8) but because a second job for content already
  processed is pure waste and a second, possibly-different verdict for
  the same memory has no principled way to be reconciled with the
  first.
- **INV-7 (Bounded resource consumption).** Any `deferred` strategy
  operates within an explicit, enforced, per-period bound (§2.2) —
  never unconditionally, regardless of mechanism or the bound's actual
  value.
- **INV-8 (Deterministic synchronous path).** The `synchronous`
  eligibility decision — the one gating real-time enqueueing — is
  deterministic and side-effect-free: same input always produces the
  same output, no network calls, testable as a pure function.
- **INV-9 (Explainability).** Every eligibility verdict carries a
  reason (`categories`), never a bare boolean.
- **INV-10 (Fail closed).** Any error raised while producing an
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
| Knowledge Engine enqueueing | **No** — governed by the synchronous `KnowledgeEligibilityStrategy` verdict (§2.1) instead |
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
for its triggering memory (guaranteed structurally by §2.4, not by
caller discipline); nothing downstream re-asks that question.

Memories in `status: archived` or `status: forgotten` are out of scope
for both `synchronous` and `deferred` evaluation — a person who asked
Memory Engine to set a memory's status that way has, by the same act,
withdrawn it from consideration for new Knowledge Engine work. This
does not affect knowledge already derived from it before the status
changed.

### 4.3 Governance boundary (ADR-0018)

Nothing this ADR describes stands up a new `core/*-engine`:

- The synchronous eligibility strategy is a new strategy implementation
  inside the existing `core/knowledge-engine` module — the same
  pattern already established by `MemoryRankingStrategy` and
  `InsightValidationStrategy`. Ordinary engineering inside an engine
  that already exists, which ADR-0018 does not gate.
- A deferred eligibility strategy, whatever mechanism eventually
  satisfies its contract, is operational infrastructure around the
  existing Knowledge Engine pipeline — it calls the same
  `enqueueKnowledgeJob`/`knowledge_jobs` machinery that already
  exists, introduces no new domain and no new bounded context.

This reading is offered, not assumed final. If a deferred strategy's
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
| The eligibility taxonomy's actual members, their definitions, and the registry that validates `EligibilityCategory` | Domain documentation, `core/knowledge-engine/eligibility/` (to be created at implementation time) | Expected to grow and change as real evidence accumulates. Retiring or renaming a category happens there too — old identifiers are never mutated or reused for a different meaning; a rename is a retire-plus-introduce pair, and historical verdicts stay readable under the `taxonomyVersion` they were produced with (§8). |
| Any strategy's actual mechanism (lexical, AI, rules, human review) and how multiple deferred strategies are composed in practice | Implementation, decided at the point it's built | A mechanism choice, not a structural one — §2.1/§2.3's contracts are satisfied by any of them. |
| `EligibilityBudget`'s actual numbers | Implementation configuration | Tunable against real observed volume and cost; the requirement that a bound exists (Invariant 7) is what's permanent, not the number. |
| Specific recall/precision bars for promoting a strategy to production | The validation run itself, following `docs/engineering/TECHNICAL_INVESTIGATION_METHODOLOGY_V1.md` | Set by whoever reviews real benchmark results at the time, informed by data that doesn't exist yet. |
| Historical backfill batch size and ordering | Implementation, tuned against real observed run-time | Operational tuning, not structure. |
| Whether a human can manually force re-evaluation of a specific memory | Implementation, if ever built | Not precluded by this ADR, but not assumed either — if built, it is its own explicit, audited action (its own `timing` value or an explicit override with its own log trail), never a silent bypass of Invariant 6. |

**What would supersede this ADR, not just extend it:** a future
redesign that replaces gating entirely — e.g., every memory enters
Knowledge Engine at a variable priority instead of a binary
eligible/not-eligible decision — would replace §2's contracts wholesale.
Most of §3's invariants (1, 2, 5, 6, 9, 10 in particular) would likely
still hold under a priority-based redesign too; §4.1/§4.2's specific
boundary drawings would not, and that ADR would need to redraw them.
This paragraph exists so that future rewrite is recognized as a
deliberate supersession, not a violation of this one.

---

## 5. Rollout

Staged, smallest-and-safest first. Each phase ships as its own PR and
is independently valuable; §6 gives the exact rollback for each.

- **Phase 0 — `focusMemoryId` exemption (§4.2).** Zero new schema,
  zero new capability, ships alone.
- **Phase 1 — synchronous strategy, shadow mode.** New synchronous
  `KnowledgeEligibilityStrategy` implementation writes verdicts (§8
  schema) for every new memory; enqueueing keeps using `rank_score` as
  it does today. Produces a live comparison dataset before anything
  user-facing changes.
- **Phase 2 — synchronous strategy live.** Behind a config flag,
  defaulted off, switch the enqueue decision in the orchestration
  layer to the synchronous strategy's verdict, passed through §2.4's
  required-argument enqueue function. Flip only after the shadow-mode
  data from Phase 1 is validated per §4.4's validation row. Flag reads
  happen fresh per request — an in-flight request completes under
  whichever value it read at start; this creates a bounded,
  self-resolving inconsistency window at the moment of the flip, never
  a lasting one.
- **Phase 3 — deferred strategy, pilot.** Mechanism chosen at this
  point (§4.4), built against the §2.1/§2.3 contracts, piloted against
  a bounded, limited real population before wider rollout. Requires its
  own validation pass (§4.4) and confirmed adherence to its
  `EligibilityBudget` before Phase 4.
- **Phase 4 — deferred strategy, general availability.** Only after
  Phase 3's pilot results are reviewed and explicitly accepted.
- **Phase 5 — historical backfill.** Sequenced after Phase 2 is live
  and validated; independent of Phase 3/4. Applies the synchronous
  strategy retroactively to memories that predate it. Must be
  resumable and rate-bounded (batch size and ordering: §4.4); must not
  re-evaluate a memory that already has a verdict (Invariant 6) — this
  makes partial completion automatically safe to leave in place or
  resume later, with no special-cased cleanup logic required.

Every phase gate (moving from one phase to the next) requires the
validation step named in §4.4 to have actually run against real data
— no phase advances on the strength of this document alone.

---

## 6. Rollback

| Phase | Mechanism | Data cleanup |
|---|---|---|
| 0 | Revert the code change. | None. |
| 1 (shadow) | Stop or ignore the shadow computation — production behavior is unaffected by construction. | None; written verdicts can stay, unused. |
| 2 (live) | Flip the config flag back to the legacy `rank_score` gate — no deploy required if read at request time (see Phase 2's in-flight note, §5). | None — legacy behavior resumes exactly. |
| 3 (pilot) | Disable the deferred strategy's trigger for the pilot population. | None — scope was already bounded to the pilot. |
| 4 (GA) | Same flag as Phase 3, scope narrowed back. | None. |
| 5 (backfill) | Stop the backfill process. Already-enqueued jobs from it are ordinary jobs, left to complete or cancelled like any other. Memories already evaluated stay evaluated (Invariant 6) — resuming later simply continues where it left off. | None. |

**Standing principle:** every phase is reversible through a flag or a
process toggle, never through a data rollback. The schema in §8 is
purely additive and inert until code reads it — removing it later, if
ever wanted, is unforced housekeeping with no dependency on any
rollback above.

---

## 7. Observability

**Structural requirement, permanent:** every eligibility verdict, of
either `timing`, is logged and persisted with its full
`EligibilityVerdict` shape (§2.1) — never aggregated or discarded
before being recorded. This is Invariant 9 made operational: a system
whose eligibility decisions aren't individually inspectable has
silently stopped being explainable, no matter how good the underlying
mechanism is.

**Evaluation errors (Invariant 10) are their own, separately-observable
event — never folded into a normal verdict.** A system that can't tell
"genuinely decided not eligible" apart from "failed to decide, defaulted
closed" cannot distinguish a correctly-selective mechanism from a
silently-broken one — exactly the ambiguity that let the original
10.3%-recall matcher go unnoticed as long as it did.

**Correlation:** a `synchronous` verdict is logged correlated to the
request that produced it, using this codebase's existing request-id
convention, the same as any other span in that request. A `deferred`
verdict has no such request to correlate to by construction — its
event stands alone, timestamped, tied only to the memory and the
strategy that produced it.

**What must be measurable, on an ongoing basis, not just once:**

- Eligibility rate, decomposable by category and by `timing`.
- Volume of Knowledge Engine work created, over time.
- Conversion rate from "work created" to "knowledge actually
  persisted" — the exact ratio investigation 3 measured once; this
  must stay measurable continuously, not require a one-off audit each
  time someone wants to know it.
- Deferred-strategy budget utilization against its configured bound
  (§2.2) — sustained saturation is a signal worth surfacing, not
  silently absorbed.
- Evaluation error rate (Invariant 10), separately from eligibility
  rate.
- Chat-path latency, specifically the capture-and-eligibility step —
  must show no regression, checked with the same tracing
  infrastructure already built into this codebase.

Specific metric names, dashboards, and alert thresholds are
implementation detail — what's fixed is that all six of the above must
be answerable from recorded data at any time, without re-deriving them
the way today's three investigations had to.

---

## 8. Migration strategy

No migration for `rank_score` itself — mechanism and every consumer
except Knowledge Engine enqueueing are unchanged.

**New schema, additive only, both pieces nullable/no-default so
neither requires a table rewrite on a hot table — same characteristic
`rank_score` itself already has:**

1. On `memories`: a nullable eligibility-verdict record (mirroring the
   existing `rank_score`/`ranked_at` pair in spirit) — `eligible`,
   `categories`, `taxonomyVersion`, `checked_at`, written by the
   **synchronous** strategy. Nullable so existing rows are inert until
   the backfill (Phase 5) runs or the column is naturally populated
   going forward. The system is correct for all new activity the
   moment Phase 1 ships, independent of whether Phase 5 ever runs.
2. A new, append-only table recording every verdict from **both**
   timings (`memory_id`, `life_graph_id`, `checked_at`, `eligible`,
   `categories`, `taxonomy_version`, `timing`) — the durable audit
   trail Invariant 9 requires, and the mechanism a deferred strategy
   uses to know what it has and hasn't already evaluated. `life_graph_id`
   is denormalized onto this table directly rather than requiring a
   join back to `memories` for every tenant-scoped query — the same
   choice `memories` itself already makes, and consistent with how
   seriously this codebase treats LifeGraph isolation elsewhere. A
   **unique constraint on `(memory_id, timing)`** enforces Invariant 6
   at the database, not just in application logic — the same
   `skipLocked`-style claim discipline this codebase already uses
   correctly for `knowledge_jobs` is the required pattern here too,
   specifically to close the race condition an unenforced check-then-
   write would otherwise leave open under concurrent deferred-strategy
   runs.
3. Writing the audit row (point 2) is **deferred, not part of the
   synchronous response path** — it is not needed to make the enqueue
   decision itself, only to record it, so it follows the same
   `after()`-style deferred-write pattern this codebase already uses
   elsewhere for non-critical writes. The `memories`-table verdict
   fields (point 1), by contrast, are written synchronously alongside
   `rank_score` since they gate the enqueue decision directly.
4. Referential behavior: `knowledge_eligibility_checks.memory_id`
   references `memories.id` without cascading delete — this codebase's
   memory lifecycle does not hard-delete (`forget` changes `status`, it
   does not remove the row), and the audit trail is retained regardless
   of a memory's current status, consistent with that same
   never-truly-delete discipline applied elsewhere in this product.

**Interface evolution:** additive changes to `EligibilityVerdict` or
`KnowledgeEligibilityStrategy` (new optional fields) do not require a
new ADR. Removing or renaming a required field does — the same bar as
any other breaking change to a contract this document defines.

No down-migration is ever required to roll back code that stops
writing to either table — see §6.

---

## Reading order for implementation

§0-§4 (Mission through Boundaries) should not change as this gets
built — if implementation reveals one of them needs to change, that's
a signal to revise this ADR deliberately, not to route around it. §5-§8
(Rollout, Rollback, Observability, Migration) are the parts meant to
be executed against directly. §4.4 is the index of everything
intentionally left open — check it before inventing an answer that
belongs somewhere else. §4.4's closing paragraph is the index of what
would retire this ADR entirely, rather than extend it.
