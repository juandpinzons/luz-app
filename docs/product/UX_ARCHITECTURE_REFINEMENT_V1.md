# UX ARCHITECTURE REFINEMENT V1

**Status:** Proposed — awaiting Founder confirmation\
**Version:** 1.0\
**Author:** Synthesis over existing architecture, product docs, and real production data — not a product decision by itself.\
**Does not modify:** Architecture V1 (`ADR-0018`), any `core/*-engine`, any domain contract. Nothing below proposes a new engine, a new Memory Engine field, or a fix to the retrieval/ranking pipeline — those are named explicitly where they matter and left to their owners (see "What this document does not cover").\
**Related to:** `docs/adr/ADR-0018_ARCHITECTURE_V1_FROZEN.md`, `docs/adr/ADR-0022_KNOWLEDGE_RELEVANCE_REDESIGN.md`, `docs/product/EXPERIENCE_AUDIT_V1.md`, `docs/product/ALPHA_EXPERIENCE_V1_DESIGN.md`, `docs/product/CONVERSATION_MANUAL_V1.md`, `docs/vision/PRESENCE_PRINCIPLES.md`, `docs/vision/DESIGN_PHILOSOPHY.md`, `docs/vision/NORTH_STAR_EXPERIENCE.md`, `docs/vision/TARGET_MARKET_HYPOTHESIS.md`, `docs/engineering/investigations/2026-08-02_*.md`.

---

## Purpose

Audit the Dashboard, Home, Memories, Chat, and navigation as a real person experiences them, and propose how the intelligence LUZ already has should reach that person — never how to build more intelligence. Every proposal below is evaluated against the same criteria the codebase already uses to evaluate itself: the North Star Question (`TARGET_MARKET_HYPOTHESIS.md`), the nine `PRESENCE_PRINCIPLES.md` behaviors, and `DESIGN_PHILOSOPHY.md`'s test ("does this make the relationship feel more real, or the product feel more used?"). Where a proposal serves a specific principle, that principle is named — a proposal that can't name one is not yet a LUZ feature, per `PRESENCE_PRINCIPLES.md`'s own closing rule.

This document builds on, and does not repeat, `docs/product/EXPERIENCE_AUDIT_V1.md` — its H1–H7 findings are treated as a baseline (H3, H4, H5, H6 resolved; H1, H2, and H7's UX half still open and out of this document's scope, see the closing section). It also builds on `docs/product/ALPHA_EXPERIENCE_V1_DESIGN.md`, but flags, explicitly, several places where the shipped product has since diverged from that proposal — in both directions: some of it shipped leaner and more disciplined than proposed (Memories already hides `memory.type`, on purpose — see Section 3), some of it shipped denser than proposed (Dashboard has more stacked sections today than the "Dashboard V2" wireframe called for — see Section 1).

## Method

Every claim about what a screen currently shows is a citation of the live component tree, not a description of intent — file and line, throughout. For the financial-intelligence case study (Section 5), this document does not invent example data. It uses the Founder's real, live account: 179 memories, verified two days before this document by the engineering team's own investigations (`docs/engineering/investigations/2026-08-02_*.md`), which ran the actual production retrieval functions against his real data, in read-only mode. Those investigations are the primary evidence for Section 5; this document adds no new queries against production, only a reading of what they already found.

This audit did not spin up a local instance to click through. Verified before starting: there is no seed script anywhere in this repo, `docker-compose.yml` only enables the `pgvector` extension on an empty database, and login requires real Google OAuth credentials (`docs/engineering/SMOKE_TEST_PLAN.md`: "LUZ only supports Google OAuth today"). A fresh local account would render an empty state on every screen — a worse proxy for "a real user" than the Founder's actual 179-memory production account, which the team had already exercised two days earlier. Where this document needed to know what a populated screen looks like, it read the code that renders it and the real data that would flow through it, rather than fabricate a session.

---

## What's actually there: navigation and "Home"

Two clarifications the rest of this document depends on.

