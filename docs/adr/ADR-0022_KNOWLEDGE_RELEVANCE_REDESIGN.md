# ADR-0022 Knowledge Relevance Redesign

Status: Proposed — awaiting Founder review\
Date: 2026-08-02\
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

---

## Context, in one paragraph

Three independent investigations today measured the same root cause
three times: `DeterministicMemoryRankingStrategy`'s keyword-substring
"understanding signal" matcher has 10.3% recall (100% precision) — and
that one score, `rank_score` with threshold 45, is currently used as
a hard gate in three unrelated places (Knowledge Engine enqueueing
since commit `c406ed0`, Memory Connection candidacy, and — the
sharpest finding — the `RealitySnapshot` that `DefaultExtractStage`
reads from, which silently defeats `focusMemoryId`'s own stated
promise to guarantee a memory's examination). The Extract→Generate→
Validate→Persist pipeline itself is not lossy — it succeeded 100% of
the time in every case that reached it. The system is not leaking
information inside its pipeline; it is starving the pipeline at its
door.

## The design problem, stated precisely

`rank_score` is being asked to answer three different questions with
one number:

1. "Is this memory worth connecting to other memories right now?"
   (cheap, synchronous, low-stakes if wrong — a missed connection is
   recoverable later)
2. "Is this memory worth the cost of a Knowledge Engine job?" (an
   economic/scale question — real OpenAI spend, the reason `c406ed0`
   introduced a gate in the first place)
3. "Should the specific memory that triggered a job actually be looked
   at?" (this should never have been a question at all — a job exists
   *because* the system already decided to look)

One score, one threshold, answering three questions with different
stakes and different acceptable error rates is the design defect.
The fix is not "a better score" — recall of a purely lexical matcher
has a real ceiling (established in investigation 1: several false
negatives, e.g. "Trabajador, asertivo, soñador...", have no lexical
anchor at all, however large the phrase list grows). The fix is
**separating the three questions**, answering each at the stakes it
actually carries, and making question 3 stop being asked at all.

---

## 1. The new relevance strategy

Three layers, replacing the single overloaded gate. None of the three
requires a new `core/*-engine` — see Section 7 (Architecture V1
compatibility) for why.

### Layer 1 — `rank_score` (kept, unchanged mechanism)

`DeterministicMemoryRankingStrategy` does not change. Same 70-phrase
matcher, same deterministic computation, same synchronous execution
inside `MemoryEngine.capture()`, same "no AI on purpose" philosophy
the file already declares. Its **role narrows**: it stops being a
gate for Knowledge Engine work entirely (Section 2). It keeps serving
what it's cheap enough and low-stakes enough to serve: Memory
Connection candidacy (`DefaultConnectStage.samePersonMatches`) and any
future same-turn, synchronous use where a false negative costs little
because the memory remains connectable on a later pass.

**Why not replace Layer 1's mechanism itself:** it runs inside the
chat's hot path (`send-message.ts` → `MemoryEngine.capture()`), the
exact request path whose latency this session already worked to
reduce earlier today. Adding an AI call here reintroduces the kind of
regression that work fixed. Keeping Layer 1 cheap and synchronous is
a constraint worth protecting, not a limitation to engineer around.

### Layer 2 — `KnowledgeEligibilityStrategy` (new, still deterministic, still cheap)

A new, small strategy interface — same shape as `MemoryRankingStrategy`
— whose only question is "should this memory become a
`knowledge_job`." Proposed home: `core/knowledge-engine/eligibility/`
(the question belongs to Knowledge Engine, not Memory Engine — it's
about whether *its* pipeline should run, not about the memory's
intrinsic rank).

First implementation, `DeterministicKnowledgeEligibilityStrategy`: an
**expanded** version of today's lexical approach — more phrase
variants, more conjugations, and critically, a new category the
investigation found missing entirely: **life achievement** (the
military-service example from investigation 1's benchmark — "quiero
que lo anotes como Logro" — doesn't fit any of the current 9
categories). Still deterministic, still synchronous-safe, still cheap
enough to run in the hot path if needed — but this is a genuinely
different question than Layer 1's, evaluated independently, not
derived from `rank_score`.

