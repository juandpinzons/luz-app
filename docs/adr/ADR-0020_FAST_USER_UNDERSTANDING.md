# ADR-0020 Fast User Understanding

Status: Accepted\
Date: July 2026\
Owner: Founder

## Context

The Founder asked for a "Fast User Understanding" capability: reduce
the time LUZ needs to build a useful, actionable profile of a new
person, without a traditional onboarding form, staying aligned with
"Presencia, sin presión." The request specified, in detail, exactly
the properties a hypothesis-tracking system should have — incremental
construction, per-message confidence updates (never binary), automatic
correction as new evidence appears, full explainability back to source
memories — and asked for an audit before any code, explicitly
requiring reuse over duplication.

**The audit's central finding**: the vast majority of what was
requested already exists, in production, verified across the prior
three sessions of this same engagement. `Belief` (`core/belief-engine`)
already is a confidence-scored, evidence-linked, evolving hypothesis
(`confidence: Confidence`, `firstObservedAt`, `lastReinforcedAt`,
`BeliefEvidence`→`memoryId`, `BeliefHistoryEntry` append-only).
`consolidateBeliefFromInsight`/`decayStaleBeliefs` already implement
reinforcement and decay, never binary. `CuriosityStrategyRule`/
`generateCuriosityQuestion` already implement progressive, non-
interrogating discovery. `DeterministicImportanceScoringStrategy`
already implements "not all signals are worth the same." `PersonIdentityModel`
(`build-identity-model.ts`) already is the living, never-persisted-
separately profile. None of this needed to be built again.

**Four genuine gaps survived the audit** (see the full write-up given
to the Founder in-conversation, not duplicated here): (A) no modeling
of *how* a person prefers to be talked to — `core/persona` is LUZ's
own identity, never the user's communication preference; (B) no
explicit "time to understanding" metric; (C) no new-user prioritization
in the Knowledge Worker's job queue; (D) no organic-confirmation
behavior for a hypothesis that is *forming* but not yet solid enough
for `ReflectStrategyRule` (confidence ≥ 55).

The Founder chose to build (A) and (D) — the two gaps that change
LUZ's actual behavior — and explicitly deferred (B) and (C), the two
purely technical, no-product-judgment gaps.

## Decision