**Navigation** is a single persistent header (`components/app-shell.tsx:54-110`), not a bottom tab bar — four items, horizontally laid out: Hoy (`/dashboard`), Vida (`/life`), Recuerdos (`/memories`), Conversación (`/chat`). `/conversations` (history) has no nav entry of its own; it's reached through the chat header's "Historial" link, a fix already shipped for `EXPERIENCE_AUDIT_V1.md`'s H3. This four-item shape is a real, confirmed decision (`ALPHA_EXPERIENCE_V1_DESIGN.md` §4.1/5.1, literally cited in the app-shell's own code comment), not an accident — this document does not propose changing what the four destinations are, only what each one shows once you're there, plus one open question about how they're laid out on mobile (Section 7).

**"Home" is not a screen.** `features/home/*` is a backend aggregator whose own README says so directly: *"no hay UI aquí"* (`features/home/README.md:5-6`). `app/page.tsx` is the public, signed-out marketing landing page — unrelated. Everything a "Home" screen would show already renders on `/dashboard`, which consumes `HomeState` today. Building a fifth nav destination called "Home" would fragment a working single entry point for no evidenced reason — the same standard `ADR-0018` already applies to engines applies here: don't add surface area a real user hasn't been shown to need. This document treats Dashboard as Home throughout.

---

## Core thesis

Two findings sit underneath everything below.

**First:** the Dashboard's density is not the result of bad individual decisions. Every section on it was added for a real, locally-defensible reason, several of them fixes to real findings (`EXPERIENCE_AUDIT_V1.md` H4, H5). The problem is that nobody owns the screen's *total* information budget — an arbitration layer (`features/experience`, "Experience Intelligence V1") was built specifically to collapse a flat list into one primary experience, and it works — but the page still stacks seven more sections below and around it, several of which predate that arbitration layer and were never revisited once it shipped. Section 1 is mostly subtraction, not invention.

**Second, and more consequential:** this audit's proposals split cleanly into two tiers, and conflating them would be dishonest. **Tier 1** — hierarchy, disclosure, navigation, reading experience — is pure presentation and buildable regardless of backend state. **Tier 2** — anything that depends on LUZ actually having understood something (rich memory highlights, financial insight, proactive surfacing) — is currently capped by a real, measured bottleneck. The team's own investigations, run two days before this document, found that the single signal gating Knowledge Engine enqueueing, context retrieval, and memory-connection candidacy has **10.3% recall** — and verified, against the Founder's real account, that this leaves only 4 of his 179 memories reachable by almost any query, regardless of topic. No UI decision fixes that. Every Tier 2 proposal below says so explicitly, states what it degrades to gracefully when signal is thin, and is sequenced *after* that upstream fix in the roadmap, not instead of it.

This reframes Section 5 (Financial intelligence) in particular: the honest finding is not "LUZ's financial summaries are poorly presented." It's that LUZ cannot currently answer "how much did I spend this week," verified against the Founder's own account — and the design job right now is to be honest about that, not to build a dashboard that implies otherwise.

---

## 1. Information hierarchy

### What's on `/dashboard` today, in order

Cataloged from `app/dashboard/page.tsx:554-742`, one column, no tabs:

1. Avatar + greeting + date
2. One of: first-visit copy, AI-generated continuity line, or a deterministic "you've been away N days" line
3. `PrimaryExperienceCard` — the arbitrated "single primary experience," per its own docblock
4. A one-line "what changed" summary
5. `SecondaryExperienceList` — small link rows
6. `PostponedExperienceNote` — one muted sentence
7. "Tu calendario hoy" — up to 3 events + "+N más," or a connect-calendar prompt
8. A truncated recent-memory quote + "Ver más" link to `/memories`
9. "Hablar con LUZ" button
10. "¿Cómo vamos?" feedback link
11. `DashboardActivitySummary` — recent-conversations list (up to 5) + a one-sentence relationship narration + orb + footer

Eleven stacked widgets. Items 1–3 are reliably above the fold; the other eight require scroll on any real phone. This is the densest screen in the product, and — per the mission brief's own framing — Today should answer three questions, not eleven.

### What each item is actually doing

