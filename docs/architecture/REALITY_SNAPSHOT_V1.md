# Reality Snapshot v1

Version: 1.0 — architecture reference\
Status: Proposed — awaiting CTO confirmation\
Related: ADR-0008 (Reality Model), ADR-0013 (Reality Snapshot
Contract), ADR-0015 (Connector Architecture), `REALITY_MODEL.md`,
`CONTEXT_ENGINE_SPEC.md`, `docs/architecture/HUMAN_MODEL_V1.md`,
`docs/foundations/HUMAN_RELATIONSHIP_MODEL.md`

This document does not modify ADR-0013, which remains **Accepted** and
frozen exactly as written — `RealitySnapshot`'s shape
(`lifeGraphId`, `capturedAt`, `life`, `memory`, `signals`), the
neutral vocabulary of each section (`LifeStateItem`,
`RealityMemoryItem`, `ExternalSignal`), and the anti-corruption
boundary ADR-0013 already establishes are unchanged. This document is
itself **Proposed**: it is the conceptual and philosophical companion
to that already-accepted contract, intended to become the official
reference for *why* Reality Snapshot exists and *how* to reason about
it — not a redesign of what it is. It does not authorize implementing
any assembler, connector, or engine.

> **If the Human Model answers "who are you?", the Reality Snapshot
> answers "what is happening with you right now?"**

It does not describe the person. It describes the current state of
their reality. It is a living photograph of the present — not an
archive of it.

---

## 1. Definition

A Reality Snapshot is a single, point-in-time read of everything about
a person's current situation that is relevant to interpreting this
moment: what's structurally active in their life, which memories are
relevant to it, and what's happening around them right now. It exists
for one reason — **no engine should ever have to guess at the present
from the past alone.**

It exists because every other layer in this architecture is, by
design, slow. Memory is a record of what already happened. Knowledge
is a derived understanding built up over time. The Human Model is
explicitly built to change gradually, resisting single data points
(`docs/architecture/HUMAN_MODEL_V1.md`, "Confidence Is Gradual"). None
of these layers can tell an engine what is true *right now* — and
without that, even a perfectly accurate understanding of who someone
is can produce a response that is wrong for the moment they're
actually in.

**The problem it solves:** a system that only knows a person deeply
but not presently will keep responding to who they generally are
instead of what they're actually facing. Reality Snapshot exists to
close that gap — cheaply, without becoming a second Memory, and
without pretending to be more durable than it is.

---

## 2. Philosophy: why context-free conversation fails

A conversation with no sense of the present moment is a conversation
with someone who knows the person well but hasn't seen them in a
while and hasn't asked what's going on today. Even a deep, accurate,
long-term understanding produces bad responses without it — not
because the understanding is wrong, but because it's being applied to
the wrong moment.

Concretely: motivational encouragement lands as tone-deaf pressure if
the person is, right now, in the middle of a stressful meeting they
never mentioned before. A thoughtful question about a goal reads as
oblivious if the person is, right now, dealing with something urgent
and unrelated. Silence reads as absence if the person just went
through something significant that hasn't yet become Memory, because
it only happened moments ago. In every one of these cases, LUZ isn't
missing knowledge about the person — it's missing knowledge about
*this instant*. `REALITY_MODEL.md` already states the underlying
claim plainly: reality is the source of truth, and conversations are
only ever observations of it. Reality Snapshot is what makes that
claim operational rather than aspirational — it's the mechanism by
which "reality first" actually reaches an engine's input, instead of
staying a principle nothing consumes.

---

## 3. Responsibilities

**Belongs to the Reality Snapshot:**
- A read of what's structurally active in the person's life right now
  (`life`) — not their whole history, only what's currently live.
- The memory context relevant to interpreting this specific moment
  (`memory`) — not all memory, a relevant slice of it.
- External signals available at the moment of assembly (`signals`) —
  present-tense facts from the world around the person.
- The moment it was captured (`capturedAt`) — every consumer's
  reminder that this is a photograph, not a window.

**Never belongs to the Reality Snapshot:**
- Anything that requires interpretation to be useful. A Reality
  Snapshot reports; it does not conclude. "The calendar shows a
  meeting from 2 to 3" belongs here. "This person seems stressed about
  work" does not — that's Knowledge's job, built from this snapshot,
  never embedded inside it.
- Anything about who the person *is*, in any durable sense — that is
  the Human Model's exclusive responsibility. A Reality Snapshot has
  no memory of the person's identity across time; it is rebuilt from
  nothing every time it's assembled.
