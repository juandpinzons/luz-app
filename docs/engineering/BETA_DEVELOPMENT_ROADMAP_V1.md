# Beta Development Roadmap V1 — Closing the Architecture→Experience Gap

Version: 1.0\
Owner: Lead Engineer (solo, full-stack — LEOS/I7 split dissolved 2026-08-06)\
Requested by: Founder, 2026-08-06 — "proyecta el desarrollo de la beta... llevar toda la arquitectura actual a que se vea 100% reflejada en la experiencia al usuario," plus an infrastructure recommendation.\
Supersedes: `BETA_ROADMAP_V1.md` for planning purposes — that document targeted the original M2/M3 "Beta 1" milestone (wiring Memory Engine into chat for the first time) and is now historical; nearly everything it listed as missing has since shipped. Not deleted — it's a real record of that milestone, just not a live plan anymore.\
Builds on, does not repeat: `docs/product/UX_ARCHITECTURE_REFINEMENT_V1.md` (screen-level hierarchy/disclosure audit) and `docs/product/FOUNDER_EXPERIENCE_AUDIT_V1.md` (felt-experience layer), both landed the same week. This document adds the layer neither covered: **which whole capabilities reach the user at all**, sequencing against the nearest real deadline, and infrastructure.

---

## 0. Timeline this plan is written against

- **Today, 2026-08-06, is the declared Beta Freeze date** (`luz_war_room_beta_freeze`, 2026-07-24 War Room declaration). Per that declaration: after freeze, only bug fixes, UX polish, performance, reliability, deployment, and demo prep — no new features, full stop.
- **Colombia Tech Week is 2026-08-13** — 7 days out.
- This plan is therefore split into two horizons, not one list: **Window A (now → Aug 13)**, filtered hard against the freeze rule, and **Window B (post-demo Beta)**, where the deeper architecture-closing work belongs. Conflating them would violate the freeze the Founder already declared.

---

## 1. What "100% reflected in the experience" actually means here

Worth being precise, because the honest answer is that literal 100% is the wrong target. `ADR-0018` froze the engine architecture specifically to stop justifying more engineering by its own existence — the goal was never "ship every possible surface for every engine," it was "how useful does LUZ feel to a real person." This plan uses a narrower, truer version of the Founder's ask:

**No built capability should be invisible, silently underused, or bottlenecked by something already diagnosed and fixable.**

