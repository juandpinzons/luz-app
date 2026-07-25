# First Message → Identity Plan

Status: Proposed\
Owner: Founder\
Last verified: 2026-07-25

Scope first, same discipline as the other three plans from this
sprint (`SMOKE_TEST_PLAN.md`, `OBSERVABILITY_PLAN.md`,
`ONBOARDING_PLAN.md`). This one is different in kind: it's not a gap
in tooling, it's an architecture analysis of why the product might
still feel generic after the first message — grounded in the real
pipeline and real production data, not assumption.

## Summary of the finding

**LUZ's architecture already does almost everything asked for in this
sprint.** Memory capture, Life entity detection, contextual Reality
Snapshots, and Morning Brief continuity are real, wired, and verified
against production data today. **The one part that doesn't work is
the part that would make the identity compound over time — the
Knowledge Engine — and the reason isn't a code gap, it's a deployment
gap**: the code is complete and correct, but the process that runs it
has never once executed in production.

## What already exists and works (verified against real code + real production data, 2026-07-25)

| Stage | Status | Evidence |
|---|---|---|
| **Memory capture** (`core/memory-engine`) | ✅ Working | `capture-stage.ts` → classify → rank, persisted to `memories`. **172 real memories** in production today. |
| **Classification** (`DeterministicMemoryClassifier`) | ⚠️ Working, deliberately narrow | Keyword-matched (ES/EN) against 6 categories (relationship, goal, preference, ritual, event, intention); default `fact`. The class's own comment: *"el objetivo de esta fase es un Memory Engine correcto y confiable, **no todavía uno inteligente**"* — built as a swappable `MemoryClassifier` strategy on purpose, anticipating an AI-based successor. |
| **Ranking** (`DeterministicMemoryRankingStrategy`) | ⚠️ Working, deliberately narrow | Same pattern: keyword-matched against 9 "understanding signal" categories. Same swappable-strategy design, same explicit "not yet intelligent" comment. |
| **Life Capture** (`captureLifeEntityFromMemory`) | ✅ Working, narrow input | AI used only for structured extraction (title, person name) from an *already-classified* memory — never for the yes/no decision, which stays deterministic. Correctly wired via `after()` since yesterday's fix. **Real numbers**: 1 goal, 0 projects, 0 relationships captured from 172 memories — low not because this code is broken, but because the classifier above rarely emits `goal`/`pattern`/`relationship` types (only 3 of 8 memory types map to a Life entity by design; the other 5 — fact, ritual, preference, event, intention — have "sin mapeo a una entidad de Life en V1"). |
| **Reality Snapshot** (`assembleRealitySnapshot`) | ✅ Working, and better than expected | Already has a `currentMessage`-aware contextual mode (closed as a P0 in the most recent commit, `c406ed0`): "¿qué necesita recordar LUZ **para este mensaje**?", not just globally-ranked memory. This is real contextual awareness, already live. |
| **Context Builder** (`features/chat/context-builder`) | ✅ Working, real prompt engineering | Five real conversation rules already exist: avoid paraphrasing, avoid repeating known info, favor brevity, favor continuity, prioritize understanding. Not a bare passthrough to the model. |
| **Morning Brief continuity** (`build-morning-brief.ts`) | ✅ Working | `continuityLine` is AI-written from the top real memory, correctly `null` (never invented) when there isn't one — verified yesterday for the first-visit case. |
| **Knowledge Engine** (`core/knowledge-engine`) | ✅ **Code complete**, ❌ **never runs** | All 6 stages real (Extract → Classify → Relate → Generate → Validate → Persist), fully wired into `worker/index.ts` as of `c406ed0`. See the gap below — this is the one that matters most. |

## The critical gap: the Knowledge Engine has never executed in production

`worker/index.ts` is a standalone Node process (`npm run worker`) — an
infinite polling loop over `knowledge_jobs`. **Nothing deploys it.**
No `vercel.json`, no cron config, no separate host (Railway/Fly/
Render) — checked directly, none exist. Vercel's serverless functions
cannot run an infinite loop; there is currently no environment where
this process is alive.

Confirmed with a direct, read-only query against production
(2026-07-25):

```
knowledge_jobs:              146 pending, 0 completed, 0 failed
knowledge_engine_insights:   0 rows, ever
knowledge_engine_evidence:   0 rows, ever
memories:                    172 rows (real capture is working)
```

Every message that ever qualified for deeper analysis got enqueued
correctly and has sat `pending` since, some for days. **Zero insights
have ever been generated in this product's history.** This is very
likely the single largest reason the product still risks feeling
generic after message one: the layer specifically designed to notice
patterns *across* conversations — not just within one — has code that
works and has simply never run.

## The second gap: nothing reads what the Knowledge Engine would produce