- History. A Reality Snapshot from an hour ago is not a smaller,
  older version of one from now — it is simply gone, the same way a
  photograph from yesterday isn't part of today's. If reconstructing
  "what was true an hour ago" ever matters, that reconstruction
  belongs to whatever persists — Memory, Knowledge, the Human Model —
  never to a second, parallel history kept by Reality Snapshot itself
  (this is ADR-0013's own trade-off, restated here as a hard boundary,
  not a soft preference).
- Raw third-party content beyond what's needed to represent a signal.
  A Connector might have access to an entire email; the Reality
  Snapshot only ever needs what's relevant to the present moment, not
  a mirror of the source system.

---

## 4. What kind of information it can hold

Described here conceptually — no structures, no schemas, no new
fields. Every example below already has a home in the three sections
ADR-0013 already defines; none of them requires the shape to change.

**Calendar** — what's scheduled, happening, or about to happen. Maps
to `signals` (`ExternalSignalSnapshot` already names `calendar` as a
source).

**Approximate location** — where the person roughly is, only ever with
explicit consent. Maps to `signals`, as a future source alongside the
ones already named — not part of this snapshot's shape until a real
engine needs it, per ADR-0013's own "extend when built, not before"
discipline.

**Weather** — environmental context relevant to plans or mood. Maps
to `signals`, same future-extension posture as location.

**Time of day** — not a distinct content type at all: it's already
the anchor of the entire snapshot, expressed once, at the top level,
as `capturedAt`. Nothing else needs to restate it.

**Recent activity** — what the person has been doing. Split across two
sections depending on shape: structurally tracked activity (an active
goal, project, or habit currently in motion) belongs in `life`;
experientially relevant recent activity (something that happened, was
said, or was noticed) belongs in `memory`.

