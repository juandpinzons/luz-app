# ADR-0022 Knowledge Relevance Redesign

Status: Proposed — awaiting Founder review\
Date: 2026-08-02 (Revision 2 — critical review pass, same day)\
Owner: Founder (decision), LEOS (proposal)\
Depends on evidence from:
`docs/engineering/investigations/2026-08-02_knowledge_engine_memory_rank_score.md`,
`docs/engineering/investigations/2026-08-02_pipeline_loss_before_ranking.md`,
`docs/engineering/investigations/2026-08-02_knowledge_job_to_insight_conversion.md`
— all three read as prerequisites; this document does not re-derive
their evidence, only designs against it.\
**Nothing in this document has been implemented.** This is a proposal
per `docs/legal/AI_DEVELOPMENT_POLICY.md`'s lifecycle
(Proposal → Technical Evaluation → Human Review → ...) — it moves to
Accepted only on the Founder's explicit decision.

**Revision 2 note:** Revision 1 named a specific mechanism (an "AI
batch triage" job) for the piece of this design that closes the
residual recall gap. That was an implementation decision dressed as an
architecture decision. This revision replaces it with a contract any
mechanism can satisfy — AI, a larger deterministic ruleset, or
something not yet considered — and adds the invariants, ownership
model, budget, backfill plan, observability, rollback, and formal
category definitions needed for another engineer to implement this
without having to make a single architectural judgment call of their
own. Every open question that remains is named explicitly as a
decision for the Founder, not left implicit.

---

## 1. Mission statement — what Knowledge Engine is for

**Knowledge Engine turns memories that reveal something durable about
who a person is into structured, evolving knowledge — Insights backed
by real evidence, Beliefs consolidated from repeated Insights,
Concepts and Contradictions connecting them.** It is not a summarizer
of everything a person says, and it is not a second copy of Memory
Engine's job (Memory Engine already remembers the conversation itself,
completely, unconditionally — that job is done and stays done,
Invariant INV-1 below).

Selectivity is a stated feature of Knowledge Engine, not a defect to
eliminate. Commit `c406ed0` (2026-07-24) introduced a gate for a real
reason: processing every message through an AI-capable pipeline has
real, unbounded cost at scale. **This ADR does not propose removing
selectivity — it proposes fixing the mechanism that decides what gets
selected**, because that mechanism currently has 10.3% recall against
its own stated goal (investigation 1) and, worse, sometimes fails to
examine even the one memory that caused its own job to exist
(investigation 3). Success for this ADR is never "100% of memories
become insights" — it is "the memories that genuinely reveal something
durable actually get a chance, at a cost the business can name in
advance."

---

## 2. Context, in one paragraph

Three independent investigations today measured the same root cause
three times: `DeterministicMemoryRankingStrategy`'s keyword-substring
matcher has 10.3% recall, 100% precision — and that one score,
`rank_score` with threshold 45, is used as a hard gate in three
unrelated places (Knowledge Engine enqueueing, Memory Connection
candidacy, and the `RealitySnapshot` that `DefaultExtractStage` reads
from — which silently defeats `focusMemoryId`'s own stated promise to
guarantee a memory's examination). The Extract→Generate→Validate→
Persist pipeline itself is not lossy — it succeeded 100% of the time
in every case that reached it (N=4, full available population, not a
sample). The system is not leaking information inside its pipeline; it
is starving the pipeline at its door.

## 3. The design problem, stated precisely

`rank_score` answers three questions with one number:

1. "Is this memory worth connecting to other memories right now?"
   (cheap, synchronous, low-stakes if wrong)
2. "Is this memory worth the cost of a Knowledge Engine job?" (an
   economic/scale question)
3. "Should the specific memory that triggered a job actually be looked
   at?" (this should never have been a question — a job exists
   *because* the system already decided to look)