Checked directly: no file outside `core/knowledge-engine/` and
`worker/` references `InsightRepository` or
`knowledgeEngineInsights` in any real capacity. `assembleRealitySnapshot`
(which feeds both the chat prompt and the Morning Brief) reads only
`core/life` and `core/memory-engine` — **never** `core/knowledge-engine`.

This means fixing the deployment gap alone (making the worker run)
would start populating `knowledge_engine_insights` with real,
validated, AI-proposed insights — but nothing would show up in a
conversation or a Morning Brief until this second gap is also closed.
Both matter; neither alone is enough.

## What this is *not* — three things correctly ruled out

- **Not a hardcoding problem.** Nothing in this pipeline is scripted
  per-conversation; every piece reads real state.
- **Not a prompt-size problem.** Context Builder already composes from
  structured state (Reality Snapshot) plus small, composable rules —
  not one giant prompt.
- **Not a model-coupling problem.** Every AI call goes through
  `AIProvider` (`generateReply`/`generateStructured`); nothing imports
  an SDK directly outside that abstraction. Swapping the model
  tomorrow would touch zero of the logic described here.

## Risks

| Risk | Mitigation |
|---|---|
| Turning on a worker that's never run against 146 real pending jobs at once could generate a burst of AI calls / cost | Process a small bounded batch per invocation (existing `claimNextJob` already claims one job at a time with `skipLocked` — this already caps concurrency; just needs to run repeatedly on a schedule, not all at once) |
| Wiring Insights into the live chat prompt could make responses feel like they're "reciting a profile" instead of naturally continuing a conversation | Same guard `assembleRealitySnapshot` already applies to Memory (`memoriesWithRealSignal` — never forced, never padded to fill a slot): only feed a validated, high-confidence Insight when one genuinely exists; absence stays absence |
| Changing the Memory classifier/ranker from keyword-based to AI-based is a bigger, riskier change to a piece explicitly built narrow-on-purpose | **Not decided in this plan** — flagged as its own decision below, not bundled into this sprint's implementation |

## Proposed incremental plan (lowest risk → highest impact)

**Step 1 — Make the Knowledge Engine actually run.** Zero new domain
logic: 100% reuse of `worker/index.ts`'s existing `claimNextJob`/
`processJob` functions, adapted to run on a schedule instead of an
infinite loop (Vercel Cron calling a route, or a small always-on
process — see the open decision below). This alone starts producing
real Insights from the 146 jobs already waiting, using code that's
already correct.

**Step 2 — Feed validated Insights back into what the user
experiences.** Extend `RealitySnapshot` with an `insights` field
(alongside `life`/`memory`/`signals`, same neutral-kernel shape
ADR-0013 already establishes), sourced from
`knowledge_engine_insights` where `status` is validated — feed it into
Context Builder (a new, small conversation rule, same pattern as the
five that already exist) and into `build-morning-brief.ts`'s
continuity line (same "only when real, never invented" guard already
governing `continuityLine`). This is the step where "LUZ ya empezó a
conocerme" becomes something the user can actually feel, not just
something computed silently in a table nobody reads.

**Step 3 — flagged, not part of this implementation**: whether to
replace the deterministic Memory classifier/ranker with an AI-based
strategy (the architecture already anticipates this exact swap). This
would substantially widen what counts as meaningful in the first
place, but it changes a deliberately-scoped v1 decision — same
precedent as P1-4 in `ALPHA_BACKLOG.md`, where the Founder explicitly
rejected widening a keyword list without a second real, documented
case. Not decided here; a candidate for its own sprint once Steps 1-2
are live and there's real signal on whether recall is still the
binding constraint.

## Open decision (blocks finalizing Step 1)

**How does the Knowledge Engine worker actually run in production?**
Two real options, not a false binary:

1. **Vercel Cron → API route.** Wrap the exact same `claimNextJob`/
   `processJob` logic in a route (e.g. `app/api/cron/knowledge-worker`),
   triggered on a schedule via `vercel.json`'s `crons` array, processing
   one bounded batch per invocation. No new hosting relationship, no
   new bill — everything already lives on Vercel. Trade-off: Vercel
   Cron's minimum interval and function timeout bound how quickly the
   queue drains; fine for today's volume (146 jobs, low message rate),
   worth re-checking if volume grows.
2. **A separate always-on process** (Railway/Fly/Render) running
   `worker/index.ts` completely unchanged. Matches the code exactly as
   written today, drains the queue continuously rather than in
   batches. Trade-off: a new hosting relationship and a new recurring
   cost, mid-crunch before Colombia Tech Week.

This plan recommends **option 1** — reuses 100% of the existing logic,
adds no new infrastructure dependency, and matches the "smallest
complete solution" principle already applied to every other fix this
sprint (`DEPLOY_RUNBOOK.md`'s migrate-on-build change is the same
shape of decision). Confirming this before implementing, per the
Founder's explicit instruction to stop on architecture questions.