**No new `core/*-engine` module.** ADR-0018 (Architecture V1 Frozen)
remains untouched — both gaps are extensions of `core/belief-engine`,
`core/voice-engine`, and `core/conversation-strategy-engine`, the same
category of change ADR-0018 explicitly does not gate ("ordinary
engineering inside the six existing engines... is NOT gated by this").

**Gap A — communication-style beliefs, reaching Voice.** `Belief`
gains a `category: "life_domain" | "communication_style"` field
(migration `0016_kind_blue_marvel.sql`, one additive column, default
`'life_domain'` — every existing row is correctly reclassified with
zero manual migration work, since every belief created before this ADR
genuinely was about a life domain). `BeliefConsolidationStrategy`
(the AI layer — the only place that already reads both the Insight and
its full evidence text) decides `category` at proposal time, the same
way it already decides `domain`; `AIBeliefConsolidationStrategy`'s
prompt was extended, not replaced, to also recognize when evidence is
about *how to talk to this person* rather than *what area of their
life this is*. `findMatchingBelief` (the fuzzy-match dedup gate) now
requires `category` to match exactly, never falling back to the loose
"`domain === undefined` matches anything" rule that already existed for
`domain` — without this, a communication-style belief could have
silently fused with an unrelated life-domain belief that also lacked a
domain, purely by coincidental text overlap. This was caught and fixed
during implementation, not assumed safe.

`RealitySnapshot` gains `communicationStyle` (mirrors the existing
minimal-projection pattern used for `curiosity`/`contradictions`),
populated in `assembleRealitySnapshot` by filtering the *already-
fetched* `beliefs` array (zero new database query) for
`category === "communication_style"`, capped at 2. `VoiceEngine.speak()`
gains an additive, optional second parameter
(`communicationStyle?: CommunicationPreferenceSnapshot`) — every
existing caller (`speak(stance)`, no second argument) is byte-for-byte
unaffected, same additive discipline ADR-0016/0017 established for
`AIProvider`. `VoiceSignature` gains `userPreferenceNotes: string[]` —
the actual belief statements, passed through verbatim, never
mechanically reinterpreted into a structural register/warmth change
(deliberately: guessing that the word "corto" in a free-text belief
should shrink `maxLines` would be exactly the kind of fragile
heuristic this codebase avoids elsewhere). `render-context.ts` renders
these as an additional guidance block under Voice, same pattern as
every other AI-authored text this system already hands to the model
as natural language instead of mechanically parsing.

**Gap D — `ConfirmStrategyRule`, no new tracking infrastructure.**
`RealitySnapshot` gains `growingBeliefs` (same minimal-projection
pattern, capped at 1 — confirming more than one hypothesis per turn
would read as an interrogation), populated from the same already-
fetched `beliefs` array, filtered to confidence 30–54 (below 30 is
single-mention noise not worth surfacing even to confirm; at 55 and
above `ReflectStrategyRule` already shares it as settled understanding).
`ConversationStrategyType` gains `"confirm"`; `ConfirmStrategyRule`
(priority 42, between `CelebrateStrategyRule` at 45 and
`CuriosityStrategyRule` at 40) phrases the objective as an organic
confirmation, not an assertion, matching the Founder's own example
verbatim in its `primaryObjective` text. **Critically, no new belief-
reinforcement or confirmation-tracking mechanism was built**: whatever
the person says in reply becomes a new memory through the existing
pipeline exactly like any other message, and if it corroborates or
contradicts the same statement, `consolidateBeliefFromInsight`'s
existing `titlesLikelyMatch` dedup already reinforces or the
contradiction pipeline already flags it — the confirmation loop closes
itself through machinery that already existed, with zero new
persistence.

## Consequences

### Positive

- Two real product capabilities shipped without adding a seventh
  `core/*-engine` — ADR-0018's boundary held under direct pressure
  from a request that, read literally, sounded like it wanted a new
  engine.
- `VoiceEngine`'s signature extension is provably non-breaking: the
  existing test suite and the one real caller (`build-context.ts`)
  both needed exactly one line changed each, confirmed by a clean
  `tsc --noEmit` across the whole repository after the change, not
  file-by-file inspection alone.
- The cross-category dedup bug in `findMatchingBelief` was found and
  fixed *during* implementation, before it ever reached production —
  the same "write the real test, find the real bug" pattern that
  caught the `detectDomainCoMovement` over-counting bug earlier this
  session.

### Trade-offs

- `userPreferenceNotes` passes AI-authored free text straight into the
  prompt without validation beyond what `AIBeliefConsolidationStrategy`
  already enforces (length cap, confidence threshold). If the AI ever
  proposes a communication-style statement that reads as an instruction
  rather than an observation, nothing here catches that — same trust
  boundary this codebase already extends to `ReflectStrategyRule`'s
  reasoning-conclusion text.
- `ConfirmStrategyRule`'s priority (42) and the growing-belief band
  (30–54) are both first-iteration numbers, not measured — same
  category of "correct today, revisable tomorrow" the codebase already
  names explicitly for `VALIDATION_CONFIDENCE_THRESHOLD` and similar
  constants.
- Gaps B (time-to-understanding metric) and C (new-user queue
  priority) remain open, by the Founder's own explicit choice, not an
  oversight.

### Future

Gaps B and C are the natural next increment if the Founder wants them
— both purely technical, no product judgment required, already
scoped in the audit. Revisit `ConfirmStrategyRule`'s priority and the
growing-belief confidence band once there's real usage data on how
often it fires and whether people find the confirmations natural
(same category of revisit ADR-0019 already named for the AI Router).

## Related

- ADR-0018 Architecture V1 Frozen (this ADR's core claim: extending
  six existing engines, never adding a seventh)
- ADR-0016 AIProvider Structured Output / ADR-0017 AIProvider Streaming
  (the additive-extension discipline this ADR follows for
  `VoiceEngine.speak()`)
- `core/belief-engine/entities/belief.ts`,
  `core/belief-engine/services/consolidate-belief-from-insight.ts`,
  `core/voice-engine`, `core/conversation-strategy-engine/rules/confirm-strategy-rule.ts`,
  `core/reality/communication-preference-snapshot.ts`,
  `core/reality/growing-belief-snapshot.ts`,
  `core/db/migrations/0016_kind_blue_marvel.sql`