Recall ceiling still applies here — an expanded lexical list will not
catch true paraphrase. That gap is Layer 3's job, deliberately, so
Layer 2 doesn't have to solve it under hot-path cost constraints.

### Layer 3 — async batch AI triage (new capability, the one genuinely new piece)

A scheduled job (new cron, sibling to the existing
`/api/cron/knowledge-worker`), running on a fixed cadence with a
**hard cap per run** (bounded OpenAI spend, not unconditional), that:

1. Selects memories where Layer 2 said "no" and that have never been
   triaged by this job before (tracking mechanism in Section 4).
2. Runs one cheap, narrowly-scoped AI classification per memory —
   *not* a full insight-generation call, just "does this deserve
   Knowledge Engine's attention, yes or no" — small prompt, short
   completion, cheapest model that gives reliable results.
3. For "yes" verdicts, enqueues a `knowledge_job` exactly like today's
   path does — from that point on, the existing Extract→Persist
   pipeline (already measured at 100% success given real input)
   handles it unchanged.

This is where determinism is deliberately traded for recall — but
only for the residual gap Layer 2 can't close, only in a background
job invisible to any user-facing latency, and only within a spend
budget set in advance. It is the only layer that introduces variance
or AI-driven judgment into what "worth remembering" means — contained
here, on purpose, not spread across the hot path.

---

## 2. The role of `rank_score`, explicitly

| Consumer (today) | Uses `rank_score`? | After this design |
|---|---|---|
| Knowledge Engine enqueueing (`send-message.ts`) | Yes, hard gate ≥45 | **No** — replaced by `KnowledgeEligibilityStrategy` (Layer 2) |
| `assembleRealitySnapshot`'s `memoriesWithRealSignal` (feeds `DefaultExtractStage`) | Yes, same gate | **No**, for the focused memory (Section 3) — still used to rank/select the *other*, non-triggering candidates shown alongside it |
| `DefaultConnectStage.samePersonMatches` | Yes, ≥45 | **Unchanged** — this is exactly the low-stakes, synchronous use `rank_score` remains well-suited for |

`rank_score` becomes, explicitly and only, **a same-turn relevance
signal for cheap synchronous decisions where a false negative is
recoverable.** It is no longer a proxy for "is this worth Knowledge
Engine's attention" anywhere in the system. If a future consumer wants
to use it as a hard gate again, that should require the same kind of
evidence this ADR is built on — not silent reuse because the field
happens to already exist on `Memory`.

---

## 3. How `focusMemoryId` should behave

**New rule, unconditional: a memory passed as `focusMemoryId` is
never subject to any relevance/eligibility filter downstream of the
call that set it.** The existence of a `knowledge_job` (or any future
caller passing `focusMemoryId`) already *is* the eligibility decision
— re-applying a relevance filter to it is asking the same question
twice and getting a different, wrong answer the second time, which is
exactly the bug investigation 3 found.

Concretely, in `assembleRealitySnapshot`: today, `focusedMemory` is
prepended to `relevantMemories`, and then the *entire combined list*
(focused + candidates) passes through the `rank_score >= 45` filter
together. The fix: filter only the non-focused candidates by
`rank_score`; re-attach the focused memory afterward, unconditionally,
regardless of its own rank. `RELEVANT_MEMORY_LIMIT` (5) still caps the
total window, but the focused memory never competes for its own
guaranteed slot.

This is a narrow, mechanical change, independently valuable even if
Layers 2 and 3 above are never built — it is the cheapest possible
fix to the sharpest single finding across all three investigations,
and it can ship on its own (see Rollout, Phase 0).

---

## 4. Migration strategy

