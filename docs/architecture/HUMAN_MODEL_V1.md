# Human Model v1

Version: 2.0 — final conceptual architecture (consolidates v1.0 and
v1.1)\
Status: Proposed — awaiting Founder confirmation\
Related: ADR-0008 (Reality Model), ADR-0009 (Person not User), ADR-0011
(Identity Architecture), ADR-0013 (Reality Snapshot Contract), ADR-0015
(Connector Architecture), `DOMAIN_MODEL_V1.md`, `MEMORY_MODEL.md`,
`KNOWLEDGE_MODEL.md`, `PERSON_MODEL.md`, `LIFE_MODEL.md`,
`RELATIONSHIP_MODEL.md`, `TRUST_MODEL.md`, `INTELLIGENCE_MODEL.md`,
`docs/foundations/FOUNDER_INTENT.md`,
`docs/foundations/HUMAN_RELATIONSHIP_MODEL.md`,
`docs/product/HUMAN_EXPERIENCE_DATASET_V1.md`

This is intended as the canonical architecture reference for the Human
Model going forward. It does not modify any existing ADR, does not
authorize any implementation, and does not change `RealitySnapshot`,
`core/knowledge-engine`, `core/memory-engine`, or any frozen contract.
It remains **Proposed** until the Founder confirms it — nothing
in this document self-authorizes its own status.

Every section should be read against one standing question:

> **How does this architectural decision help LUZ understand a human
> being better?**

If a proposed field, mechanism, or store cannot answer that question,
it does not belong in the Human Model.

---

## 1. What the Human Model is

**The Human Model is the structured and evolving representation of the
understanding LUZ has about a person.**

It is:

- **A representation, not a record.** A record states a fact
  ("this person ran a marathon on this date"). A representation holds
  what that fact *means* about the person, with how confident LUZ is
  in that meaning, and what supports it.
- **Evolutive.** It does not describe a person once — it tracks how
  that description changes, and holds its own history of having
  changed (Section 5).
- **Organized by domain**, not by which engine produced the data
  (Section 3). A domain is a human-meaningful area of understanding,
  never a database table.
- **Evidence-based**, never speculative. Nothing in the Human Model
  exists without a citable source in Memory, Knowledge, or `core/life`
  (Principle 2, Section 2).