**Devices** — signals originating from a device the person uses (an
activity tracker, a phone's state). Maps to `signals`, as a future
source — conceptually closest to `sensor`, already named.

**Health, with consent** — physical or activity signals from an
authorized source (for example, a fitness Connector). Maps to
`signals`. This is exactly the kind of source ADR-0015's Connector
Architecture already anticipates — a `Connector` producing
`ExternalSignal`s that a Reality Snapshot assembler folds in, with
consent enforced upstream of the snapshot, never inside it.

**Authorized connectors** — not content in themselves, but the
*source* of everything under `signals`. Every signal in a Reality
Snapshot should be traceable to a Connector the person has actually
authorized (ADR-0015) — this document does not change how that
authorization works, only notes that `signals` is only ever as rich
as what's been consented to, and is expected to be empty for most
people for a long time (ADR-0013's own stated expectation).

**Immediate conversational context** — what's happening in the
current exchange. This is the one case worth naming carefully: the
live, in-progress conversation is not yet Memory until it's been
captured. Once captured, whatever is relevant to the present moment
becomes part of `memory`, the same way any other recent memory would.
Reality Snapshot does not hold a special, separate channel for "the
conversation happening right now" — it holds whatever of that
conversation has already become memory, and nothing that hasn't.

---

## 5. Freshness

Not all information in a Reality Snapshot ages the same way, and
treating the whole snapshot as uniformly "current" is a mistake every
consumer needs to actively avoid.

**Immediate horizon (minutes).** A calendar signal saying a meeting is
happening right now is only true for the duration of that meeting.
Device or sensor signals are typically only meaningful at this
horizon too — "active now" information that goes stale almost as soon
as it's read.

**Short horizon (hours).** Today's schedule, today's weather, what
happened earlier today. Still relevant hours later, but with steadily
declining confidence that it still describes "now."

**Medium horizon (days to weeks).** Recently relevant memory context,
the current status of an active goal or habit. Slow enough that being
an hour old doesn't matter; fast enough that being a month old
usually does.

**Long horizon (months to years).** The structural facts in `life` —
that a goal or project exists at all, that a habit is one the person
maintains. These don't need to be re-verified every time; they change
slowly enough that `capturedAt` being a day old barely matters.

The point of naming these horizons is not to propose a mechanism for
tracking them — no expiry field, no TTL, nothing structural. It is to
make explicit that **every consumer of a Reality Snapshot has to
reason about freshness per piece of information, not for the snapshot
as a whole.** A snapshot can be simultaneously "fresh" for its
long-horizon content and "stale" for its immediate-horizon content,
simply because time passed between assembly and use. Treating
`capturedAt` as a single freshness signal for everything inside the
snapshot is the most likely way this concept gets misused.

---

## 6. Construction

Described conceptually — no technical pipeline, no implementation.

```
Connectors
    ↓
Normalization
    ↓
Reality Snapshot
```

**Connectors** (ADR-0015) fetch raw data from external sources the
person has authorized — a calendar API, a fitness Connector, whatever
exists at the time. Each Connector already returns the neutral
`ExternalSignal` shape `core/reality` expects — it does not return raw
provider-specific payloads.

**Normalization** is the anti-corruption step ADR-0013 already
requires, named here explicitly: it is the boundary where real
`core/life` entities and real Memory records get translated into the
neutral vocabulary (`LifeStateItem`, `RealityMemoryItem`) the Reality
Snapshot expects — never the other way around, and never skipped.
`core/reality` itself never performs this translation; it only defines
the shape the translation must produce. This is also where signals
already collected by Connectors get folded in alongside the
translated Life and Memory content.

**Reality Snapshot** is the result — assembled, handed to whichever
engine asked for it, and then gone. Nothing here proposes who performs
Normalization or when it runs. ADR-0013 already names this as
unowned, future orchestration work, and this document does not change
that — it only gives the missing step a name, so that when it is
eventually authorized, there's already shared vocabulary for what it
does.

---

## 7. Relationship to other components

| | Conversation | Memory | Knowledge | Human Model | **Reality Snapshot** |
|---|---|---|---|---|---|
| Answers | What is being said, right now? | What happened? | What does it mean? | Who is this person? | **What is happening with them right now?** |
| Time horizon | This instant, unrecorded | A point in the past, permanent once captured | A derived, evidence-backed claim | Long-term, evolving, path-dependent | An instant, disposable |
| Persisted? | No — becomes Memory or is lost | Yes | Yes | Yes | No — reassembled every time (ADR-0013) |
| Built from | The person, directly | Conversation, journal, documents | Memory, validated | Knowledge, validated + `core/life` facts | `core/life`, Memory, Connectors — all translated, never read directly |

**Conversation** is the most immediate and least durable layer of all
— it isn't even Reality Snapshot's material until Memory has captured
it.

**Memory** is what persists from Conversation and other sources —
permanent evidence, but inert on its own until something interprets
it.

**Knowledge** interprets Memory into validated claims — durable, but
about *what has been true*, not about *what is true this second*.

**Human Model** is the slowest, most durable layer — an evolving
representation built from Knowledge, deliberately resistant to
changing from any single moment.

**Reality Snapshot** is the fastest, least durable layer — assembled
fresh, describing only the present, and gone the instant it's used.

The two extremes — Human Model and Reality Snapshot — are not in
competition, they're complementary by design: knowing that someone
values calm mornings (Human Model) and knowing they have back-to-back
meetings starting in ten minutes (Reality Snapshot) are both necessary
to respond well, and neither substitutes for the other. A system with
only the Human Model would be wise but out of touch with the moment.
A system with only Reality Snapshot would be responsive but have no
memory of who it's responding to.

---

## 8. Prioritization when signals conflict

No rules are specified here — only the considerations a future
resolution mechanism should weigh, conceptually.

**Recency.** Between two signals about the same fact, the one captured
more recently should generally carry more weight — reality changes,
and an older signal is more likely to be describing a moment that has
already passed.

**Directness over inference.** A signal that states a fact directly
(a calendar entry saying a meeting is happening) should generally
outweigh one that implies it indirectly (a general pattern from past
behavior suggesting the person is usually busy at this hour). The
Reality Snapshot's whole purpose is to prefer what's actually true
right now over what's usually true.

**Source reliability.** Not every source is equally trustworthy for
the same kind of fact. A calendar is a reasonable authority on
schedule; an inferred pattern is not, when both are available for the
same question.

**The person's own word.** If something the person just said
contradicts an automated signal, what they said should generally win
— the alternative treats an external system as more authoritative
about someone's life than the person living it, which contradicts the
autonomy principle already established elsewhere in this project's
foundations (`docs/foundations/HUMAN_RELATIONSHIP_MODEL.md`, "lo que
tú quieras hacer").

**A deliberate contrast with the Human Model:** the Human Model
resolves contradictions slowly, on purpose — holding tension open in
`Under Revision` until corroborating evidence justifies a change
(`HUMAN_MODEL_V1.md`, Section 5). Reality Snapshot cannot afford that
patience and doesn't need it: it is disposable by design, so a
provisional, moment-by-moment resolution costs nothing — the next
snapshot will be assembled fresh regardless. Contradictions here
should be resolved quickly and provisionally, never held open the way
Human Model contradictions are.

---

## 9. Architectural Risks

### Stale data

Different sections of the same snapshot age at different rates
(Section 5). The specific risk is a consumer treating the whole
snapshot as uniformly current simply because `capturedAt` is recent —
trusting a two-minute-old calendar signal is reasonable; trusting a
two-minute-old snapshot's `memory` section as if it were freshly
re-evaluated is not, since that content may have been selected based
on relevance criteria that themselves don't refresh every second.
*Mitigation:* consumers reason about freshness per section, never
globally; snapshots are assembled as close to time of use as
practical, never cached across long-running operations (already an
explicit ADR-0013 trade-off).

### Incomplete information

Most people, for a long time, will have authorized few or no
Connectors — `signals` is expected to be empty by default (ADR-0013).
The risk is an engine implicitly treating a sparse snapshot as "little
is happening" rather than "little is known" — those are different
facts, and conflating them produces confident-sounding responses built
on an absence the engine never noticed. *Mitigation:* absence must be
represented as absence, not silently treated as a null result; every
consuming engine has to be built to work reasonably well from `life`
and `memory` alone, since `signals` is a bonus, never a dependency.

### Contradictory signals

Beyond the moment-by-moment resolution in Section 8, a deeper risk is
inconsistency *across* engines — if Knowledge and a future Context
Engine each resolve the same contradiction differently, independently,
LUZ can feel internally inconsistent within a single moment, which is
its own trust failure. *Mitigation, not decided here:* if this proves
to be a real problem, prioritization may need to move into
Normalization itself, resolved once at assembly time rather than
independently by every consumer — flagged as an open question
(Section 10), not resolved.

### Privacy

Reality Snapshot may be the single most privacy-sensitive artifact in
this entire architecture — more so than the Human Model. The Human
Model is synthesized and slow-changing; a Reality Snapshot, when rich
with signals, can represent exactly where someone is and what they're
doing at one specific instant — the sharpest, most immediately
exploitable kind of exposure a system like this can hold. The existing
design already carries a real mitigation for this, worth stating
plainly rather than assumed: **it is never stored** (ADR-0013). There
is no historical location or activity trail sitting in a database
waiting to be breached, because no snapshot outlives its own use. This
document adds no new privacy mechanism — it names why the one already
in ADR-0013 matters more here than anywhere else in the system.

### Excessive dependence on Connectors

If engines start assuming rich signal coverage is the norm, two
things can go wrong: quiet degradation for the majority of people who
haven't authorized many Connectors, and product pressure to
over-request permissions simply to make the model "work better" —
which runs directly against a privacy-by-default posture. *Mitigation:*
`life` and `memory`, which require no external Connector at all, must
remain sufficient on their own for a baseline Reality Snapshot;
`signals` is enrichment, never a requirement.

---

## 10. Open questions

Recorded deliberately, not resolved:

1. **Who or what performs Normalization**, and when — still unowned,
   per ADR-0013, unchanged by this document.
2. **Assembly frequency.** Fresh on every request, or cached for some
   short window? A latency/cost trade-off against freshness
   (Section 5) not decided here.
3. **Where does contradiction-resolution (Section 8) actually live** —
   inside Normalization, once, or independently inside each consuming
   engine? Named as a risk (Section 9), not resolved.
4. **How much signal coverage is actually needed before Reality
   Snapshot adds real value beyond `life` and `memory` alone?** Is one
   authorized Connector enough, or does the value only appear once
   several are active? Worth measuring during beta, not assumed.
5. **Should freshness ever be surfaced to the person** — LUZ saying
   "as of a few minutes ago..." — for transparency, or should it stay
   entirely internal to how engines reason? Not decided here.

---

## 11. What this document does not do

- It does not modify ADR-0013, `core/reality`, `core/connectors`, or
  any other frozen contract — the shape of `RealitySnapshot` is
  unchanged.
- It does not authorize implementing an assembler, a Normalization
  step, or any Connector.
- It does not resolve prioritization, freshness tracking, or
  contradiction-handling into rules — all three remain conceptual,
  pending real implementation experience.
- It does not invent new top-level sections for `RealitySnapshot` —
  every example in Section 4 maps onto `life`, `memory`, or `signals`
  as already defined.
