# ADR-0021 Curiosity Engine Authorization

Status: Accepted\
Date: July 2026\
Owner: Founder

## Context

`core/curiosity-engine` was created in commit `c8abdb4` (2026-07-27,
~12 hours after ADR-0018 froze the engine architecture the same day).
The commit message correctly invoked the required authorization —
*"Prioridad #4, con autorización explícita del Founder para crear un
core/*-engine nuevo (ADR-0018 exige luz verde, no silencio, para esto
específicamente)"* — but that authorization was never captured
anywhere ADR-0018 itself designates: *"Amend this ADR explicitly
before starting a new `core/*-engine` module; do not treat silence as
authorization."* A commit message is not an amendment. A full-project
audit (this session, 2026-07-30) flagged the missing written record as
the one unambiguous governance gap it found — not a judgment on
whether the engine should exist, only that the paper trail ADR-0018
requires was never written.

The Founder's reasoning, given directly in the session that raised
this gap: Curiosity Engine exists because LUZ should have genuine
curiosity in how it develops and interacts with a person — it should
ask itself *"how can I learn from this, what is important here"* — as
its own independent motor, not a mode of Knowledge Engine or folded
into it. It relates to Knowledge Engine as a peer, the same way
Belief, Concept Graph, Contradiction, and Predictive already do.

What was actually built, for the record this ADR exists to create:
`CuriosityQuestion`, persisted (`curiosity_questions`, migration
`0015`), at most one `pending` question per `LifeGraph` at a time — a
genuine curiosity, deliberately never a backlog.
`AICuriosityQuestionGenerationStrategy` (the module's only AI call)
anchors each question to what LUZ already knows about the person in
other areas, never a generic prompt. `resolveStaleCuriosityQuestions`
decides, from real coverage evidence, whether the gap the question
targeted has since resolved or another area is now more urgent — never
assuming a question was asked just because it was generated. Wired
into the real pipeline: `enrich-knowledge-graph.ts` runs resolution and
generation in the same cron pass as Belief/Concept/Contradiction/
Predictive; `RealitySnapshot` gains `curiosity.pendingQuestion`
(same minimal-projection, anti-corruption pattern as `reasoning`);
`CuriosityStrategyRule` uses the real question when one exists and
degrades to its prior in-the-moment behavior when the cron hasn't
generated one yet for that `LifeGraph`. Verified against a real
Postgres instance and a real OpenAI call before this session; one real
bug found and fixed during that verification (`structured output`
truncating a question mid-sentence at the schema's `max(200)` — raised
to `280` as a safety net, brevity moved to the prompt itself, and any
response landing exactly on the cap is now discarded as a truncation
signal, not trusted as complete).

## Decision

This ADR is the amendment ADR-0018 required, written after the fact.
It does not modify ADR-0018's text — ADR-0018 stays exactly as
written, including its freeze on any *future* new engine. This ADR
only records, in the place the project's own process says it belongs,
that `core/curiosity-engine` is authorized as an eighth canonical
engine alongside the seven ADR-0018 named (Context, Conversation
Strategy, Reasoning, Presence, Voice, Memory, Knowledge).

Curiosity Engine's boundary, confirmed: an independent domain contract
(its own entity, repository, generation strategy — the same shape as
Belief/Concept Graph/Contradiction/Predictive), never subordinate to
Knowledge Engine. It relates to Knowledge Engine the way every other
engine in that cron pass does — feeding and being fed by the same
pipeline stage — not by being owned or absorbed by it.

This authorization is scoped to exactly this one already-built module.
It does not relax ADR-0018 for anything else: any future new engine
still needs its own explicit amendment — this ADR or a new one — before
implementation starts, not after.

## Consequences

### Positive

- Closes the one unambiguous governance finding from this session's
  audit — the module's authorization now lives where ADR-0018 itself
  says it must, not only in a commit message.
- Makes explicit, for future engineering decisions, that Curiosity is
  intentionally independent from Knowledge Engine — not an oversight,
  not a future merge candidate.
- No code changes accompany this ADR. `core/curiosity-engine` has run
  in production, verified, since 2026-07-27 — this record catches the
  documentation up to a decision that was already made and already
  shipped.

### Trade-offs

- Written retroactively, days after the module shipped. The ADR
  sequencing ADR-0018 asked for (amend, then build) was not followed
  in the moment — documented here as fact, not defended as the right
  order to repeat.
- Ratifying this one exception is not a precedent that silence plus a
  commit message is sufficient going forward. The next new-engine
  proposal still needs a written amendment before code, exactly as
  ADR-0018 already states.

### Future

Any further `core/*-engine` proposal amends ADR-0018 (or adds its own
ADR, following this record's pattern) before implementation begins —
this ADR is the exception being formally closed, not a relaxation of
the rule for what comes next.

## Related

- ADR-0018 Architecture V1 Frozen — the freeze this ADR authorizes one
  retroactive exception to, without modifying its text.
- ADR-0020 Fast User Understanding — cites `CuriosityStrategyRule`/
  `generateCuriosityQuestion` as pre-existing infrastructure; same
  session's precedent for "extension of an existing engine, not a new
  one" reasoning, useful contrast against this ADR's actual "yes, this
  one is a new engine, and here is its authorization."
- `core/curiosity-engine/` (entities, repositories, generation
  strategy, services), `core/db/migrations/0015_*.sql`.
- Commit `c8abdb4` (original creation, 2026-07-27).