No migration required for Layer 1 — `rank_score`/`ranked_at` already
exist, computation doesn't change, only its consumers change.

**New schema, additive only, two pieces:**

1. `memories.knowledge_eligible: boolean | null`,
   `memories.knowledge_eligibility_checked_at: timestamp | null` —
   mirrors the existing `rank_score`/`ranked_at` pair. Computed by
   Layer 2 at capture time (cheap, synchronous, same moment as
   ranking). Nullable so existing rows are unaffected until
   backfilled or naturally re-evaluated; no backfill is required for
   the system to function — new memories get a real value going
   forward, which is sufficient to fix the bug for all new activity
   immediately.
2. New table `knowledge_eligibility_checks` (`memory_id`, `checked_at`,
   `eligible: boolean`, `method: 'lexical' | 'ai_batch'`) — Layer 3's
   tracking mechanism, so the batch job never re-triages a memory it
   already rejected. Kept separate from `memories` deliberately (same
   domain-isolation discipline as the rest of this codebase — Layer
   3's bookkeeping is Knowledge Engine's concern, not Memory Engine's
   table).

**Optional, not required for correctness:** a one-time backfill pass
that runs Layer 2 (cheap, deterministic — safe to run in bulk) against
all historical memories that never triggered a job, so the existing
gap (2.2% of the Founder's own history) closes retroactively instead
of only going forward. This is cheap enough to be low-risk, but it is
explicitly optional and should not block shipping Layers 1-2's
forward-looking fix.

---

## 5. Rollout plan

Staged, smallest-and-safest first — each phase independently valuable,
none blocks the next from being deferred if priorities shift.

**Phase 0 — `focusMemoryId` exemption (Section 3).** Smallest possible
change, fixes the sharpest finding, zero new schema, zero new
capability. Ship first, alone, verified against the same E2 cross-set
check investigation 3 already ran (confirm the gap closes: the
triggering memory of every new job now appears in `snapshot.memory.items`
regardless of its own rank).

**Phase 1 — Layer 2, shadow mode.** Ship
`DeterministicKnowledgeEligibilityStrategy`, compute and persist
`knowledge_eligible` for every new memory, **but do not yet use it to
gate enqueueing** — the existing `rank_score >= 45` check keeps
controlling real job creation during this phase. This produces a real,
live, head-to-head comparison dataset (how often would Layer 2 have
said yes where `rank_score` said no) before anything user-facing
changes.

**Phase 2 — Layer 2 goes live.** Once shadow data confirms Layer 2's
recall improvement is real (re-run the E1 benchmark methodology
against shadow-mode production data, not just the original 179-item
set), switch `send-message.ts`'s enqueue check from `rank_score >= 45`
to `KnowledgeEligibilityStrategy`. `rank_score` itself is untouched;
only the enqueue call site changes.

**Phase 3 — Layer 3, pilot.** Ship the batch catch-up job disabled by
default, enable it first only for the Founder's own account (the
richest real dataset available, and the one already used as the
benchmark population in all three investigations — same account,
directly comparable results). Confirm cost stays within the configured
cap and the triage call's own precision/recall against a fresh,
independently-classified sample before widening.

**Phase 4 — Layer 3, general availability.** Only after Phase 3's pilot
numbers are reviewed and accepted.

Each phase is a separate, small PR — consistent with this project's
standing small-PR discipline, and each is independently revertible
without touching the phases before it.

---

## 6. Risks

- **Cost.** Any recall increase increases real OpenAI spend somewhere.
  Layer 2 stays free (no AI). Layer 3 is the actual cost exposure —
  mitigated by the hard per-run cap in Section 1 and the phased,
  Founder-account-first pilot in Section 5. This number should be
  chosen explicitly by the Founder before Phase 3, not inferred.
