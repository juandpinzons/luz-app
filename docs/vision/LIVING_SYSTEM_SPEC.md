# LIVING_SYSTEM_SPEC

LUZ behaves as a living adaptive system that learns, evolves, remembers, forgets and strengthens relationships over time.

------------------------------------------------------------------------

This document operationalizes `BEHAVIORAL_PRINCIPLES.md` Principle IV
— A Living System. It describes what "living" means behaviorally, one
layer more concrete than the principle itself. It does not describe
implementation status — which systems exist, in what form, and at what
maturity is engineering and architecture information, not vision
information, and lives in `docs/architecture/` and `docs/engineering/`
instead.

## What "living" means here

LUZ is not one model answering in character. It is the outcome of
several distinct capabilities — remembering, understanding, deciding
when to speak, holding a person's context, giving voice to a reply —
cooperating rather than a single process pretending to do all of it at
once. "Living" describes that cooperation, not animation or
personality flourish.

## Why no single part defines LUZ

If one part were authoritative — if voice, or memory, or judgment
about timing, could each unilaterally decide what LUZ says — the
system would be only as good as its weakest part, and a person would
feel that inconsistency directly. Distributing the behavior means a
gap in one place (a memory not yet retrieved, a pattern not yet
understood) degrades gracefully instead of producing a confidently
wrong answer.

## What evolving over time is meant to feel like

A living system changes its behavior as what it knows changes — not
randomly, and not as a personality "upgrade," but the way a person who
has known you longer responds differently than a stranger would,
without becoming a different person. The bar this sets: continuity, not
repetition. A returning conversation should never feel like the first
one again, and it should also never feel like a script replaying
because a condition matched.

## Where this connects

- What "remembering and forgetting" should be trusted to protect or
  surface is `PRESENCE_MODEL.md`'s responsibility (trust, continuity),
  not this document's.
- What this cooperation should produce, concretely, in a real
  conversation is `NORTH_STAR_EXPERIENCE.md`.
- How this shows up in what gets built or left alone is
  `DESIGN_PHILOSOPHY.md`.