| # | Section | What it's for | Disposition |
|---|---|---|---|
| 1–3 | Greeting, continuity/first-visit box, primary card | "What deserves my attention" | Keep — this is the correctly-arbitrated core |
| 4 | What-changed line | "What changed" | Keep, but merge with #8 (below) |
| 5 | Secondary experience list | "What should I continue" | Keep — this is real arbitration output, not a raw list |
| 6 | Postponed note | Things LUZ *chose not to* lead with, shown anyway | **Cut** — see below |
| 7 | Full calendar list | Today's schedule | **Move** — see below |
| 8 | Memory teaser | A single recent-memory quote | **Merge into #4** |
| 9–10 | CTA + feedback link | Primary action, Alpha feedback loop | Keep as-is |
| 11a | Recent-conversations sublist | History discovery | **Cut** — superseded |
| 11b | Relationship sentence + orb | "Who we are to each other" | Keep — best model on the screen |

**Cut — the postponed note (#6).** `PostponedExperienceNote` exists to show what the arbitration layer decided *not* to lead with. Showing it anyway partially defeats the point of arbitrating, and sits in tension with Principle 4 (Intentional Silence): if something was genuinely postponed, the most honest UI is not to mention it today. Recommend dropping it from Today entirely; if a postponed item resurfaces later with real weight, it becomes tomorrow's primary or secondary card on its own merits.

**Move — the full calendar list (#7).** A three-event list with a "+N more" link is a distinct concern from "what deserves my attention" — it's a schedule, not a narrative. `/calendar` already exists as its own route with no nav entry of its own (reachable only from here or from `/calendar/connect`), which is the right shape — the fix isn't a new screen, it's not *also* rendering the raw list on Today. If today's calendar has something genuinely attention-worthy, that's exactly what the `PrimaryExperienceCard`/`SecondaryExperienceList` arbitration already exists to decide — feed it in as a candidate there instead of rendering it a second time, unarbitrated, lower on the page.

**Merge — memory teaser (#8) into what-changed (#4).** A truncated quote of "the last thing I remember" is a second teaser into the exact content `/memories` already owns, and `EXPERIENCE_AUDIT_V1.md` already confirmed `/memories` does this well. Fold it into the one-line what-changed summary instead of giving it its own paragraph and its own "Ver más."

**Cut — recent-conversations sublist (#11a).** This list existed because there was no other way to reach conversation history — `EXPERIENCE_AUDIT_V1.md` H3 named that gap directly. H3 is now resolved: `/chat`'s header always shows a "Historial" link. The Dashboard sublist is a second, weaker path to the same place (5-item cap, invisible when empty) that predates the real fix. Cut it; keep only 11b, the one-sentence relationship narration and orb, which is doing something the nav link can't.

**Net effect:** eleven stacked sections become six — greeting, continuity box, primary card, one merged what-changed line, secondary "continue" list, one relationship sentence — plus the two persistent actions (talk to LUZ, feedback). See Section 4 for the assembled wireframe.

---

## 2. Progressive disclosure

Propose a standing three-tier rule, applied consistently rather than screen-by-screen:

- **Tier 0 (always visible, under ~8 seconds to read):** greeting, continuity line, one primary card, one action. This is what Section 1 leaves on Dashboard after the cut.
- **Tier 1 (one tap, via nav):** the full content of Vida, Recuerdos, Conversación.
- **Tier 2 (one more tap, inside a Tier-1 screen):** detail views — `/life/[kind]/[id]`, `/life/identity`, `/conversations/[id]`, a memory's connections.

The rule this document applies throughout: nothing skips a tier. Right now, two screens do.

Dashboard (audited above) puts Tier-2-shaped content (a full calendar, a conversations sublist) at Tier 0.

**`/life/identity` is the second offender**, and it's worth naming even though it's a Tier-1 screen, because the same discipline applies one level in: coverage bars, "last N days" deltas, pending predictions, top beliefs, top concepts, reasoning conclusions, open tensions, and a footer timestamp — up to eight independently-hidden sections in one column (`app/life/identity/page.tsx:43-277`), the second-densest screen in the product after today's Dashboard. Not everything here is Tier-1-appropriate. Recommend: coverage bars and the "last N days" delta stay at the top of `/life/identity` itself (they're the screen's own headline, and `EXPERIENCE_AUDIT_V1.md` already called this screen "the strongest proof that LUZ knows you"). Predictions, reasoning conclusions, and open tensions — three sections whose entire content is "things LUZ inferred, that need their own explanation to trust" — belong one tier deeper, behind a single "Cómo llegué a esto" expansion, not stacked inline by default. This keeps the screen's trustworthy headline immediately visible while respecting Principle 7 (Shared Evolution): a person should be able to see the inference *and* trace it, but tracing it is a deliberate second step, not something scrolled past by default.

---

## 3. Memory UX

### What exists today

`/memories` groups strictly by four time buckets (Hoy/Esta semana/Este mes/Más atrás — `features/memories/services/search-memories.ts`), with free-text search and an optional "Lo que he entendido" (validated insights) section at the top. A `MemoryCard` shows the memory's content, one connected memory, and any Goal/Project title found as a literal substring — deliberately *not* `memory.type`, per the component's own docblock: *"esa es la taxonomía interna del Memory Engine, no algo que la persona necesite leer"* (`features/memories/components/memory-card.tsx:20-25`). That's the right call, already made once — this section proposes extending the same instinct further, not introducing it.

This is closer to a personal-memory feel than a database already — the mission's concern is real but the team has partially addressed it. What's missing is a landing experience that isn't chronological by default.

### The reframe

The full `Memory` entity (`core/memory-engine/entities/memory.ts:19-32`) has more than the UI shows: `type` (8 values), `source`, `status`, `rank.score` (0–100), and — as a separate entity — `MemoryConnection`, "calculated, never rendered" per `ALPHA_EXPERIENCE_V1_DESIGN.md` §1.3. None of these should ever appear as raw fields (same reasoning that already removed `type`). But they're exactly the raw material for three things the mission is asking for, none of which require a new field:

- **Highlights** — memories with a materially higher `rank.score`, or backing a validated Insight, rendered as a small, named set ("Momentos que más han quedado") instead of buried in whatever week they happened to fall in. This is a re-frame of "Lo que he entendido," not a new mechanism — promote it from a conditional top banner to the actual landing content of the screen.
- **Stories** — a `MemoryConnection` cluster is already a thread; nothing renders it as one today anywhere except partially inside a Life entity's detail page ("Momentos donde hablamos de X"). Generalize that pattern directly onto Memories: picking a highlighted memory should be able to show its connected cluster as a short timeline, not just "1 memoria conectada (+N más)" as inert text.
- **Categories** — the one place this document has to be honest about a real gap: `LifeDomainType` (health/career/finances/relationships/…) is not a field on `Memory`, only on `Belief` and `Contradiction`. True category chips over raw memories aren't buildable today without either inventing a new taxonomy field (out of scope — that's a Memory Engine schema change) or inferring domain indirectly through whatever Beliefs/Concepts a memory happens to back (weak, sparse, and inherits Section 5's recall problem). Recommend not promising category filters on `/memories` in this iteration; instead, let `memory.type` — already computed, already deliberately hidden as a raw label — drive soft, human-sentence groupings server-side ("Goals & intentions," "Moments with people," "Patterns LUZ has noticed") without ever printing the enum word itself. This respects the same principle the `type`-hiding decision already established, applied one level further.

### The honest caveat

Highlights and Stories both inherit Section 5's finding directly: with the current 10.3%-recall bottleneck, "highlights" for most accounts today would be the *same small cluster* every time — which risks reading as repetitive rather than curated, in tension with Principle 8 (trust compounds through many ordinary, varied moments, not one that repeats). This proposal should ship with a graceful floor: if there are fewer than, say, 3 genuinely distinguishable highlights, show what's real and stop — never pad the section to look fuller than the account's actual signal. The chronological time-bucket view doesn't disappear; it becomes the "show everything" fallback reachable from Highlights, not the thing a person sees first.

---

## 4. Dashboard ("Today")

Applying Section 1's cuts, Today should answer exactly the three questions the mission names, and nothing else:

```
┌──────────────────────────────────────────────────┐
│  Hoy · Vida · Recuerdos · Conversación              │
├──────────────────────────────────────────────────┤
│  [avatar]  Buenos días, Juan.        3 de agosto     │
│                                                      │
│  ┌────────────────────────────────────────────┐   │
│  │ "Ayer mencionaste la entrevista del jueves  │   │  ← WHAT DESERVES
│  │  — ¿cómo te sientes con eso?"               │   │    MY ATTENTION
│  └────────────────────────────────────────────┘   │    (continuity/primary card,
│                                                      │     unchanged mechanism)
│  Desde ayer: guardé algo nuevo sobre tu maratón.    │  ← WHAT CHANGED
│                                                      │    (what-changed + memory
│                                                      │     teaser, merged)
│  Sigues con:                                        │  ← WHAT TO CONTINUE
│  · Proyecto "Cambio de carrera"                     │    (secondary list,
│  · Hábito: alemán                                   │     unchanged mechanism,
│                                                      │     relabeled)
│  [ Hablar con LUZ ]                                 │
│  ¿Cómo vamos? Cuéntame                              │
│                                                      │
│  Nos conocemos desde julio. Hemos hablado 34 veces. │  ← RELATIONSHIP,
│  ○ (orb)                                             │    not activity
└──────────────────────────────────────────────────┘
```

Removed from Today entirely, per Section 1: the full calendar list (link only, or folded into the primary/secondary arbitration if genuinely today-relevant), the postponed note, and the recent-conversations sublist. Six sections instead of eleven, and every remaining one maps to one of the mission's three questions or to the relationship signal `EXPERIENCE_AUDIT_V1.md` H4 already validated as worth keeping visible on every visit.

No fourth nav destination is proposed (see "What's actually there," above) — Dashboard already is Home.

---

## 5. Financial intelligence — the Founder as case study

### What LUZ should already know

`TARGET_MARKET_HYPOTHESIS.md`'s Founder notes name "organización financiera" as one of nine interest areas defining LUZ's target market — not a hypothetical, a named product priority.

### What LUZ actually knows today, verified against his real account

The Founder's own memory store already contains an explicit financial goal, in his own words, captured months before this audit:

> *"Mis metas para los próximos 30 días son: retomar actividad física, volver a trotar... volver a hacer duolingo... **programar presupuesto y plan de pagos**... Establecer sociedad con Alejandro"*
> — real memory content, quoted in `docs/engineering/investigations/2026-08-02_knowledge_engine_memory_rank_score.md:275-277`

That's a real, present, budget-and-payment-plan goal, sitting in his 179 memories right now. Two days before this document, the team ran the live production retrieval function (`selectContextualMemories`) against his real account with the query *"¿Cuánto he gastado esta semana?"* ("How much have I spent this week?"). None of the 5 returned results answered it. The closest was a reference to a past exchange, not a figure: *"Ayer te dije cuánto me gasté 1 de agosto"* — and the account's own history already contains the Founder asking LUZ, directly, in a real conversation: **"Como así que no guardas montos exactos??"** ("What do you mean you don't save exact amounts??") — `docs/engineering/investigations/2026-08-02_memory_representation.md:355`.

This is not a hypothetical UX gap. It is a documented, real complaint from the one real user this product has, about exactly the capability this section is asked to audit.

### Why, structurally — confirmed, not inferred

- `Memory` has no amount, currency, or transaction field (`core/memory-engine/entities/memory.ts:19-32`) — a spending fact is only ever recoverable as free text, competing lexically like anything else.
- `Goal`/`Project` have no budget, cost, or amount field either (checked directly against `core/db/schema/life-entities.ts` — no such column exists).
- `LifeDomainType` already includes `"finances"` (`core/life/value-objects/life-domain-type.ts:8`) and is a real field on `Goal`/`Project`/`Habit`/`Routine`/`LifeEvent`/`Belief`/`Contradiction` — but never on `Memory` itself, which is where a spending fact would actually be captured. Repo-wide, the `"finances"` label appears only as a generic tag in test fixtures and product docs — no real account's data was found carrying it.
- Retrieval itself is the deeper problem, and it isn't finance-specific: the same 2026-08-02 investigations found that the Founder's real account of 179 memories is reachable, for almost any query regardless of topic, through only 4 memories — the ones that happen to have `rank_score ≥ 45` (measured recall on that signal: 10.3%). The "expenses" query failing isn't a special case; it's one of six representative categories tested that day, and it failed the same way "achievements," "identity," and "routines" did.

### What this section proposes — and what it deliberately does not

**Not proposed:** a numbers dashboard, a spend tracker, or any structured financial summary. Building one would require exactly the kind of new Memory Engine field this mission rules out, and even if it existed today, there's no captured numeric data to summarize — inventing a chart over near-empty data would violate Principle 9 directly ("never let a system's internal confidence... be the reason something is said, if the person would have no way to understand why").

**Proposed — buildable today, zero new capture:**

1. **A Life Domain lens**, not a finance feature. `LifeDomainType` already exists as a direct, optional `domain` field on `Goal`, `Project`, `Habit`, `Routine`, and `LifeEvent` (`core/life/entities/goal.ts:11` and siblings; persisted as a real column in each table, `core/db/schema/life-entities.ts:56,91,121,152`), as well as on `Belief`/`Contradiction`. Let a person filter what already renders on `/life` by domain — `finances` being one of eight, not a special case. This is real, available today, and generalizes past finance to the other eight interest areas named in `TARGET_MARKET_HYPOTHESIS.md` for free. It does not extend cleanly to `/memories`, for the same reason Section 3 declines to promise category chips there: `Memory` itself carries no domain field, so a memory could only inherit one indirectly through whatever Goal or Belief it happens to connect to — worth keeping the two proposals separate rather than implying `/memories` gets domain filtering for the same low cost.
2. **An honest thin-state, not a sparse chart.** When a domain lens has little behind it — which, per the investigations above, is most domains for most accounts today — say so in LUZ's own voice: *"Todavía no he entendido lo suficiente de tus finanzas para resumirlas — cuanto más me cuentes, más se va a llenar esto."* This is a direct application of `CONVERSATION_MANUAL_V1.md`'s Honesty section ("Cuando no sabe algo: Lo dice") to a UI surface, not just to chat text, and it's the difference between Principle 9 being honored or violated by this exact feature.
3. **Trends and contradictions, generic, not finance-specific.** `deriveBeliefTrend()` and `detectContradictions()` already exist and are domain-agnostic — whatever UI treatment gets designed to show a belief strengthening/weakening or an open contradiction on `/life/identity` (a real gap today: none of that is surfaced anywhere in the UI right now, despite existing in the domain model) automatically covers finances the day a financial Belief exists. This document is not proposing a finance-specific trend feature; it's flagging that the generic version doesn't exist yet, and finance is simply the mission's chosen lens on that larger gap.
4. **One conversation-content rule, named explicitly because it's the one place this section touches something buildable inside the frozen architecture.** `ADR-0018` carves out ordinary rules inside existing engines as *not* new engines. Propose a rule, inside the existing Conversation Strategy pattern, for when someone asks a financial (or any) question Memory genuinely can't answer: say so plainly and invite the real number, rather than the current failure mode — silently returning unrelated high-rank memories dressed up as context, which risks sounding like a confident non-answer. This is content policy, the same shape as the six `ConversationRule`s that already exist, not new infrastructure.

### The dependency this section cannot design around

Every proposal above except #4 scales directly with the retrieval fix already designed (not yet implemented) in `ADR-0022` and its three follow-up investigations. This document recommends validating #1–#3 *after* that ships — before then, a perfect UI for this section would still have almost nothing real to show, for almost any account, not because the design is wrong but because the underlying signal is thin. That's not a UX finding this document can resolve; it's named here so it's never mistaken for one.

---

## 6. Conversation UX

### What already governs this, in code

This is more constrained — and more solved — than it looks. `core/voice-engine` already enforces, at the prompt level: a hard `maxLines` cap (default 4, `default-voice-engine.ts:15`), an explicit ban on markdown, headings, numbered lists (*"el texto se muestra tal cual, sin renderizar"*), a ban on menu-style capability lists, a ban on running past the line limit "and continuing in the next message instead," and a ban on repeating back what the person just said (`BASE_FORBID`, `default-voice-engine.ts:28-35`). `CONVERSATION_MANUAL_V1.md` independently states the same spirit in product language: avoid *"hablar demasiado... responder con listas innecesarias... convertir toda conversación en productividad."* The client renders plain text only — no markdown parser exists anywhere in the codebase — so these two documents already agree, and the code already matches both.

### What's actually missing

Not more rules — **enforcement and a shared vocabulary for judging drift.**

- `maxLines` is a soft prompt instruction, never server-checked. Nothing truncates a reply that ignores it. Today, "the response felt too long" is undetectable except by reading transcripts by hand.
- There's no product-facing (not prompt-engineering) reference that a human reviewer — designing a new `ConversationStrategyRule`, or triaging feedback — can hold a real reply against, beyond re-reading `BASE_FORBID`'s code comments.

**Proposed:**

1. A short, product-owned **Response Reading Guidelines** doc, a companion to `BASE_FORBID`, not a replacement — covering sentence rhythm, when a short enumeration reads as natural prose ("primero... y después...") versus when it reads as a list LUZ was just told not to produce, and how a reply should end (a question only when Conversation Strategy's own posture calls for one — several existing rules already caution against chaining questions, this makes that a documented default rather than scattered per-rule advice).
2. Make "this felt too long / too short" a taggable category on `/feedback`, which already exists and already collects structured input. This turns an invisible prompt-adherence gap into something measurable, without building new instrumentation infrastructure — it reuses a surface that's already there for exactly this purpose.

---

## 7. Mobile-first experience

Assuming the beta is primarily mobile, three concrete, checkable items:

- **Nav reachability.** The four-item nav lives in a top header (`components/app-shell.tsx`), not the thumb zone, and its label text scales from `11px` at mobile width up to `sm:text-sm` (`app-shell.tsx`). An 11px label with typical padding is close to, and may fall under, the ~44px recommended tap target — worth a direct measurement pass before anything else in this section. If it does fall short, a bottom tab bar for the same four destinations is the standard fix and is named here as an open question (see closing section) rather than a settled recommendation, since it's a real navigation-pattern change touching every screen, not a copy or spacing fix.
- **Density compounds on mobile specifically.** Section 1's eleven-widget Dashboard and Section 2's eight-section `/life/identity` cost more on a phone than the file structure alone suggests — each is a full-screen scroll, not a glance. The cuts proposed in those sections are, on mobile, not cosmetic; they're the difference between "readable in the time it takes to unlock your phone" and "a scroll session."
- **The radial map on `/life`.** `LifeGraphView`'s default "Vista mapa" is an SVG radial diagram with zoom/pan/recenter controls — reasonable on desktop, historically the highest-risk pattern on a narrow mobile viewport (small satellite-node tap targets, pan-vs-scroll gesture conflicts). The zoom/recenter controls already existing is a good sign the team anticipated this, but it deserves a dedicated hands-on pass rather than an assumption either way — flagged here, not resolved.

---

## 8. Interaction speed

### The clearest finding in this document

`/chat`'s opening ritual — a ~1.9-second breathing-orb animation before the screen becomes interactive — is gated by `ready={!isLoadingHistory}` (`app/chat/page.tsx:584`), which is `true` on **every single visit**, not just the first. Confirmed directly in `ConversationOpeningRitual`'s own source (`features/chat/components/conversation-opening-ritual.tsx:29-32,106-141`): the ritual has no first-visit concept at all — it plays in full every time the screen mounts.

This is the exact tax Dashboard already deliberately avoids: `app/dashboard/page.tsx:746-751` gates its own use of the same component behind `isFirstVisit`, precisely because — per that file's own code comment — replaying it on every visit "sería justo el tipo de fricción repetitiva que `PRESENCE_PRINCIPLES.md` pide evitar" (would be exactly the kind of repetitive friction `PRESENCE_PRINCIPLES.md` asks to avoid). The component's own docblock even records a prior, real product complaint about this ritual feeling slow ("la esfera toma mucho tiempo") — which already got the duration cut from 2750ms to 1900ms — without ever revisiting whether it should replay at all on the single most-used screen in the product. If chat is opened daily, this is an unconditional ~1.9-second tax paid every single time, for a "LUZ waking up" moment that stopped being new after the first day.

**Recommend:** gate `/chat`'s ritual the same way Dashboard already gates its own use of the identical component — first-ever-conversation only. This is the highest-confidence, lowest-risk fix in this entire document: it's applying a pattern the team has already built, tested, and shipped once, to the one place that never adopted it.

### Other candidates, lower confidence, worth a look

- `/life` runs 8 independent `Promise.allSettled` fetches on every visit, then fires three delayed `router.refresh()` calls at 3s/7s/15s after mount to catch asynchronously-written life-graph rows. Each piece is individually justified (degrade independently, catch late writes) but stacked together this is up to four full data cycles within 15 seconds of arriving at the screen — worth checking for visible layout shift while someone is mid-read, and whether three staggered refreshes are still needed or whether the underlying async-write race they're compensating for has a cheaper fix.
- What's already right and shouldn't change: the typing indicator is explicitly documented as "never a spinner" — a deliberate pacing signal, not a load state (`components/ui/typing-indicator.tsx`); Dashboard's five independent data loads were already parallelized specifically to fix a real "today takes several seconds to load" complaint (`app/dashboard/page.tsx:158-181`); and SSE streaming means a chat reply starts appearing before it's finished generating. These are the right patterns — the recommendation in this section is to apply the first one consistently, not to introduce new ones.

---

## Roadmap

Sequenced against `ADR-0018`'s own post-freeze priority order (response quality, onboarding, visible memory, proactive insight) and split by the Tier 1 / Tier 2 distinction from the core thesis.

### Alpha now — Tier 1, no data dependency

1. Dashboard trim: cut the postponed note and recent-conversations sublist, move the full calendar list off Today, merge the memory teaser into what-changed (Section 1, 4).
2. `/chat` opening-ritual fix: gate on first-ever-conversation, matching Dashboard's existing pattern (Section 8) — do this first; it's the single highest-confidence item here.
3. Memories landing view: promote Highlights above the chronological time buckets, which become the "show everything" fallback (Section 3) — ships gracefully even with thin signal today.
4. Response Reading Guidelines doc + a "too long/short" tag on `/feedback` (Section 6).
5. Life Domain lens on `/life`, including its honest thin-state copy (Section 5, item 1–2) — the one concretely-shippable piece of "financial intelligence" this iteration, and it generalizes to all eight domains for free.
6. Mobile tap-target measurement pass on the header nav (Section 7).

### Beta — Tier 2, validate after the retrieval/recall fix lands

7. Generic Belief trend/contradiction surfacing on `/life/identity` (Section 5, item 3) — same mechanism serves finances the moment financial Belief data exists.
8. Memory "Stories" (rendered `MemoryConnection` clusters) and richer Highlights (Section 3) — both inherit the same recall dependency directly; will look thin until it ships.
9. The financial-question honesty rule (Section 5, item 4) can ship any time — it's a content rule, not dependent on data volume — but its value is small until there's more for LUZ to have an opinion about.

---

## What this document does not cover

Named explicitly so nothing here is mistaken for a silent scope expansion:

- No new `core/*-engine`, no Memory Engine schema change (no amount/currency/category field), no fix to the `rank_score` recall bottleneck or the Knowledge Engine pipeline itself — all owned elsewhere, tracked by `ADR-0022` and the `2026-08-02` investigations.
- Pre-auth funnel instrumentation (`EXPERIENCE_AUDIT_V1.md` H2) — still open, still not this document's.
- `/chat`'s placeholder text (`EXPERIENCE_AUDIT_V1.md` H1) — still open, needs tone work that document already flagged as risky to solve badly; not repeated here.
- `/conversations` pagination-by-category (`EXPERIENCE_AUDIT_V1.md` H7) — already explicitly deferred to Beta by that document.
- The `Life`/`Memories` content overlap named in `ALPHA_EXPERIENCE_V1_DESIGN.md` §7 as an accepted, un-resolved risk — still accepted, still un-resolved here; this document didn't find new evidence that changes that call.

---

## Open questions for Founder confirmation

Real judgment calls this document intentionally leaves open rather than deciding unilaterally:

1. **Bottom tab bar vs. keeping the header nav** (Section 7) — only worth doing if the tap-target measurement confirms a real problem; a navigation-pattern change touches every screen and shouldn't happen on suspicion alone.
2. **Cutting the Dashboard's recent-conversations list outright** (Section 1) versus keeping a lighter version intentionally — this document's position is that `/chat`'s "Historial" link already solves discovery, but that's a judgment call about redundancy, not a measured fact.
3. **Whether the Life/Memories overlap is worth resolving now** — `ALPHA_EXPERIENCE_V1_DESIGN.md` already accepted this risk once; this document didn't find a new reason to reopen it, but flags that it's still there.