- **Reintroducing the idempotency bug class.** This exact codebase has
  a documented history (referenced in `enrich-knowledge-graph.ts`'s
  own comments) of reprocessing causing duplicated evidence and
  inflated confidence when a job is re-run. Layer 3's
  `knowledge_eligibility_checks` table exists specifically to prevent
  this pattern recurring in a new pathway — must be respected from the
  first line of Layer 3's implementation, not retrofitted after an
  incident.
- **Scope creep into a new engine.** Layer 3 is the piece most likely
  to be read as "a new capability" in the ADR-0018 sense. Section 7
  argues it isn't one — but this is exactly the kind of judgment
  ADR-0018 says shouldn't be assumed by silence. Flagged explicitly
  for the Founder's read, not decided unilaterally here.
- **Unknown other consumers of `rank_score`.** This design narrows
  `rank_score`'s intended role based on the three consumers found
  across today's investigations. Per the Founder's explicit
  instruction, no further investigation was done to exhaustively
  re-confirm there are no others — this should be verified at
  implementation time (a full-codebase search for `rank_score`/
  `rank?.score` usages), not assumed complete from this document.
- **Layer 2's ceiling is real, not fully solved.** Even after Phase 2,
  pure paraphrase without any lexical anchor still won't be caught
  until Layer 3 reaches that account/that memory. This is a known,
  accepted gap by design (Section 1), not an oversight — worth
  restating so Phase 2 isn't mistaken for a complete fix.

---

## 7. Compatibility with Architecture V1 (ADR-0018)

None of Layers 1-3 stand up a new `core/*-engine`:

- Layer 1 is literally unchanged.
- Layer 2 is a new *strategy* (an interface implementation, same
  pattern as `MemoryRankingStrategy`/`InsightValidationStrategy`
  already establish) inside the existing `core/knowledge-engine`
  module — ordinary engineering inside an engine that already exists,
  which ADR-0018 explicitly does not gate.
- Layer 3 is a new scheduled job and a new table, both operational
  infrastructure around the existing Knowledge Engine pipeline — it
  does not introduce a new domain, a new entity type, or a new
  bounded context. It calls the same `enqueueKnowledgeJob` /
  `knowledge_jobs` machinery that already exists.

This reading is offered, not assumed final — Section 6 already flags
it as the risk most worth the Founder's own confirmation before Phase
3 specifically (Phase 0-2 don't raise this question at all).

---

## 8. Validation strategy

- **Before Phase 2 ships:** re-run the exact E1 methodology from
  `2026-08-02_knowledge_engine_memory_rank_score.md` — same 179-item
  real benchmark (extendable with fresher production data by then),
  same blind independent classification — against
  `KnowledgeEligibilityStrategy` instead of `DeterministicMemoryRankingStrategy`.
  Success bar: recall meaningfully above 10.3% without precision
  dropping materially below 100%. A concrete number is not fixed in
  this document — that judgment belongs to whoever reviews the
  re-run benchmark, informed by real results, not decided in advance
  of having them.
- **After Phase 0 ships:** re-run investigation 3's E2 cross-set
  check (memories with rank ≥ 45 vs. memories that produced insight
  evidence) — expect the previously-perfect overlap to break in the
  correct direction (some jobs' triggering memories now get examined
  despite low `rank_score`).
- **After Phase 2 ships:** re-measure the same three production
  metrics all three investigations already established as the
  baseline — `knowledge_jobs` created per day, % of completed jobs
  producing ≥1 insight, `rank_score`/eligibility distribution shape —
  against the pre-change numbers already on record in this session's
  three investigation documents. The comparison is only meaningful
  because those baselines are already real, dated, and written down.
- **Phase 3 pilot:** its own precision/recall benchmark, built the
  same way as E1 (real memories, independent blind classification),
  before widening past the Founder's own account.
- **Ongoing:** keep every strategy in this design behind the same
  swappable-interface pattern already established
  (`MemoryRankingStrategy`, now `KnowledgeEligibilityStrategy`) —
  specifically so that the next time this needs auditing, it costs an
  afternoon, the way today's three investigations did, not a rewrite.