Three different failure shapes, each needing a different fix, audited separately below:
1. A capability is built and wired, but the *screen* buries it (UX_ARCHITECTURE_REFINEMENT_V1.md's entire subject — hierarchy, disclosure, density).
2. A capability is built and wired, but the *data feeding it* rarely clears the bar to be used (the retrieval/rank_score bottleneck — Section 3 below, the single biggest lever in this whole document).
3. A capability is built but has **zero wiring at all** — nothing in the live app ever calls it (Section 2 below — this is the audit neither prior document ran).

---

## 2. Capability-wiring audit — verified today, not recalled from memory

Memory entries from as recently as 5 days ago are already stale on this question — this project ships multiple real integrations per day. Everything below was re-checked directly against current code today (grep for real consumers, not documentation claims).

### Fully wired — reaching chat, Dashboard, or `/life` today

Memory, Knowledge Engine V2, Belief, Concept Graph, Contradiction, Reasoning, Curiosity (low-priority in the rule ordering, but wired), Identity Evolution, Presence/Voice/Context/Conversation Strategy, Avatar, Calendar Foundation (Apple + Google). All feed `assembleRealitySnapshot`, confirmed by direct read of `features/chat/services/assemble-reality-snapshot.ts` this week.

**Correction to stale memory, confirmed today:** the Continuity System and Narrative (`features/continuity`, `features/narrative`) were recorded as "unwired" as recently as 2026-07-31/08-01. Both are now real consumers of `app/dashboard/page.tsx` and multiple `features/chat/services/*` files (`assemble-reconnection-context.ts`, `frame-reconnection-rule.ts`, `assemble-conversation-variety-context.ts`). This gap has already closed — no action needed here, only correcting the record.

### Built, zero consumers — confirmed today

**The editorial voice library** (`editorial/`, 99 authored phrases across 11 categories, closed as V1 on 2026-08-02) has **zero references anywhere** in `core/`, `features/`, or `app/` — checked directly, not inferred. This is pure content sitting unused: no selector, no call site, no rule that ever reads from it. This is the cleanest example of "architecture not reflected in experience" this audit found — the content exists, nothing serves it. Scoped fix (Window B, not urgent for the demo): a selector inside the existing Conversation Strategy / Voice pattern, same shape as `CuriosityStrategyRule` or `BASE_FORBID` — ordinary engineering inside a frozen-shape engine, not a new one.

**Semantic memory search** (`core/memory/semantic/`, `pgvector` installed, `memory_embeddings` table exists) has zero rows and zero real callers — `NotImplementedSemanticMemoryRepository` throws explicitly rather than degrading silently (confirmed 2026-08-02, unchanged since). All retrieval today is lexical/structural (`StructuredMemoryRetrievalStrategy`, token-overlap in `selectContextualMemories`). This is a permanent, structural retrieval-quality ceiling, distinct from the calibration issue in Section 3 — flagged here as a Window B decision (needs an embeddings-generation pipeline, a real scope of work, not a tweak), not something to start against the freeze.

**Belief/Concept trend over time** — `belief_history` is a real, populated, append-only table (confidence deltas with `changeReason`), but nothing in the UI ever renders "this belief has been strengthening" or "this concept faded." `UX_ARCHITECTURE_REFINEMENT_V1.md` Section 5 already named the generic version of this gap; repeating only to confirm it's real at the data layer, not just a presentation choice waiting to happen.

**Gmail Foundation** — deliberately isolated (no persistence, no OAuth flow exposed, no UI), mirrors Calendar Foundation's own Phase 1. This is a recorded, deliberate architectural choice (2026-07-31), not an oversight — listed for completeness, not as a gap to close.

**Kimi (Moonshot AI) provider** — registered in the `AIProvider` registry, zero consumers, unconfigured (`KIMI_API_KEY` empty even in `.env.example`). Not a UX gap — nothing routes to it — but worth naming in the infrastructure section below, since it's a dependency someone chose to build that currently costs nothing and does nothing.

### Built, structurally throttled — the dominant gap

Covered in full in Section 3, because it's the one thing that makes almost every "wired" capability above feel thinner than the architecture behind it actually is.

---

## 3. The one bottleneck that explains most of the gap

Both fresh audit documents converge on this independently, and today's own work (`P1-6`, `ALPHA_BACKLOG.md`) is a direct, narrow instance of it: **`DeterministicMemoryRankingStrategy`'s understanding-signal keyword categories gate far more than they were designed to** — Knowledge Engine enqueueing, the SQL candidate pool ceiling, and (until this week's fix for finance) whole categories of real content. Measured on the Founder's real 179-memory account: **10.3% recall** on the signal that ends up dominating retrieval, Knowledge Engine eligibility, and 100% of the memory-connection graph.

**Status, precisely:** root-caused five independent ways (2026-08-02 investigations), designed as `ADR-0022` (Accepted, frozen at Revision 5), **implementation never authorized** — deliberately, per the ADR's own process (design acceptance ≠ implementation go-ahead). Today added one narrow, verified instance-level fix (financial keyword category, `P1-6`) using the existing mechanism, not the ADR's redesign — the same minimal-scope discipline the Founder already set with `P1-4`.

**This is the highest-leverage single decision available for Window B.** Every Tier-2 proposal in `UX_ARCHITECTURE_REFINEMENT_V1.md` (richer Memory highlights/stories, Belief trend surfacing, financial/quantified-tracking recall) is explicitly sequenced *after* this in that document too — independent convergence, not this document copying that one. Recommend: Founder authorization to begin `ADR-0022` Phase 0 is the single most consequential decision this roadmap can put in front of you, more consequential than any individual screen change.

---

## 4. Window A — now through Colombia Tech Week (Aug 13)

Filtered against the freeze rule: bug fixes, UX polish, performance, reliability, deployment, demo prep only. Ordered by ADR-0018's own priority list (response quality → onboarding → visible memory → proactive insight) crossed with what's actually buildable without touching retrieval architecture.

1. **`UX_ARCHITECTURE_REFINEMENT_V1.md`'s "Alpha now" list** (items 1–6 in that document) — Dashboard trim, chat opening-ritual fix (highest-confidence single item in that whole audit), Memories highlights-first landing, Response Reading Guidelines, Life Domain lens, mobile tap-target pass. Awaiting your confirmation on that document's open questions before it starts.
2. **Infrastructure hardening** (Section 6 below) — Vercel plan and error monitoring specifically, because both are real demo-day risk, not polish.
3. **Domain connection** (`ALPHA_BACKLOG.md` P2-3) — cheap, already purchased, cosmetic but real for a public demo URL.
4. **Nothing from Section 2 or 3 above** — the editorial voice library selector, semantic search, trend surfacing, and `ADR-0022` implementation are all real feature work under the freeze definition. Explicitly Window B.

## 5. Window B — the fuller Beta, after Aug 13

This is the actual answer to "project the beta's development" at full scope, once the freeze lifts:

1. **`ADR-0022` implementation** (Section 3) — the one decision that unblocks the most other things on this list. Needs its own Phase 0 scoping session before code, per the ADR's own rollout plan.
2. **Editorial voice library selector** — small, contained, high ratio of shipped-value to effort (99 phrases already written, just need a consumer).
3. **Semantic search** — real scope (embedding generation on capture + backfill for existing memories + a similarity retrieval strategy implementing the existing `MemoryRetrievalStrategy` interface, ADR-0004's other half). Worth a dedicated investigation into expected recall lift before committing engineering time, same discipline as everything else in this codebase.
4. **Belief/Concept trend surfacing** — data exists, needs a UI decision plus (per `UX_ARCHITECTURE_REFINEMENT_V1.md` Section 2) a "Cómo llegué a esto" disclosure pattern, not a raw feed.
5. **`UX_ARCHITECTURE_REFINEMENT_V1.md`'s "Beta" list** (items 7–9) — generic trend/contradiction surfacing, Memory Stories, the financial-honesty content rule — all explicitly gated on #1 already.
6. **This session's P1-7/P1-8** (`ALPHA_BACKLOG.md`) — lexical-only memory matching, `RELEVANT_MEMORY_LIMIT=5` capping aggregation-style answers. Both need a Founder decision on approach before implementation (cost/context tradeoffs), flagged there in detail.
7. **A real decision on Kimi** — either give it a real consumer (a genuine second-provider use case: cost routing, fallback, A/B) or stop carrying it as configured-but-unused surface area.

---

## 6. Infrastructure — what's actually worth paying for

Grounded in what's really configured today, not a generic checklist. Checked `vercel.json`, every cron/function config, `.env.example`, and the full dependency list directly.

### Priority 1 — Vercel: Hobby → Pro ($20/mo per seat)

**Confirmed, not inferred:** exactly one cron exists (`knowledge-worker`, `0 5 * * *` — once a day), and both the cron and the main chat API route are already capped at `maxDuration = 60`. This is a Vercel Hobby-plan ceiling, already documented in this codebase's own comments as a known, accepted constraint.

**What this actually costs today:** a memory captured right after the daily cron runs can sit up to ~24 hours before Knowledge Engine ever turns it into an Insight or Belief — already flagged internally as a demo risk before Aug 13. Pro's headline change is cadence, not just duration: cron jobs go from once-per-day to **per-minute scheduling**, up to 100 cron jobs per project — this alone turns Knowledge Engine from "runs once a day" into "runs continuously," which is a qualitative change in how fast LUZ's understanding of a person catches up to what they just said. Pro also raises the function-duration ceiling materially above Hobby's, and separately from the technical limits, Hobby's terms are scoped for personal/non-commercial use — LUZ has real users depending on it daily, which is arguably reason enough on its own. (Current pricing/limits verified via web search today, not recalled from training data — see Sources.)

**Recommendation:** upgrade before Aug 13, and move the Knowledge Engine cron off once-daily the same day. This is the single highest-confidence infrastructure recommendation in this document.

### Priority 2 — Error monitoring (Sentry or equivalent)

**Confirmed:** zero external error-tracking or monitoring service exists anywhere in the dependency list — no Sentry, no Datadog, no Axiom, nothing. The only visibility into production failures today is the internal `events` table and the `/admin` dashboard, both of which require someone to think to look. Going into a live demo with real people signing up in the room, "found out from a user's face, not an alert" is a real, avoidable risk.

**Recommendation:** wire up basic error tracking before Aug 13. Sentry's free Developer tier — verified today, 5,000 errors/month, 10,000 performance units/month, 30-day retention, one user — is very likely sufficient at current scale; this doesn't need to be a paid line item yet, just configured. Paid tiers start at $26/mo (Team, 50K errors) if volume ever justifies it later.

### Priority 3 — Neon (conditional, needs your dashboard, not guessed)

I don't have current plan/usage visibility (prod DB access is still pending from earlier this session). What's worth checking specifically: Neon's **Free tier mandatorily suspends compute after 5 minutes of inactivity** (verified today — not optional, "scale-to-zero" is enforced on Free), which produces a real cold-start delay on the next query after any idle gap — directly relevant to the "interaction speed" theme both fresh audits raised. If that's the current plan, the Launch tier is worth knowing has **no monthly minimum** as of this year (removed the old $5/mo floor) — it's pure usage-based ($0.106/CU-hour compute, $0.35/GB-month storage), so moving off Free isn't a big fixed commitment, it's paying only for what autosuspend currently costs in latency. Worth 5 minutes checking Neon's dashboard for suspend/resume frequency before deciding.

### Priority 4 — OpenAI usage tier

Not a subscription in the traditional sense, but usage-tier rate limits scale with cumulative spend history. Worth checking headroom against expected concurrent load on demo day specifically — a room of people trying LUZ at once is a real spike pattern, different from Alpha's steady trickle. Pre-funding ahead of the event is cheap insurance if current tier is low.

### Not a spend priority right now

- **GitHub** — no evidence of hitting Free-tier limits (no `.github/workflows` exists at all today, meaning CI isn't even running typecheck/smoke-suite on PRs yet). The higher-value action here is free: add a basic GitHub Actions workflow running `tsc --noEmit` + `npm run smoke` on pull requests. Worth doing for the same reliability reasons as Priority 2, but it's a setup task, not a subscription.
- **Kimi (Moonshot AI)** — already registered, unconfigured, zero consumers (Section 2). Don't pay for a key until Window B's "real decision on Kimi" actually picks a use case — funding it today would be paying for infrastructure with no consumer.

---

## 7. What this document deliberately does not do

- Does not implement anything — matches the standing instruction for this kind of planning work and `ADR-0018`'s own freeze.
- Does not re-litigate `UX_ARCHITECTURE_REFINEMENT_V1.md`'s screen-by-screen findings or `FOUNDER_EXPERIENCE_AUDIT_V1.md`'s felt-experience rubric — both stand as written, cited here, not duplicated.
- Does not propose a new `core/*-engine` anywhere — every Window B item above is either a UI decision, a new rule inside an existing frozen-shape engine, or an explicitly-flagged-as-real-scope investigation (semantic search), consistent with `ADR-0018`.
- Does not commit to exact dates for Window B — sequencing, not scheduling; the Founder decides pacing per `luz_daily_sprint_cadence`.

---

## Open questions for the Founder

1. Authorize `ADR-0022` Phase 0 scoping for Window B — the single highest-leverage decision in this document.
2. Confirm Vercel Pro upgrade timing (before vs. right after Aug 13 — before is recommended, given the daily-cron latency is already a named demo risk).
3. Editorial voice library: build the selector in Window B as scoped, or is there a reason it was left disconnected that this audit doesn't have context on?
4. Kimi: pick a real use case, or deprioritize/remove it from the active provider registry.

---

## Sources for external pricing (Section 6, verified 2026-08-06)

Pricing and plan limits change; re-verify before acting if this document is read more than a few weeks after this date.

- [Vercel Pricing](https://vercel.com/pricing), [Vercel Cron Jobs docs](https://vercel.com/docs/cron-jobs), [Usage & Pricing for Cron Jobs](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [Neon Pricing 2026 breakdown](https://vela.simplyblock.io/articles/neon-serverless-postgres-pricing-2026/), [Neon Pricing: Free, Launch & Scale](https://comparedge.com/tools/neon-db/pricing)
- [Sentry Pricing 2026](https://last9.io/blog/sentry-pricing/), [Is Sentry Free? Developer Plan Limits](https://costbench.com/software/developer-tools/sentry/free-plan/)
