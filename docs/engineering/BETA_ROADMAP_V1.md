# Beta 1 — Technical Roadmap

Version: 1.0\
Owner: Lead Engineer, validated against Founder Intent, Human
Relationship Model, Human Model, and Reality Snapshot\
Scope: engineering only — this is not a company roadmap, it does not
cover positioning, pricing, or go-to-market

**Status update (2026-07-19, addendum — original text below unchanged):**
the AIProvider structured-output decision this roadmap names as a
blocking gate throughout Section 4, Section 5 (Sprint B2), and Section
8 is now resolved — see ADR-0016. `AIProvider.generateStructured<T>()`
is implemented, verified against the real OpenAI API. `ExtractStage`
and `InsightGenerationStrategy` (Sprint B2 PR-8/PR-9) can now be built
against it.

Before writing this, I checked for a contradiction between what's
built and the four foundational documents serious enough to require
stopping. I didn't find one. What I found instead is a gap, not a
violation: the architecture this project has spent months designing
correctly is not yet connected to what a real person using LUZ today
would actually experience. That gap is the entire subject of this
roadmap.

---

## 1. Current state of the repository

**What's real, tested, and works today:**
- **Identity/Auth** — Google OAuth via Auth.js, database-backed
  sessions, `LifeGraph`+`Person` bootstrapped on first login, logout
  verified to revoke server-side. Confirmed end-to-end with a real
  login, not just code review.
- **Chat, structurally** — `/chat` is protected, a message can be sent,
  a reply is requested from OpenAI, both are stored. Currently broken
  only by a placeholder `OPENAI_API_KEY` — an environment problem, not
  a code problem, already diagnosed.
- **Memory Engine (M2)** — `core/memory-engine` is fully implemented:
  capture, deterministic classification, deterministic ranking,
  structural connection, archive, forget, structured retrieval. Real
  Drizzle persistence. Verified with fakes at each step.
- **Knowledge Engine (M3), 7 of 10 planned pieces** —
  `core/knowledge-engine` has real, tested implementations of
  classification, validation, relationship-finding, persistence, and
  the repository layer. Missing: the two AI-backed stages (Extract,
  Generate) and the orchestrator that composes all six stages into one
  runnable pipeline.
- **`core/life`** — `LifeGraph` and `Person` are the only entities with
  real database persistence. `Goal`, `Project`, `Habit`, `Routine`,
  `Relationship`, `LifeEvent`, `LifeDomain` exist as domain types and
  interfaces only — no Drizzle repository implements them yet.
- **`core/reality` (RealitySnapshot)** — the contract is frozen and
  correct (ADR-0013). No assembler exists. Nothing produces a real
  `RealitySnapshot` from real data today — this is confirmed unowned,
  not overlooked.
- **`core/connectors`** — contract only (ADR-0015). No Connector has
  ever been implemented. No Gmail, no Calendar, nothing.
- **Human Model, Human Relationship Model** — fully designed in
  `docs/architecture/` and `docs/foundations/`. Zero code. No entity,
  no schema, no engine.
- **`core/context-engine`** — contract scaffolding only, same posture
  Knowledge Engine had before M3. No implementation, not started.

**The one fact that should shape everything below:** the real,
tested engineering work from M2 and M3 is **not wired into the live
product**. Today, sending a message in `/chat` writes a row to
`conversation_messages` and enqueues the *legacy* `core/knowledge`
pipeline (mostly unimplemented stubs, still the live one) — it never
calls `MemoryEngine.capture()`. `core/memory-engine` has zero
consumers in the running application, confirmed by grep, same as the
legacy module it was built to replace. This is not a contradiction of
architecture — nothing was built wrong. It's sequencing: persistence
was built (M2, M3 so far) before wiring (never scheduled yet). Closing
that gap is the fastest, highest-leverage thing this roadmap can
propose.

---

## 2. Objective of Beta 1

A real person can talk to LUZ, and what they say is actually
**remembered** — not stored as a transcript, but captured as Memory,
the same Memory Engine architecture already built and tested. That is
the bar. Producing deep Knowledge, a populated Human Model, or any
Connector integration is explicitly **not** required for Beta 1 — each
of those has its own dependency chain (Section 5) that would delay
this bar for no benefit to it.

This is a deliberate, narrower target than "everything designed so
far." Per Founder Intent, LUZ's value is a relationship that
accumulates over time — Beta 1's job is to make sure that
accumulation actually starts happening in the real product, honestly,
even in its simplest form, rather than to front-load every layer
before anyone has talked to LUZ once.

---

## 3. Technical principles for this phase