- **Never a duplication of Memory or Knowledge.** It does not store
  what happened (Memory's job) or the individual derived claims about
  it (Knowledge's job). It stores what those, taken together, add up
  to about one person.

It is explicitly:

- **Not Memory.** Memory is evidence — what happened. The Human Model
  never stores raw content.
- **Not Knowledge.** An `Insight` is one derived, evidence-backed
  claim. The Human Model is not a second ledger of insights — it is
  what a person's accumulated, validated insights add up to, across
  domains and across time.
- **Not a profile.** A profile is a static set of fields filled in
  once. The Human Model has no "complete" state, no fixed schema of
  facts to collect — it is a live account of understanding that is
  always partial and always revisable.
- **Not a source of truth.** This is the single most important
  boundary in this document: **the Human Model is a representation
  derived from the system's sources of truth.** Memory, Knowledge, and
  `core/life` (Life) are, and remain, the only sources of truth in the
  system. If a characterization and its underlying evidence ever
  disagree, the evidence is right and the characterization is stale —
  never the reverse.

**Why it cannot simply be recomputed on demand, the way
`RealitySnapshot` is:** deciding whether a new piece of evidence is a
reinforcement, a contradiction, or an evolution (Section 5) requires
comparing it against the Human Model's *own current state* — not
against the raw evidence pool from scratch. Two people with identical
Knowledge records but different revision histories have different
Human Models. That is only possible because the model persists and
accumulates in its own right, incrementally, the same way a
relationship is not the sum of its conversations replayed, but the
understanding that persists between them.

### How it differs from its neighbors

| | Memory | Knowledge | RealitySnapshot | Connectors | **Human Model** |
|---|---|---|---|---|---|
| Answers | What happened? | What does it mean? | What's true right now? | Where does external data come from? | **Who is this person, and what do they need to be accompanied well?** |
| Source of truth? | Yes | Yes | No — a read over sources of truth | No — a stateless adapter | **No — derived, never authoritative** |
| Persisted? | Yes | Yes | No — assembled on demand (ADR-0013) | No | Yes — representation, confidence, evidence pointers, and history only |
| Written by | Memory Engine | Knowledge Engine | An unowned future assembler | Nothing yet (ADR-0015) | Human Model Update Engine (Section 6) |
| Consumed by | Knowledge | Human Model, future Context | Knowledge, future Context | The `RealitySnapshot` assembler | Presence, Life Orchestrator, Conversation, Context |

The layering is strict: **Memory → Knowledge → Human Model.** Whether
the Human Model may also read Conversation directly is not settled —
see Section 6.

---

## 2. Principles

Five principles govern every design decision about the Human Model.
They extend, and must never contradict, the nine permanent principles
already established for every LUZ engine.

### No Duplication

The Human Model never stores a fact that already has a canonical home
elsewhere. This follows directly from Section 1's boundary: because
the Human Model is never a source of truth, it has nothing to protect
by holding its own copy of anything — every fact it needs is one
reference away, in Memory, Knowledge, or `core/life`. If a
characterization cannot be traced back to one of those, it should not
exist. This is not a storage-efficiency rule. It is what keeps the
Human Model from becoming a second, competing account of a person that
can silently drift out of sync with what is actually true — the exact
failure mode ADR-0012 and ADR-0014 already had to correct elsewhere in
this system.

### Evidence Before Inference

The Human Model never characterizes ahead of what evidence supports.
It does not form a hunch and then look for evidence to justify it —
evidence must exist and be validated *first*; the characterization is
built strictly on top of it, never ahead of it. This is the same "LLM
proposes, LUZ decides" discipline already load-bearing in
`core/knowledge-engine`, applied one layer up: nothing may be
inferred about a person that isn't already, independently, supported
by something Knowledge has validated or `core/life` has confirmed.

### Confidence Is Gradual

Nothing in the Human Model is ever certain, and nothing becomes
confident from a single data point. Confidence rises with
corroborating evidence, with diminishing returns — the first piece of
evidence for a new characterization moves confidence far more than the
tenth confirming one. Confidence has a ceiling below certainty, and it
can decay if a characterization goes long unreinforced (Section 4).
Treating an inference as settled fact the moment it first appears is
the fastest way for this model to become untrustworthy.

### Every Characteristic Can Change

No characterization is permanent. Every one is a current best
understanding — timestamped, revisable, and eventually supersedable.
This is not a technical convenience; it is a direct extension of
treating a person as someone who is still becoming who they are.
Storing a static, unrevisable label ("this person is anxious," "this
person is unreliable") is the single most damaging failure this
principle exists to prevent — damaging to trust, and to the person,
since it means LUZ has stopped seeing them and started filing them.

### Understanding Before Classification

Classification is fast, tidy, and satisfying to build — sort a person
into a category and move on. Understanding is slower, messier, and
often resists a clean label. The Human Model exists to do the second
thing, not the first. When the two are in tension — when a clean
classification would be easier to store and query than an honest,
qualified, evidence-bounded characterization — understanding wins,
even at the cost of being harder to engineer. This is why Section 5's
domains are described as *what a domain represents*, never as a
taxonomy to sort people into, and why clinical diagnoses and permanent
labels are excluded outright in Section 5.

---

## 3. Domains

A domain is a human-meaningful area of understanding, not a database
table. This is the definitive v1 list — deliberately extensible, the
same discipline `ExternalSignalSource` (`core/reality`) already uses
for growth: a new domain is an addition, never a breaking change to
the ones that already exist.

**Identity** is responsible for who this person is, structurally —
name, life stage, roles they hold. The thinnest and most stable
domain; it changes rarely, and slowly.

**Communication** is responsible for how they prefer to be talked to
— tone, directness, pace, what kind of care lands as support versus
as intrusion. This is specifically about the texture of dialogue
itself, distinct from Preferences below.

**Values** is responsible for what matters to them, demonstrated more
than stated — not what they say they value once, but what they
consistently act from, even when it's in tension with other domains
(Section 7).

**Life Story** is responsible for the throughline — where they've
been, what shaped them, the chapters that explain the present. This is
the domain most directly built from a person's own account of
themselves over time, rather than from inferred patterns.

**Relationships** is responsible for who matters to them and how. It
reflects `core/life`'s `Relationship` entities, but represents what
each relationship *means* to the person, not merely that it exists —
the human weight behind a connection the structured graph only
records as a fact.

**Health** is responsible for physical and practical wellbeing
patterns relevant to how LUZ shows up for them — never a medical
record, never a diagnosis (Section 2, Understanding Before
Classification).

**Work** is responsible for what they do and how they relate to it —
pressure, purpose, transitions. It draws on `core/life`'s structured
`career`-domain items, but represents the human relationship to work,
not just its facts.

**Habits** is responsible for recurring behavior and its trajectory —
draws on `core/life`'s `Habit`/`Routine` entities, plus *how it's
going*, which those entities don't carry on their own.

**Goals** is responsible for what they're working toward and why it
matters to them — draws on `core/life`'s `Goal`/`Project`, plus the
human stakes behind them. Distinct from Growth below: a Goal
characterization is about a specific, nameable pursuit; Growth is
about the trajectory of the person across many pursuits, including
ones that were never formalized as a goal at all.

**Emotional Patterns** is responsible for recurring emotional weather,
not diagnosis — what tends to trigger stress, what tends to restore
them. The domain most directly governed by Section 2's "Understanding
Before Classification" — the temptation to reduce this to a label is
strongest here, and most damaging if taken.

**Preferences** is responsible for practical, lower-stakes likes and
dislikes that shape day-to-day interaction but don't rise to the
level of Values — preferred times, formats, level of detail, kinds of
activities enjoyed. Distinct from Communication: Communication governs
how LUZ talks; Preferences governs the broader shape of what the
person tends to want, in and out of conversation.

**Growth** is responsible for the trajectory of change itself — not
any single goal's status, but the meta-pattern of how the person is
developing over time. This domain exists specifically because of
evidence already gathered elsewhere in this project's foundations: the
Founder's own account of LUZ's most meaningful moments is about
witnessing growth, not task completion (`docs/foundations/FOUNDER_INTENT.md`;
`docs/foundations/HUMAN_RELATIONSHIP_MODEL.md`, Section 8). Growth is
what gives that idea an architectural home, independent of whether any
particular Goal was ever formally tracked.

Deliberately **not** a domain in v1: anything requiring clinical
judgment, and anything about people who are not members of the
person's own `LifeGraph` (Section 4).

**A note on naming collision, preserved from earlier drafts:**
`core/life/value-objects/life-domain-type.ts` already defines
`LifeDomainType` (`health`, `career`, `finances`, `relationships`,
`personal_growth`, `leisure`, `home`, `spirituality`) — the "wheel of
life" categories used to classify *structured items*. Human Model
domains are a different, overlapping-but-not-identical vocabulary —
they represent *understanding*, not structured records, and the two
should not be merged.

---

## 4. Characteristics of a characterization

Every domain characterization is defined by five properties. This
section describes their conceptual behavior only — no structure, no
schema.

**confidence** is not a single number treated as ground truth — it is
a trajectory. It rises with corroborating evidence, with diminishing
returns, and it has a ceiling below certainty (Section 2). It can also
decay over time if a characterization goes unreinforced, so that
staleness is visible rather than mistaken for continued accuracy.
Confidence is never assigned by generation directly — only by
validation, one layer down, in Knowledge.

**evidence** is not the evidence itself — it is a set of pointers to
the validated Insights and confirmed `core/life` facts that support
the characterization (No Duplication). Evidence pointers are
conceptually append-only: new supporting evidence adds to the trail.
An individual pointer can be marked as no longer supporting the
current characterization without being deleted — a soft invalidation
that is itself part of the characterization's history, not an erasure.

**revision_state** is the characterization's position in its own
lifecycle — `Unformed`, `Emerging`, `Established`, `Reinforced`,
`Under Revision`, `Superseded` (Section 5). Every consumer of the
Human Model should check this before deciding how much weight to give
a characterization — one `Under Revision` deserves active caution,
never the same trust as one `Reinforced` for years.

**last_updated** is deliberately ambiguous unless split into two
questions: when was this characterization last *reinforced* (new
corroborating evidence arrived, whether or not anything changed), and
when did it last *change* (confidence or revision state actually
moved). A characterization can be reinforced repeatedly without
changing at all — the distinction matters for Section 5, where a
contradiction is compared against what changed, not merely what's
recent.

**history** is an ordered account of what a characterization used to
be, before each supersession — never deleted (Every Characteristic Can
Change). This is not bookkeeping for its own sake: "LUZ used to
understand this differently, and here's when and why that changed" is
itself part of what makes a relationship long-term rather than a fresh
start every time. `history` is also what `Under Revision` (Section 5)
depends on to recognize whether a new contradiction is genuinely new,
or an echo of one already resolved before.

---

## 5. Evolution: observation, contradiction, and natural change

This is the most consequential judgment the architecture makes.

**A new observation** is evidence that lands in a domain with no
established characterization yet, or that agrees with the current one.
This is the simple case — it reinforces the existing trajectory, or,
if the domain was `Unformed`, creates a new `Emerging`
characterization. No tension, no waiting.

**A contradiction** is evidence that disagrees with an `Established`
or `Reinforced` characterization. The critical rule: **a contradiction
never overwrites.** It moves the characterization to `Under Revision`
— a state that exists specifically so LUZ is never forced to choose,
in the moment, between "the old understanding was right" and "the
person has changed." Both possibilities are held open at once, with
reduced confidence in the old characterization, until one of two
things resolves it: the contradiction does not recur, in which case
the characterization reverts to `Reinforced` (never fully back to its
prior confidence — a resolved exception is still informative and
stays in `history`); or the contradiction recurs, independently,
across more than one interaction separated in time — the same
corroboration discipline already used in `core/knowledge-engine` (a
single signal is not a pattern) — in which case it becomes the third
case.

**A natural evolution** is a contradiction that has been corroborated
over time. It is no longer treated as a contradiction — it is treated
as the person changing, which is not a failure of the model but
exactly what a long-term companion is supposed to notice. The old
characterization is `Superseded`, never deleted (`history` preserves
it), and a new `Emerging` characterization takes its place —
`Emerging`, not `Established`: evolution restarts confidence rather
than inheriting it, because the new understanding has not yet earned
the same trajectory the old one had.

**Why `Under Revision` is the most important state in this document:**
without it, the architecture is forced into a false binary — treat
every contradiction as noise (and fail to notice when someone
genuinely changes) or treat every contradiction as change (and become
volatile, reversing itself after one unusual interaction). `Under
Revision` is what lets the Human Model hold genuine uncertainty
instead of collapsing it prematurely in either direction.

---

## 6. The Human Model Update Engine

A conceptual engine — following the same lifecycle every LUZ engine
follows (Observe → Interpret → Decide → Publish → Persist → Sleep) and
the same manifesto rule (no engine owns another engine). Adding it
formally to the engine manifesto is a future ADR decision; this
document proposes its shape, not its ratification.

**Responsibility.** Decide what, if anything, changes in the Human
Model after new understanding exists. It is the *only* writer of Human
Model state — no other engine, route, or feature may touch it
directly, the same single-writer discipline already enforced one layer
down in `core/knowledge-engine`.

**What it does not decide, yet: where its input comes from.** Three
alternatives remain open, compared here without a recommendation.

**Alternative A — Conversation → Human Model.** The engine reads
conversational turns directly, bypassing Knowledge's validation
pipeline. *Advantage:* lowest latency — an explicit, unambiguous
self-statement could update the Human Model immediately. *Risk:* this
is in direct tension with Evidence Before Inference — it reintroduces,
at this layer, exactly the risk the Memory → Knowledge validation
gate exists to prevent. Making it safe would require inventing a
second validation gate at this layer, duplicating logic Knowledge
already owns. *Complexity:* deceptively low to build, high to make
correct.

**Alternative B — Knowledge → Human Model only.** The engine reads
only validated `Insight`s. *Advantage:* reuses Knowledge's entire
validation and confidence apparatus with zero duplicated logic — every
Human Model change traces to a validated Insight, to Evidence, to
Memory, one complete inspectable chain. *Risk:* latency in the
other direction — an obviously true, explicitly self-reported fact
still waits for the full Knowledge pipeline, even where a human would
consider it immediately settled; and the Human Model inherits every
blind spot Knowledge has, with no independent check. *Complexity:*
lowest of the three — the real cost was already paid building
Knowledge.

**Alternative C — Hybrid.** Knowledge remains the primary path for
inferred, pattern-based understanding, as in B. A second, narrower
path exists specifically for explicit, self-reported, unambiguous
statements, gated by something lighter-weight than Knowledge's full
pipeline but not absent. *Advantage:* addresses B's latency weakness
for exactly the case it's worst at, without inheriting A's full risk.
*Risk:* two update paths is more architectural surface than one, and a
lightweight gate can be under-specified or scope-creep over time.
*Complexity:* highest of the three — two well-bounded gates instead of
one.

**No alternative is selected.** Whichever is chosen, it must not
weaken Evidence Before Inference — the open question is how many
gates enforce it and how fast each one is, not whether it holds.
Everything below is written against Alternative B as the current
default, and should be revisited once this is decided.

**Limits, under the current default:** never reads raw Memory
directly; never reads `RealitySnapshot` directly (it consumes
Knowledge's already-validated output, not the reality Knowledge itself
consumed — duplicating that consumption path would mean two engines
independently reinterpreting the same raw reality with no guarantee
they agree); never runs synchronously inside a chat request/response
cycle, the same posture Knowledge Engine already has; never invents a
characterization the cited evidence doesn't support; never deletes,
only supersedes, with full `history` preserved.

**Relation to Memory:** none, direct, under Alternative B.
**Relation to Knowledge:** its primary upstream dependency under every
alternative.
**Relation to RealitySnapshot:** none, direct — it is downstream of
whatever consumed it, not a second consumer.
**Relation to Chat:** none, direct, under Alternative B — Chat produces
what Memory captures and Knowledge interprets; the Update Engine only
sees Knowledge's output, asynchronously, after a conversation has
already returned its response. A companion that visibly "updates its
model of you" mid-conversation would feel surveilled, not accompanied
— this should hold regardless of which alternative is eventually
chosen.

---

## 7. Scoping: one person, or every relevant person?

**The question:** within a shared `LifeGraph` (a family, a household,
an organization), should a Human Model exist only for the owner — the
person who authenticated — or for any `Person` member LUZ has a
genuine, direct relationship with? This is not resolved in this
document. It is analyzed as a trade-off for the Founder to
decide.

**Owner-only** is the simplest possible scoping, and matches how the
system mostly behaves today. Its advantage is that it avoids the
sharpest privacy risk outright: LUZ never builds an understanding of
someone who has not directly, consensually interacted with it — a
spouse or child mentioned in conversation stays exactly what Section 4
already says they should be, relationship data from the owner's
perspective, never a subject of their own model. Its disadvantage is
that it caps what LUZ can become for shared households — even if two
members of a family both use LUZ independently, each is only ever
understood through the other's testimony, never directly.

**Any relevant Person** is more consistent with the domain
philosophy already established (Person, not User — every human being
a first-class subject, not just the account holder). It would enable
real shared or family companionship: each member's understanding
grows on its own merits. Its risk, without a hard rule, is that it
collapses back into exactly the shadow-profile problem Section 4
already forbids — building an "understanding" of someone purely from
another member's testimony, without their own relationship with LUZ.
A safe version would need to restrict itself to people with their own
directly-attributable evidence, never a Human Model built purely from
being mentioned by someone else.

**Consequences either way:** owner-only requires no change to Memory
or Knowledge — both can keep their current loose, optional `personId`
attribution. Any-relevant-Person requires that attribution to become
reliable, and likely mandatory, across two already-shipped engines —
not a small change, and one that would need its own authorization
separate from this document. If there is any real chance of a
shared-household product direction within this model's expected
lifetime, it is materially cheaper to require that attribution from
the start than to retrofit it later on data that was never captured
with that rigor.

---

## 8. Architectural Risks

An architecture that only describes its own success is not
trustworthy. This section names four ways the Human Model could fail
in practice, with mitigations stated rather than hidden.

### Degradation over time

Confidence with no ceiling and no decay lets a characterization
repeated often — but never truly re-examined — reach near-certain
confidence purely from frequency, not depth: a frequency bias that
mirrors recency bias, quietly substituting "said many times" for
"well understood." Separately, if Knowledge Engine's own methods
improve over the product's lifetime (from deterministic keyword
matching toward something more capable), characterizations built under
the old methods and the new ones will differ in quality for reasons
that have nothing to do with the person — a person's Human Model could
show uneven depth across domains purely based on *when* each was last
touched relative to a Knowledge Engine upgrade, not on anything real
about them. *Mitigation:* a confidence ceiling and decay (Section 4),
and versioning evidence by which generation of Knowledge Engine
produced it, treating a major upgrade as a trigger to re-evaluate —
never to silently rewrite — existing characterizations.

### Duplication of information

The central bet this document makes is that representation, not
duplication, is workable in practice (No Duplication, Section 2). If
characterizations end up needing enough embedded content to be useful
that they become a de facto second copy of Knowledge, this layer
collapses into exactly the "two things meaning the same thing" failure
ADR-0012 and ADR-0014 already had to correct elsewhere in this system.
*Mitigation:* treat this as a falsifiable bet, not a settled fact —
worth deliberately revisiting once a first real domain is built, with
a willingness to conclude the bet was wrong rather than defend it past
the evidence.

### Inconsistency

Two distinct inconsistency risks exist. The first is *within* a
domain over time — handled by Section 5's `Under Revision` mechanism,
which exists specifically to prevent silent, ungoverned overwrites.
The second is *across* domains at the same moment — a person can
hold real, unresolved tension (valuing family while overworking), and
forcing that into a single tidy picture would make the model dishonest
rather than coherent. *Mitigation:* contradictions across domains are
logged, not resolved by default; change in one domain never cascades
automatically into another — any cross-domain implication is itself a
candidate new Insight, evaluated through the normal validation gate,
never an automatic propagation. A third, quieter inconsistency risk is
process, not data: if a future feature starts reading the Human Model
as authoritative because it's faster than tracing back through
Knowledge, Section 1's "never a source of truth" boundary erodes in
practice even though no document ever authorized it. *Mitigation:* no
architecture document can fully prevent this — the practical guard is
a standing review question: any feature reading the Human Model must
be able to answer "why" by walking the evidence chain back to
Knowledge; if it can't, it is treating the Human Model as a source of
truth it isn't.

### Loss of utility over time

Confidence, evidence, and history accumulate per domain over years
without a proposed consolidation mechanism in this document — the
Human Model's long-term scalability inherits directly from whether
Memory's own, already-named-but-unbuilt `Consolidate` stage ever gets
built, and should not be solved twice. A related, sharper failure: the
model's revision discipline is tuned for gradual change and is close
to wrong for the highest-stakes case — someone in a sudden crisis
(job loss, grief, a diagnosis) needs LUZ to adapt faster than
corroboration-over-time normally allows, and a model that keeps
weighing stale pre-crisis characterizations for weeks has lost
exactly the utility it exists to provide, at exactly the moment it
matters most. *Mitigation, not adopted here:* a distinct,
faster-moving revision policy for high-salience moments — detected
how, and gated by what, is an open problem, named so it isn't
quietly assumed away rather than solved prematurely.

---

## 9. Open questions

Recorded deliberately, not resolved:

1. **Scoping (Section 7):** owner-only, any relevant Person, or a
   middle position restricted to people with their own directly
   attributable evidence?
2. **Update source (Section 6):** Knowledge-only, Conversation-direct,
   or hybrid?
3. Where does synthesis language come from, if a written
   characterization ever needs generated text rather than a
   structured tag — under what validation gate?
4. Does Context Engine read the Human Model directly, or does it
   become part of a future, still-unowned `RealitySnapshot` assembly?
   ADR-0013 is frozen; this document does not propose touching it.
5. What does "forgetting" mean for a *representation* rather than a
   raw record, when a deletion request must propagate here?
6. Is "Human Model Update Engine" the right unit, or should each
   domain be its own small engine, the way Knowledge's pipeline is
   composed of swappable per-concern strategies?
7. Does the crisis-responsiveness gap (Section 8) need a dedicated
   mechanism, or is it an acceptable, named limitation of v1?

---

## 10. What this document does not do

- It does not modify `RealitySnapshot`, `core/knowledge-engine`,
  `core/memory-engine`, `core/life`, `core/connectors`, or any ADR.
- It does not authorize implementing the Human Model or the Human
  Model Update Engine.
- It does not add "Human Model" to the engine manifesto — that
  requires its own ADR, once this proposal is confirmed.
- It does not select a scoping model (Section 7) or an update source
  (Section 6) — both are recorded as open, analyzed trade-offs.
- It does not invent capabilities outside LUZ's current vision — every
  domain, principle, and risk here traces back to something already
  established in `docs/vision/`, `docs/concepts/`,
  `docs/foundations/`, or an existing ADR, made concrete rather than
  newly imagined.
