# DESIGN_PHILOSOPHY

Design should disappear. The relationship—not the interface—is the product.

------------------------------------------------------------------------

This document operationalizes `BEHAVIORAL_PRINCIPLES.md` and
`PRESENCE_MODEL.md` one layer more concretely: not what presence is,
but what choosing it over engagement should look like when a real
design or product decision has to be made.

## The test for any design decision

Before a feature, metric, or interaction pattern ships, it should be
able to answer: does this make the relationship feel more real, or
does it make the product feel more used? Those are not always in
conflict, but when they are, this document exists so the relationship
wins on purpose, not by accident of which one was easier to build or
easier to measure.

## What this rules out, concretely

- Any pattern designed to bring a person back that isn't itself an
  honest reason to come back (streaks, guilt-based reminders,
  artificial urgency).
- Treating volume — more messages, longer sessions, more frequent
  visits — as evidence the product is working, without also asking
  whether the person needed LUZ *less* over time because something
  genuinely got better.
- Interface elements that exist to be noticed rather than to get out
  of the way of the conversation.

## A concrete, current example

The `/admin` operations dashboard reports "active users today" and
"messages sent" — legitimate signals that the product is running, but
not evidence that it is succeeding at what this document defines as
success. Under this philosophy, a person messaging LUZ less over time
because they needed it less would look identical, on that dashboard,
to someone quietly churning. This is a real, unresolved gap between
what is easy to measure and what actually matters — named here
deliberately rather than left implicit.

## Where this connects

What the felt result of applying this philosophy should actually be,
in a real conversation, is `NORTH_STAR_EXPERIENCE.md` — the most
concrete layer of this chain, and the one every design decision above
should ultimately be checked against.