- Every implementation is checked against Founder Intent, Human
  Relationship Model, Human Model, and Reality Snapshot before it's
  built — not after.
- Small, additive, independently reviewable PRs — same discipline as
  M1–M3.
- No architecture changes without explicit confirmation. Wiring
  existing engines into the live path is integration work, not
  redesign — but where it touches a phased plan already on record
  (ADR-0012's Phase C, for example), that's flagged explicitly, not
  assumed.
- Build the shortest real path first. Resist finishing every engine
  before any of them are load-bearing.
- If code and architecture disagree, stop and explain before writing
  anything — the standing rule for this phase, not a one-time check.

---

## 4. What's missing for a first-time user

Stripped to the essentials, in the order they actually block a real
person:

1. A real `OPENAI_API_KEY` — blocks everything, zero engineering
   effort, Founder action.
2. Memory Engine wired into the live chat path — without this,
   nothing said to LUZ is ever remembered, no matter how well-built
   Memory Engine is in isolation.
3. A minimal `RealitySnapshot` assembler — without this, Knowledge
   Engine's remaining stages have nothing real to run against, only
   fakes.
4. A decision on how the AI-backed Knowledge stages get structured
   output from `AIProvider` (today: raw text only) — blocks Extract
   and Generate specifically.
5. The Knowledge Engine orchestrator, and a decision on whether/how it
   gets a live caller (Section 5's Phase C question).

Everything past this list — Human Model, Connectors, Context Engine —
is real future work, not a blocker to a usable Beta.

---

## 5. Roadmap by sprint

### Sprint B1 — Make the golden path real

**Goal:** a message sent in `/chat` produces a real, ranked, connected
`Memory` row — not just a transcript entry.

- Founder supplies a real `OPENAI_API_KEY`.
- Wire `features/chat/services/send-message.ts` to call
  `MemoryEngine.capture()` for each exchange, alongside (not
  replacing) the existing `conversation_messages` write — the two
  serve different purposes: `conversation_messages` is the UI's
  chat-history log, `Memory` is the evidence store the rest of the
  architecture depends on. Coexistence, not migration, is the scope
  here.
- **Flagged, not decided by me:** this is additive integration, not
  the Phase C cutover ADR-0012 describes ("not yet authorized") — it
  adds a new call site, it does not retire `core/memory/` or migrate
  an existing consumer. Worth a one-line confirmation before starting,
  since it's the first time M2's work becomes load-bearing.
- **Definition of done:** a real conversation in Beta produces
  verifiable rows in `memories` and `memory_connections` — checked
  directly against the database, not assumed from code review.

### Sprint B2 — Give Knowledge Engine something real to read

**Goal:** the Knowledge Engine pipeline runs end-to-end against real
data at least once.

- **Decision first, code second:** how do `ExtractStage` and
  `InsightGenerationStrategy` get structured output from an LLM, given
  `AIProvider.generateReply()` returns raw text only? This is a public
  interface question (`12_DECISION_BOUNDARIES.md`) — needs
  confirmation before either stage is written, not decided
  unilaterally.
- Build a minimal `RealitySnapshot` assembler: `memory` populated from
  the now-real Memory Engine (Sprint B1), `life` deliberately left
  empty (`core/life`'s `Goal`/`Project`/`Habit` repositories don't
  exist yet — Section 6 covers this honestly as a known limitation,
  not a blocker: `REALITY_SNAPSHOT_V1.md` already requires every
  consumer to work reasonably well from partial data), `signals`
  empty (no Connector exists yet).
- Implement PR-8 (`ExtractStage`) and PR-9
  (`InsightGenerationStrategy`), AI-backed, against the resolved
  `AIProvider` decision.
- Implement PR-10 (`DefaultKnowledgeEngine`), composing all six real
  stages.
- **Flagged, not decided by me:** giving this a live caller (replacing
  the legacy `core/knowledge` pipeline the worker currently runs) is
  the Knowledge-side equivalent of a Phase C cutover (ADR-0014) —
  proposed here as Sprint B2's natural conclusion, but not something
  to execute without the same confirmation Sprint B1's integration
  step gets.

### Sprint B3 — Validate and stabilize the golden path

**Goal:** confidence that Sprint B1 and B2 actually work for a real
person, not just in isolation.

- End-to-end manual verification: a real conversation, over multiple
  sessions, produces Memory, produces at least one validated Insight,
  visible in the database.
- Error handling pass on the chat path — what a person sees when the
  AI provider fails, when Memory capture fails, when nothing breaks
  silently.
- Light UI honesty pass — nothing elaborate, just making sure the
  product doesn't visually promise more than Beta 1 actually delivers
  (per `HUMAN_RELATIONSHIP_MODEL.md`'s standing rule against
  overstating presence).

**Deliberately excluded from Beta 1**, each for a stated reason:

- **Human Model + Update Engine** — depends on Knowledge Engine
  producing real, validated Insights first (Sprint B2). Building it
  earlier would mean building against fakes twice.
- **Any Connector, including Gmail** — explicitly deferred by the
  Founder previously; `signals` staying empty is already an
  architecturally acceptable state, not a gap Beta 1 needs to close.
- **`core/life` repositories for `Goal`/`Project`/`Habit`/etc.** — real
  work, not free, and not required for Beta 1's narrower bar (Section
  2). Worth scheduling once Beta 1's golden path is stable, not before.
- **Legacy module cutovers (Phase C for Memory and Knowledge)** —
  cleanup, not a blocker; the legacy modules will simply have fewer
  and fewer real consumers as B1/B2 land, making a future cutover
  progressively cheaper, not more urgent.

---

## 6. Dependencies

```
Real API key
   ↓
B1: Memory wired into chat
   ↓
B2: RealitySnapshot assembler (memory-only) ──┐
   ↓                                          │
AIProvider structured-output decision ────────┤
   ↓                                          │
B2: ExtractStage + InsightGenerationStrategy ─┘
   ↓
B2: DefaultKnowledgeEngine orchestrator
   ↓
B3: end-to-end validation
```

**What can run in parallel, honestly:** the AIProvider decision
(Section 5, B2) doesn't block B1 at all — it can be confirmed while B1
is being built. Error-handling and UI-honesty work (B3) doesn't depend
on B2's internals, only on B1 being stable, so it can start once B1
lands rather than waiting for B2 to finish. Nothing else in this
roadmap parallelizes cleanly — B2's pieces are genuinely sequential
(the assembler needs B1's real Memory; Extract/Generate need both the
assembler and the AIProvider decision; the orchestrator needs all six
stages real).

---

## 7. Risks

- **The AIProvider decision is a hidden dependency for the entire back
  half of this roadmap.** If it isn't resolved early, Sprint B2 stalls
  entirely, not partially.
- **Wiring Memory into live chat is the first time any M2/M3 work
  becomes load-bearing.** Any latent bug that only ad hoc smoke tests
  missed (no formal test suite exists anywhere in this codebase) will
  surface here first, in the real product, not in a fake.
- **A minimal `RealitySnapshot` with `life` permanently empty may
  produce thinner Insights than the architecture is actually capable
  of**, purely because `core/life`'s repositories aren't built yet —
  worth watching during B3, since it affects how fairly Beta 1
  evaluates Knowledge Engine's real quality.
- **No cost or rate-limit posture exists yet for real OpenAI usage** —
  fine for a small Beta, worth naming before it's forgotten.
- **Continuing to build without a test suite compounds** as more
  engines become live rather than isolated — flagged again here
  because Sprint B1 is the moment this stops being a low-stakes
  omission.
- **Legacy `core/knowledge` stays the live pipeline until B2's
  orchestrator has a caller.** Until that cutover is explicitly
  confirmed, Beta 1 users' messages are still, technically, being
  processed by the old stub pipeline in the background — worth being
  precise about internally, even if invisible externally.

---

## 8. Priorities

1. Real API key (Founder, today, zero engineering cost).
2. Sprint B1 in full — this alone turns LUZ from a stateless chatbot
   into something that remembers, which is the entire premise of
   Founder Intent and the Human Relationship Model.
3. The AIProvider decision — small to decide, large in what it
   unblocks.
4. Sprint B2 — makes Knowledge Engine real for the first time.
5. Sprint B3 — confidence, not new capability.
6. Everything in "deliberately excluded" — real, scheduled after, not
   forgotten.

---

## 9. Definition of "Beta ready"

Beta 1 is ready when all of the following are true, verified, not
assumed:

- A real person can log in with Google, have a conversation with LUZ,
  and get a real AI-generated response.
- That conversation produces real `Memory` rows — ranked and
  connected, checked directly in the database.
- At least one real, validated `Insight` has been produced by
  Knowledge Engine from a real conversation, not a fake.
- Logging out and back in preserves the session and the accumulated
  Memory — nothing about the golden path resets per session.
- No step in the golden path fails silently — every failure mode has
  been triggered on purpose at least once and produces an honest
  response, not a generic error or a false success.
- The gap this document opened with — real engineering work sitting
  unconnected to the live product — no longer exists for Memory and
  Knowledge specifically, even if it still exists for Human Model and
  Connectors, which is expected and acceptable at this stage.