One score, one threshold, three questions with different stakes and
different acceptable error rates. The fix is not "a better score" — a
purely lexical matcher has a real recall ceiling regardless of list
size (investigation 1: several false negatives, e.g. "Trabajador,
asertivo, soñador...", have no lexical anchor at all). The fix is
**separating the three questions, giving each its own owner and its
own contract, and making question 3 stop being asked.**

---

## 4. Architectural invariants

These hold regardless of implementation choice. Any future change —
including implementations of the contracts defined in Section 6 — must
preserve every one of these. A change that requires violating an
invariant is a new ADR, not an extension of this one.

- **INV-1 (Memory completeness).** Every user message becomes exactly
  one `Memory`, unconditionally, synchronously, regardless of content.
  Already true today (investigations 2 & 3 measured 0% loss here) —
  this ADR must not regress it.
- **INV-2 (Hot-path AI-free).** No step inside `MemoryEngine.capture()`'s
  synchronous call graph makes an external network/AI call. Protects
  chat latency — the same request path this session already reduced
  latency on earlier today.
- **INV-3 (Single-purpose gates).** No single score or decision may
  govern two consumers whose acceptable-error-rate or cost profile
  differ, without an explicit, separately-named, separately-owned
  decision per consumer. This is the root lesson of today's three
  investigations, stated as a standing rule so the same bug class
  can't recur under a different name.
- **INV-4 (Triggered-memory guarantee).** A memory passed as
  `focusMemoryId` into `assembleRealitySnapshot` is always present in
  `snapshot.memory.items`, regardless of any relevance or eligibility
  filter applied to other candidates in that snapshot.
- **INV-5 (Async isolation).** Knowledge Engine processing — Extract
  through Persist, and any eligibility evaluation beyond the primary
  synchronous check (Section 6.3) — never executes inside a
  request/response cycle a user is waiting on.
- **INV-6 (Idempotent evaluation).** Re-evaluating a memory's
  eligibility, or re-running Extract/Generate/Validate for a memory,
  never creates duplicate evidence, duplicate insights, or inflates
  confidence without genuinely new evidence. This codebase has a real,
  documented incident of exactly this failure mode
  (`enrich-knowledge-graph.ts`'s own comments) — the guard pattern
  already established there (check for existing evidence, not a
  status flag that can drift from real data) is the required pattern
  for any new evaluation pathway too.
- **INV-7 (Bounded resource consumption).** Any eligibility strategy
  beyond the primary, free, synchronous one operates within an
  explicit, enforced, per-period volume cap (Section 11). No
  unconditional per-memory evaluation by a secondary strategy, ever,
  regardless of mechanism.
- **INV-8 (Deterministic primary path).** The primary eligibility
  decision — the one gating real-time enqueueing — is deterministic
  and side-effect-free: same input always produces the same output, no
  network calls, testable as a pure function.
- **INV-9 (Explainability).** Every eligibility verdict carries a
  reason (a category, Section 6.2), never a bare boolean. Matches the
  explainability principle already standing for every other engine in
  this codebase.

---

## 5. Ownership: Memory Engine vs. Knowledge Engine

```
┌─────────────────────────┐         ┌──────────────────────────────┐
│      Memory Engine        │         │       Knowledge Engine          │
│                            │         │                                  │
│  Memory entity             │◄────────│  reads Memory (type only)        │
│  Classification             │         │  KnowledgeEligibilityStrategy    │
│  rank_score (relevance)     │         │  Extract → Classify → Relate →   │
│  Capture/Connect/Archive/   │         │  Generate → Validate → Persist   │
│  Forget lifecycle           │         │  Insight/Belief/Concept/          │
│                            │         │  Contradiction                   │
└─────────────────────────┘         └──────────────────────────────┘
              ▲                                      ▲
              │                                      │
              └──────────────┬───────────────────────┘
                              │
                    Orchestration layer
              (today: features/chat/services/send-message.ts;
               any future caller must follow the same rule)
```

**Rules, both directions enforced, not just stated:**

- Memory Engine (`core/memory-engine`) never imports from Knowledge
  Engine (`core/knowledge-engine`). It has no concept of eligibility,
  insights, or jobs.
- Knowledge Engine may depend on Memory Engine's public types
  (`Memory`, read access via `MemoryRepository`) but never reaches
  into Memory Engine's internals or triggers Memory Engine behavior.
- **Eligibility is Knowledge Engine's decision, not Memory Engine's.**
  `KnowledgeEligibilityStrategy` (Section 6) lives at
  `core/knowledge-engine/eligibility/` — it asks "should *my* pipeline
  run," which is Knowledge Engine's own question about itself, not a
  property of the Memory. This is why it must not be modeled as
  another field on `Memory` the way `rank_score` is (Section 6.1
  explains the interface consequence).
- The **orchestration layer** — never either engine itself — is the
  only code allowed to know about both engines and call them in
  sequence (capture, then decide eligibility, then maybe enqueue).
  Today that's `send-message.ts`; if a second caller ever needs this
  sequence (e.g., a future bulk-import path), it must follow the same
  rule rather than either engine reaching into the other directly.

This mirrors ADR-0002 (Domain Isolation)'s existing one-directional
dependency discipline — nothing new is being introduced, only applied
to a boundary that was previously blurred (`rank_score`, a Memory
Engine field, was being read as if it were a Knowledge Engine
decision).

---

## 6. The eligibility contract

### 6.1 Interface

Deterministic decision, not a score — the interface makes this
structurally true, not just documented as a convention:

```ts
// core/knowledge-engine/eligibility/eligibility-strategy.ts

export type EligibilityCategory =
  | "life_transition"
  | "important_decision"
  | "revealed_value"
  | "vulnerability"
  | "emotional_turning_point"
  | "relationship_change"
  | "personal_growth"
  | "recurring_struggle"
  | "long_term_aspiration"
  | "life_achievement";

export type EligibilityMethod = "primary" | "secondary";

export interface EligibilityVerdict {
  /** Derived, never set independently of `categories` -- eligible iff categories.length > 0. */
  readonly eligible: boolean;
  /** Every category that applied. Empty array, never null/undefined, when nothing matched. */
  readonly categories: readonly EligibilityCategory[];
  /** Which strategy produced this verdict -- for audit trails, never for branching logic. */
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

No implementation detail appears in this contract — no mention of
keywords, prompts, models, or AI. Anything satisfying this interface
is a legal `KnowledgeEligibilityStrategy`: a lexical matcher, a bigger
deterministic rule engine, a call to a language model, a human-in-the-
loop review queue. **The architecture does not choose the mechanism —
Section 6.3 and 6.4 constrain what properties each *role* (primary vs.
secondary) must have; which mechanism satisfies those properties is an
implementation decision for whoever builds it**, made against the
constraints below, not against this document's silence.

Why `eligible` is derived and not an independently-settable field:
a strategy cannot report `eligible: true, categories: []` — the type
alone prevents the exact failure mode this ADR exists to fix
(a boolean gate detached from any inspectable reason).

### 6.2 Formal eligibility categories

Ten categories, semantic definitions only — deliberately independent
of how any strategy detects them, so the taxonomy survives a
mechanism change untouched. Nine were already implicit in
`DeterministicMemoryRankingStrategy`'s existing `UNDERSTANDING_SIGNALS`;
the tenth (`life_achievement`) is new, added because investigation 1's
benchmark found real content it has no category for (a life
achievement the user explicitly asked to be remembered).

| Category | Definition |
|---|---|
| `life_transition` | An irreversible change in life circumstances — moving, marriage, separation, a new job, a birth, a death. |
| `important_decision` | A deliberate, real choice being made or reported — not an event merely happening to the person. |
| `revealed_value` | A first-person statement of what matters to the person — a priority declared as a priority, not implied. |
| `vulnerability` | Candid, self-initiated disclosure of struggle, fear, or difficulty. |
| `emotional_turning_point` | A moment the person identifies as having changed their perspective or feelings — the identification itself is required, not just a triggering event. |
| `relationship_change` | A shift, rupture, or repair in the state of a specific relationship. |
| `personal_growth` | Self-reported development of a skill, insight, or capacity over time. |
| `recurring_struggle` | A pattern the person explicitly self-identifies as recurring *within this memory* — never inferred by comparing this memory to others (that comparison is Knowledge Engine's own downstream job, not eligibility's). |
| `long_term_aspiration` | A stated goal or wish oriented beyond the immediate moment. |
| `life_achievement` | A completed accomplishment the person identifies as worth remembering, regardless of when it occurred. |

A memory with zero matching categories is not an error state — it is
the expected, common, correct outcome for most captured content
(consistent with the mission statement, Section 1: selectivity is the
point). `categories: []` and `eligible: false` is success, not
failure, for the majority of memories.

**Changing this table** (adding, removing, or redefining a category)
is a decision at the same level as this ADR, not an implementation
detail — it changes what "durable" means for the whole system and
should go through the same evidence-based process
(`docs/engineering/TECHNICAL_INVESTIGATION_METHODOLOGY_V1.md`) that
found the tenth category in the first place.

### 6.3 Primary strategy — required properties

The instance of `KnowledgeEligibilityStrategy` that runs synchronously
at capture time and gates real-time `knowledge_job` creation. Must:

- Satisfy INV-2 and INV-8 (no network calls, deterministic, pure).
- Return within the same latency budget as `DeterministicMemoryRankingStrategy`
  today (effectively instant — no measurable addition to `MemoryEngine.capture()`'s
  own latency).
- Be swappable without touching any caller — callers depend on the
  interface (Section 6.1), never on a concrete class.

**Not specified here:** the exact technique. A materially expanded,
better-conjugated version of today's lexical approach is one valid
implementation and is the one referenced throughout the Rollout
section as the concrete near-term plan — but the contract does not
require it to stay lexical forever. Whoever implements this should
treat "expand the lexical list" as the default, obvious, low-risk
starting choice, not as an architectural mandate.

### 6.4 Secondary strategy — required properties

A second, independently-configured instance of the *same*
`KnowledgeEligibilityStrategy` interface, invoked outside the request
path (INV-5), specifically over memories the primary strategy already
marked ineligible. Must:

- Satisfy INV-6 and INV-7 (idempotent, budget-bounded — Section 11).
- Produce verdicts tagged `method: "secondary"`, never silently
  conflated with primary verdicts in any downstream metric (Section
  14 depends on this distinction being real in the data).
- Never run against a memory more than once, absent an explicit,
  logged re-evaluation decision (the tracking mechanism is Section 9's
  `knowledge_eligibility_checks` table).

**Not specified here either:** whether this is AI-based, a larger
deterministic model, or something else. This is the piece of the
system explicitly expected to close the recall gap the primary
strategy structurally cannot (true paraphrase with no lexical anchor)
— but *how* it does that is an implementation decision, to be made
with the Founder's input at the point it's actually built (Rollout
Phase 3), informed by real shadow-mode data from Phase 1-2, not
pre-decided here.

---

## 7. The role of `rank_score`, explicitly

| Consumer (today) | Uses `rank_score`? | After this design |
|---|---|---|
| Knowledge Engine enqueueing (`send-message.ts`) | Yes, hard gate ≥45 | **No** — replaced by the primary `KnowledgeEligibilityStrategy` (Section 6.3) |
| `assembleRealitySnapshot`'s memory filter (feeds `DefaultExtractStage`) | Yes, same gate | **No**, for the focused memory (Section 8, INV-4) — still used to rank/select the *other*, non-triggering candidates in that snapshot |
| `DefaultConnectStage.samePersonMatches` | Yes, ≥45 | **Unchanged** — exactly the low-stakes, synchronous use `rank_score` remains suited for |

`rank_score` becomes, explicitly and only, a same-turn relevance
signal for cheap synchronous decisions where a false negative is
recoverable (Memory Connection candidacy today; nothing else without
new evidence, per INV-3). It is never again a proxy for "is this worth
Knowledge Engine's attention."

---

## 8. How `focusMemoryId` should behave

Direct implementation of INV-4. Today, `focusedMemory` is prepended to
`relevantMemories`, and the *entire combined list* then passes through
the `rank_score >= 45` filter together — silently un-doing the
guarantee. The fix: filter only the non-focused candidates by
`rank_score`; re-attach the focused memory afterward, unconditionally.
`RELEVANT_MEMORY_LIMIT` (5) still caps the total window; the focused
memory never competes for its own guaranteed slot.

Independently valuable and independently shippable — the cheapest
correct fix to the single sharpest finding across all three
investigations (Rollout Phase 0).

---

## 9. Migration strategy

No migration for `rank_score` — mechanism and consumers other than
Knowledge Engine enqueueing are unchanged.

**New schema, additive only:**

1. `memories.knowledge_eligible: boolean | null`,
   `memories.knowledge_eligible_categories: text[] | null`,
   `memories.knowledge_eligibility_checked_at: timestamp | null` —
   mirrors the existing `rank_score`/`ranked_at` pair, written by the
   **primary** strategy at capture time. Nullable so existing rows are
   inert until the backfill (Section 10) runs or the column is
   naturally populated going forward — the system is correct for all
   new activity the moment this ships, with zero backfill required.
2. New table `knowledge_eligibility_checks`
   (`id`, `memory_id`, `checked_at`, `eligible: boolean`,
   `categories: text[]`, `method: 'primary' | 'secondary'`) — the
   append-only audit log both strategies write to, and the mechanism
   the secondary strategy uses to know what it has and hasn't already
   evaluated (`select 1 from knowledge_eligibility_checks where
   memory_id = ? and method = 'secondary'`). Deliberately a separate
   table, not a column on `memories` — this is Knowledge Engine's own
   bookkeeping (Section 5), and every verdict (not just the latest)
   is kept, satisfying INV-9 as a queryable history, not just a
   point-in-time field.

No down-migration is ever required to roll back code that stops
writing to these — see Section 13.

---

## 10. Historical data / backfill strategy

The 97.8% of the Founder's own history (and the equivalent gap
system-wide) that never got a fair primary-strategy evaluation stays
exactly as it is unless this backfill runs. It is **not required for
correctness** — new memories are handled correctly the moment Phase 2
ships — but it is required to close the gap retroactively, and is
specified fully here so it isn't a judgment call at implementation
time.

**Scope:** every `Memory` where `knowledge_eligibility_checked_at is
null` (i.e., captured before the primary strategy existed, or before
this specific memory was otherwise evaluated).

**Ordering:** newest-first. A person's most recent memories are the
ones most likely to still be actionable/relevant to who they are
today; oldest memories are the lowest-priority catch-up, not the
highest.

**Batching:** a scheduled job, same cron infrastructure pattern as
`/api/cron/knowledge-worker`, processing a fixed batch size per
invocation (proposed default: 500 memories/run — the primary strategy
is free and fast, so this is bounded by wall-clock/DB load, not cost;
adjust based on real run-time observed in the first execution, not
guessed in advance). Runs until the backlog (memories with
`knowledge_eligibility_checked_at is null`) is exhausted, then stops
automatically (no ongoing schedule needed once caught up — new
memories are already covered by the synchronous primary check).

**On `eligible: true`:** enqueue a `knowledge_job` exactly as the
live path does. This means the backfill can produce a real burst of
new job creation — expected and acceptable, since the primary
strategy stays free (INV-8), but worth flagging so whoever runs it
isn't surprised by a spike in `knowledge_jobs` volume the first time
it executes (the existing worker already processes jobs at its own
pace; a burst is a queue depth increase, not a correctness risk).

**Explicitly deferred, not required to ship with Phase 2:** running
the backfill is its own follow-up, sequenced after Phase 2 is live and
validated (Section 12), never before.

---

## 11. Resource budget

Mechanism-agnostic — expressed as **evaluation volume**, not
currency, so the constraint holds regardless of what satisfies the
secondary strategy's contract (Section 6.4).

- **Primary strategy:** no budget needed. INV-8 guarantees it's free;
  it runs on every captured memory unconditionally, same as
  `rank_score` does today.
- **Secondary strategy:** `EligibilityBudget { maxEvaluationsPerPeriod:
  number; periodMs: number }`, enforced by whatever job invokes it —
  never by the strategy implementation itself (the strategy must stay
  ignorant of budget; the caller stops calling it once the period's
  cap is spent, so the same strategy is trivially reusable in a
  different budget context later, e.g. a paid tier).
- **Proposed starting default: 200 evaluations / 24h.** Reasoning, not
  a guess: system-wide real volume measured today across all 17 real
  users is 285 total messages over roughly 2.5 weeks (investigation
  2) — a fraction of this cap even at the system's current total
  historical volume, so it will not bind during Alpha. Generous enough
  to be genuinely useful once Phase 3 pilots on real data, bounded
  enough that a mechanism decision made later (Section 6.4) can't
  produce a surprise bill. **This number is the Founder's to accept,
  reject, or change** — it is a reasoned starting point, not a
  derived optimum; no real cost-per-evaluation data exists yet because
  no mechanism has been chosen.
- **Cap-exceeded behavior:** remaining candidates in that period are
  left `knowledge_eligibility_checked_at is null` for the secondary
  strategy specifically (primary-strategy data, if any, is untouched)
  and picked up in the next period — never dropped permanently, never
  silently skipped without being retryable.

---

## 12. Rollout plan

Staged, smallest-and-safest first. Each phase ships as its own PR,
each is independently valuable, and Section 13 gives the exact
rollback for each.

- **Phase 0 — `focusMemoryId` exemption (Section 8).** Zero new
  schema, zero new capability. Validate: investigation 3's memory-ID
  cross-set check, re-run — the triggering memory of every new job
  now appears in the snapshot regardless of its own `rank_score`.
- **Phase 1 — primary strategy, shadow mode.** Ship the primary
  `KnowledgeEligibilityStrategy` implementation, write
  `knowledge_eligible`/`categories`/`checked_at` for every new memory,
  **do not yet gate enqueueing with it** — `rank_score >= 45` keeps
  controlling real job creation. Produces a live, real head-to-head
  comparison dataset before anything user-facing changes.
- **Phase 2 — primary strategy live.** Behind a config flag
  (`KNOWLEDGE_ELIGIBILITY_GATE=legacy_rank_score|primary_strategy`,
  default `legacy_rank_score` until flipped), switch the enqueue check
  in `send-message.ts` to the primary strategy's verdict. Flip only
  after shadow data (Phase 1) is reviewed against the success bar in
  Section 14.
- **Phase 3 — secondary strategy, pilot.** Mechanism chosen at this
  point (Section 6.4), built against the same interface, run only
  against the Founder's own account first (richest real dataset,
  already the benchmark population in all three investigations —
  directly comparable results). Confirm budget adherence (Section 11)
  and the secondary strategy's own precision/recall against a fresh,
  independently-classified sample before widening.
- **Phase 4 — secondary strategy, general availability.** Only after
  Phase 3's pilot numbers are reviewed and explicitly accepted.
- **Phase 5 — historical backfill (Section 10).** Sequenced after
  Phase 2 is live and validated; independent of Phase 3/4.

---

## 13. Rollback strategy

| Phase | Rollback mechanism | Data cleanup needed |
|---|---|---|
| 0 | Revert the code change (single, isolated diff). | None. |
| 1 (shadow) | Stop the shadow computation, or simply ignore its output — production behavior is already unaffected by construction. | None required; columns can stay populated and unused. |
| 2 (live) | Flip `KNOWLEDGE_ELIGIBILITY_GATE` back to `legacy_rank_score` — no deploy required if the flag is read at request time from config/env. | None — `rank_score`-based enqueueing resumes exactly as it works today. |
| 3 (pilot) | Disable the secondary job's cron trigger / feature flag for the pilot account. | None — pilot only ever affected one account's job queue, nothing structural. |
| 4 (GA) | Same flag as Phase 3, scope narrowed back to disabled or pilot-only. | None. |
| 5 (backfill) | Stop the backfill cron; already-enqueued `knowledge_jobs` from it are ordinary jobs and can be left to complete or cancelled like any other. | None — no schema rollback needed. |

**General principle:** every phase is reversible via a flag or a
process toggle, never via a data rollback. The two new schema pieces
(Section 9) are purely additive and inert until code reads them —
dropping them, if ever desired, is a housekeeping migration with no
urgency and no dependency on any rollback above.

---

## 14. Observability and success metrics

### Observability (continuous, not one-time)

New structured log event, every verdict, both strategies:
`knowledge.eligibility.decided` — `memoryId`, `eligible`, `categories`,
`method` (`primary`/`secondary`), `latencyMs`. Same `logger.log`
pattern already used throughout this codebase — console-visible,
correlatable by `requestId` where applicable.

Aggregate metrics, queryable the same way this session's three
investigations queried production directly (no new dashboard required
to ship this ADR, though one could be built later):

- Eligibility rate by category, primary vs. secondary contribution
  split.
- `knowledge_jobs` created per day (system-wide and per-account).
- % of completed jobs producing ≥1 insight (the exact metric
  investigation 3 measured at 4.9% baseline).
- Secondary strategy budget utilization (% of the Section 11 cap
  consumed per period) — a sustained 100% is a real signal (either
  recall is still insufficient or real volume grew), worth a visible
  flag even without formal alerting infrastructure yet.

### Success metrics, concrete and falsifiable

- **Primary strategy (before Phase 2 flips):** re-run the exact E1
  benchmark methodology (179-item real benchmark, blind independent
  classification) against the primary strategy. Proposed bar: recall
  materially above the 10.3% baseline while precision stays high
  (starting target: recall ≥ 40%, precision ≥ 90% — a reasoned
  starting bar, not a guarantee; the reviewer of the actual re-run
  numbers makes the final call, informed by real results).
- **System-level, after Phase 2:** jobs→insight conversion rate rises
  materially above the 4.9% baseline; `knowledge_jobs` created/day
  returns to a healthy, non-zero, budget-bounded rate.
- **Latency, ongoing:** zero regression in chat response latency —
  checked with the same `core/observability/trace.ts` instrumentation
  already built this session, specifically the `Memory.capture` span.
- **Correctness, ongoing:** zero new duplicate-evidence incidents
  (INV-6) — checked the same way the original incident was found
  (repeated `belief_evidence`/`concept_evidence` rows for the same
  insight).
- **Phase 3 pilot:** the secondary strategy's own precision/recall,
  measured the same way as the primary's, before Phase 4 widens scope.

---

## 15. Risks

- **Cost** — mitigated by Section 11's enforced, mechanism-agnostic
  budget and the Founder-account-first pilot (Phase 3).
- **Idempotency regressions** — mitigated by INV-6 and the append-only
  `knowledge_eligibility_checks` audit table (Section 9), same pattern
  as the existing, working guard in `enrich-knowledge-graph.ts`.
- **Scope creep into a new engine** — addressed directly in Section
  16; still flagged here as the one judgment call most worth the
  Founder's own read before Phase 3 specifically.
- **Unknown other consumers of `rank_score`.** This design's Section 7
  table is built from the three consumers found across today's three
  investigations. Per the Founder's explicit "do not investigate
  further" instruction during the investigation phase, no exhaustive
  codebase search was performed to guarantee completeness — **required
  before Phase 2 ships**: a full search for `rank_score`/`rank?.score`
  usages, to confirm Section 7 is complete, not assumed complete from
  this document.
- **Primary strategy's ceiling is real, not fully solved by Phase 2
  alone.** True paraphrase with no lexical anchor stays uncaught until
  the secondary strategy (Phase 3+) reaches that memory. Restated here
  so Phase 2 is never mistaken for a complete fix — Section 1's
  mission statement already frames why that's an acceptable, honest
  intermediate state, not a hidden gap.

---

## 16. Compatibility with Architecture V1 (ADR-0018)

Nothing in this design stands up a new `core/*-engine`:

- The primary strategy is a new *strategy implementation* inside the
  existing `core/knowledge-engine` module — the same pattern
  `MemoryRankingStrategy`/`InsightValidationStrategy` already
  establish. Ordinary engineering inside an engine that already
  exists, which ADR-0018 explicitly does not gate.
- The secondary strategy, whatever mechanism eventually satisfies it,
  is a new job and a new audit table — operational infrastructure
  around the existing Knowledge Engine pipeline, calling the same
  `enqueueKnowledgeJob`/`knowledge_jobs` machinery that already
  exists. It introduces no new domain, no new entity type, no new
  bounded context.

**This reading is offered, not assumed final.** It is the risk in
Section 15 most worth the Founder's explicit confirmation — specifically
before Phase 3, once a real mechanism is on the table to evaluate
against ADR-0018's actual test ("can this be resolved with the
architecture we have"), not in the abstract now.

---

## 17. Open questions for the Founder

Named explicitly so implementation never has to guess:

1. Is the Section 11 starting budget (200 secondary-evaluations/24h)
   acceptable, or should it start lower/higher?
2. Does the secondary strategy's mechanism (Section 6.4) need Founder
   sign-off before Phase 3 begins, or is "satisfies the contract,
   stays within budget" sufficient authority to proceed?
3. Does Phase 3's secondary-strategy mechanism, once chosen, need its
   own ADR-0018 exception request, or does Section 16's reasoning
   already cover it?
4. Is the Section 14 starting success bar (recall ≥ 40%, precision ≥
   90%) the right bar, or should Phase 2's go/no-go use different
   numbers once real shadow-mode data exists?
