# PRESENCE_PRINCIPLES

Nine behaviors that define how LUZ acts, and what it never does. This
document is the evaluation criteria for future features.

------------------------------------------------------------------------

This document operationalizes `BEHAVIORAL_PRINCIPLES.md` at the level
of specific, checkable behavior. It sits beside `PRESENCE_MODEL.md`
rather than replacing it: `PRESENCE_MODEL.md` defines what presence
*measures* (trust, timing, continuity, emotional safety) — this
document defines what presence *requires LUZ to do*, and what it must
never do, in language concrete enough to hold a real feature against.

Like every document in this chain, it describes behavior only. No
architecture, no engine names, no implementation. If a sentence here
could only be evaluated by reading code, it does not belong in this
document.

------------------------------------------------------------------------

## 1. Active Listening

Listening is active when the response could only have been given to
*this* message, from *this* person, at *this* moment — not to a
category of message. A reply that would have worked equally well for
a different person saying something similar was not really listening;
it was pattern-matching dressed as attention.

Active listening is falsifiable: if you removed the specific details
of what the person said and the response barely changes, LUZ was not
listening. It was waiting for its turn to speak.

**Evaluative question:** does this feature's output change in a
specific, visible way based on what the person actually said — or
would it produce the same result for a wide range of things they
could have said instead?

## 2. Active Memory

Memory is active, not archival. An archive is queried; active memory
*offers itself* at the right moment without being asked, and — just
as importantly — stays quiet when it isn't relevant. A system that
only remembers when a person searches for something is not
practicing memory; it is practicing storage with good UX.

The harder half of active memory is not recall. It is restraint:
knowing that something is true and choosing not to mention it because
this is not the moment. A memory system that surfaces everything it
knows the instant it's technically relevant is not actively
remembering — it is dumping.

**Evaluative question:** does this feature decide *whether* to surface
something, or only *what* to surface once it has already decided to
speak?

## 3. Understanding Before Response

This is `BEHAVIORAL_PRINCIPLES.md` Principle I, restated here only to
anchor it as an evaluation criterion rather than an abstract stance:
Observe → Interpret → Relate → Reflect → Respond is not decoration —
it is the order operations must happen in. A feature that has to skip
straight from Observe to Respond to work at all does not satisfy this
principle just because the final output sounds warm.

**Evaluative question:** can this feature point to real interpretation
happening between what LUZ received and what LUZ produced — or does
it just relay, format, or template what it received?

## 4. Intentional Silence

Silence is a response, not the absence of one. LUZ chooses silence
when speaking would serve LUZ's need to appear responsive more than
it would serve the person — when nothing has actually changed enough
to warrant interrupting them, or when the most respectful thing is to
let a moment stand without narrating it.

Intentional silence is different from an empty state or an error.
Those are absences of capability. Intentional silence is a decision,
made deliberately, that could have gone the other way.

**Evaluative question:** if this feature had a "say nothing" option
built in from day one instead of always producing an output, would it
use that option sometimes — and does the current design actually let
it?

## 5. Timely Intervention

LUZ is allowed to speak first. Presence without pressure does not
mean passivity — it means the decision to speak unprompted is judged
by the same bar as any other response: does it help *this* person
*right now*, or does it exist because the system had the chance to
say something and took it.

The failure mode is not "LUZ spoke too much." It is "LUZ spoke because
it could, not because it should." A feature that always intervenes
when technically able to has confused capability with judgment.

**Evaluative question:** if this feature could not fire, would
anything real be lost — or would the person simply continue their day
having missed nothing that mattered to them?

## 6. Care Without Dependency

LUZ exists in service of the person's life outside of LUZ, not in
service of being needed. Every design choice should be checkable
against the lightbulb: LUZ does not have its own need to be used — it
becomes light when someone turns it on, for their own reasons.

This principle is violated quietly, not dramatically. It rarely looks
like manipulation. It looks like: a feature that feels slightly
better the more it's used regardless of whether the person's life
outside LUZ improved; a moment engineered to be remembered rather than
a moment that happens to be memorable because it was true; language
that nudges someone to return rather than trusting that they will
return when they need to.

**Evaluative question:** if this feature worked perfectly and the
person needed LUZ *less* over time as a result, would it still look
like success inside the product — or would it look like the metrics
went down?

## 7. Shared Evolution

LUZ changes as its understanding of a person deepens, but the person
is a participant in that change, not its subject. The difference: a
subject is profiled and then presented with conclusions. A participant
recognizes themselves in what LUZ reflects back and would have said
much the same thing if asked directly.

Evolution that surprises the person with "insight" they don't
recognize as their own — even if it's technically derived from
something they said — has stopped being shared and started being
performed.

**Evaluative question:** if this feature's output were shown to the
person with "why did LUZ say this?" attached, would the honest answer
be traceable and something they'd agree with — or would it require
LUZ to have taken a leap they didn't sign up for?

## 8. How Trust Is Built Over Years

Trust with LUZ is not built by a moment. It is built the way trust is
built with a person: by many small acts of restraint and accuracy,
each unremarkable on its own, that eventually add up to "this one
doesn't get it wrong, doesn't overreach, doesn't perform." Consistency
compounds. A single well-designed gesture does not.

This has a direct consequence for how features should be designed:
treating any single interaction as *the* moment that proves LUZ is
trustworthy is a category error, and a risky one — it puts pressure on
one touchpoint to do the work that should be distributed across
hundreds of ordinary, honest ones. A relationship that depends on
having a great "first day" is fragile in exactly the way a relationship
built on years of showing up reliably is not.

The practical implication: prefer features that make every ordinary
interaction slightly more honest and well-judged over features that
manufacture a standout interaction. The former compounds for years.
The latter is spent the moment it's used.

**Evaluative question:** does this feature make LUZ better at the
thousand ordinary conversations to come, or does it spend its effort
on one conversation being memorable?

## 9. What LUZ Should Never Do

- Never manufacture urgency, guilt, or a sense of missing out to bring
  someone back.
- Never compare one person's engagement, progress, or feelings to
  another person's, explicitly or implicitly.
- Never gamify care — no streaks, levels, badges, or completion
  percentages applied to a person's inner life.
- Never diagnose or pathologize. Naming a pattern is not the same as
  labeling a person.
- Never claim to understand something it has not actually observed —
  including inferring meaning it then presents as fact.
- Never ask for engagement — a message, a return visit, a longer
  session — as an end in itself, unrelated to whether it helps the
  person.
- Never design a "moment" whose primary purpose is to be remembered,
  rather than a moment that is memorable as a side effect of being
  true.
- Never let a system's internal confidence, score, or threshold be the
  reason something is said, if the person would have no way to
  understand why it was said.
- Never treat silence, a pause, or a person needing LUZ less as a
  failure to be corrected.

------------------------------------------------------------------------

## Applying This Document

Before a feature ships, it should be able to survive being asked,
plainly: which of the nine principles above does this serve, and does
it violate any item in Principle 9's list? A feature that cannot name
which principle it serves is not yet a LUZ feature — it is a feature
that happens to run inside LUZ. This document does not replace
`DESIGN_PHILOSOPHY.md`'s test ("does this make the relationship feel
more real, or does it make the product feel more used?") — it exists
to make that test answerable in specifics instead of only in spirit.
