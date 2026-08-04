# Product Experience Standard — Personalization Depth & Perceived Care

**Status:** Adopted standard — informs product and UX decisions on an ongoing basis.\
**Origin:** Generalized from an in-depth review of one real user's product experience. Individual specifics have been removed or replaced with generic examples; only the reusable patterns, principles, and verified findings remain.\
**Companion to:** `docs/product/UX_ARCHITECTURE_REFINEMENT_V1.md` — that document is the hierarchy/architecture layer. This one is the felt-experience layer only: not what to build, what it should feel like.\
**Scope:** Feelings, not features. No engines, no schemas, no implementation plan.

**Editorial principle:** any user quote or specific used to illustrate a pattern in this document must be genericized before being written down. This document exists to describe how LUZ should feel to use, not to document who any particular user is. Verified findings are kept; anything that could identify a specific person is not — regardless of how illustrative it would be.

---

## The standard, up front

A user who voluntarily writes a comprehensive, structured, vulnerable profile of their own life — unprompted — is showing strong intent, not testing the product. That behavior deserves to be met with equally serious reflection back.

The risk in that moment isn't a single bad conversation. It's a user who keeps giving more of themselves than the product gives back, notices the gap every time, and quietly disengages. That's a slower, harder failure to see coming than a crash or a bug — and it's the failure mode `PRESENCE_PRINCIPLES.md` Principle 8 warns about in reverse: trust compounds through many ordinary honest moments, and it erodes the same way, one unreflected disclosure at a time.

When a user's own intuitive explanation for a product problem independently matches the engineering team's own root-cause finding, that is a strong trust signal worth surfacing directly to them — not a coincidence to bury in an internal doc.

---

## The evaluation rubric

The following questions form a reusable rubric for evaluating whether LUZ's felt experience matches its stated intelligence and care. Re-apply them whenever a real, in-depth user review is available.

### Does LUZ truly know me?

A thorough user profile commonly spans classification across areas such as: personal life, personal development, work, relationships, family, finances, hobbies, self-perception, and health.

The honest test: if a user asks "what do you actually know about me?" — what comes back? Often, a thin or generic answer, regardless of which life area is asked about — not because the information wasn't given, but because low-sensitivity, high-signal detail (occupation, hobbies, daily routine, stated preferences) frequently sits captured and unused. Several categories can be covered in immediately usable detail without any of it reaching the surface.

Knowing something about a user and being *able to show* the user that it's known are two different capabilities. The gap between them is usually the whole finding.

### Does she remember what matters?

A common first-order trust failure: a user explicitly asks LUZ to record something — by name, in an explicit category (for example, logging a specific accomplishment as an achievement) — and later, asking about that same category, finds it missing. This is not a UX nitpick; it's the product failing at the one thing it promised.

A related, wider version of the same complaint: reflection surfaces (identity/memory views) plateau at a couple of thin summaries no matter how much a user adds. When a user names the likely cause themselves and it matches a known root cause, the distinction to hold onto is: what matters *is* being captured. What isn't happening yet is it coming back to the user. That's the difference between "broken" and "listening but not yet speaking up" — and only one of those is true.

### Does she prioritize correctly?

Worth checking whenever user feedback and an independent structural audit converge, within the same review cycle, on the same finding — for example, that a primary "at a glance" view surfaces too much at once, with no clear hierarchy of what matters right now. Two independent methods landing on the same problem within hours of each other is about as confirmed as a product finding gets, and should be treated as resolved, not still debated.

### Does she feel alive?

Users often describe wanting, in their own words, something like: a companion, constructive honesty, a friendly reminder, a non-judgmental accompanying presence. That maps closely onto product principles already articulated elsewhere (`PRESENCE_PRINCIPLES.md`) — the gap is usually delivery, not definition.

Check specifically whether the place that matters most for "does this feel alive" — the live conversation itself, not a summary screen — is where presence is rendered smallest. A component sized up elsewhere specifically to increase felt presence, but left at its smallest setting in the one place presence is most load-bearing, is a real inconsistency worth fixing on its own precedent.

### Does she surprise me?

A common "surprise" request pattern: a user wants a repeatedly stated preference (for example, wanting to start the day a certain way) proactively remembered and acted on — not something they have to ask for twice. The fact that a person has to specify the kind of thoughtfulness they want is itself diagnostic: a product that felt ahead of the user would have tried it before being asked.

Low-effort, high-warmth "surprise" opportunities often sit directly in what a user has already freely and happily shared — a recurring personal date, a small stated preference — costing nothing to notice and everything to ignore. This is the kind of moment `PRESENCE_PRINCIPLES.md` Principle 7 describes when it says evolution should feel recognized, not performed.

### Does she reduce cognitive load or add more?

Explicit feedback of the form "treat every experience like a mobile app: simple visualizations, minimal taps" is a direct verdict against dense, multi-section screens. When a screen is independently identified as one of the densest in the product before any user weighs in, and a user's own feedback lands on the same screen unprompted, that's a request for less to look at, not more to build.

---

## Common frustration patterns

Stated plainly and unfiltered, frustration tends to cluster around: a primary view that reads as a jumble of information; reflection surfaces that feel plateaued despite continued input; a sense that recency isn't being respected; and a live conversation whose presence cues (avatar, visual warmth) feel too small for something meant to feel like a relationship. None of this tends to be subtle or in dispute once observed directly — treat it as a direct list, not a set of hypotheses.

## What tends to create delight

- A primary view that's actually readable in the time a user expects — seconds, not a scroll.
- Small proactive gestures that match a stated preference, delivered without being asked a second time.
- Presence cues (an avatar, for example) that read as present, not decorative — consistent across every surface, not just some.
- Reflection surfaces that visibly reward newly shared depth — categories that were empty, populated because the user took the time.
- A quiet, accurate nod to something real and good a user already shared. Noticing costs nothing and says "I was listening" louder than almost anything else on this list.

## What tends to feel robotic

Whatever LUZ says the next time a user opens the app, if it doesn't reference anything from real effort the user just put in. The moment right after a user does something vulnerable is the single worst possible moment for a generic response — worse than any other moment, because the user can feel exactly how much they gave and exactly how little was reflected back.

Structurally, the same risk lives in plain, visually flat responses, and in copy that repeats itself across return visits: any moment that reads as templated is a moment that reads as software, not presence.

## What's already working — and shouldn't be reinvented

Worth stating clearly, because honesty should cut both ways: turning a real relationship metric into a real sentence instead of a raw stat is a genuinely good, already-shipped instinct. A typing indicator that reads as a pause before speaking, not a loading state, is a small detail executed with real care. A welcome message that's never a menu of capabilities is exactly the kind of restraint that makes something feel like a presence instead of a tool. None of this needs to be reinvented. It needs company.

## Where trust is typically lost

The clearest version: a user asks, by name, for something to be remembered — and finds out, in effect, that it wasn't. That's not a UX nitpick; it's the sound of a product failing at the one thing it promised. Every unreflected disclosure between then and any critical milestone is a smaller version of the same moment, and none of them need to be dramatic to add up — trust compounds from ordinary moments, and it erodes the same way.

---

## Pattern verification — user-reported issues vs. code reality

A real review is only as useful as its follow-through. Whenever a user-reported pattern is checked directly against the code, record the verdict here rather than assuming either the user or the code is right by default.

| Reported pattern | Verdict | Why |
|---|---|---|
| A primary "at a glance" view should be scannable in seconds, not an unstructured list | Confirmed, independently, twice | Matched an independent structural audit's own finding exactly — user intuition and a line-by-line read of the code agreed. Highest-confidence, highest-priority pattern of this kind. |
| Reflection surfaces (identity/memory views) plateau at a couple of thin summaries regardless of input | Real, and the likely cause was self-diagnosed correctly by the user | The user's own guess at the cause matched the engineering team's independent root-cause finding from days before. Not something a documentation fix resolves by itself — flagged, not re-solved here. |
| A list's chronological order feels backwards | Did not match a direct read of the code — worth a live check, not a blind fix | The relevant sort logic, checked in two independent places, already sorted newest-first. Something real was being experienced; it deserved a side-by-side look at the actual account before any change, rather than a reflexive flip that could break what was already correct for everyone else. |
| A key presence surface (an avatar, for example) reads as too small | Confirmed, same fix already had a precedent | Found at the smallest size the component supported, in the exact place presence matters most; an equivalent component elsewhere had already been sized up once for the identical reason. |
| Request for a new proactive capability (real external content delivered unprompted, for example) | Real and wanted, but a new capability, not a tweak | Requires reaching outside the system to a live external source — a different class of work than resizing or trimming existing UI. Worth naming honestly as such, not treated as the same size of ask as the rest. |
| Preference for a mobile-first, low-tap experience throughout | Confirmed | Matched an independent mobile-density finding across the densest screens audited. |

---

## Would a user in this position keep coming back?

In the near term: probably, on goodwill alone — a user who has already shown willingness to invest in a one-sided relationship tends to keep doing so for a while. That goodwill is not unlimited, and failures of the kind described above tend not to be ambiguous once observed directly. Each one is a moment where a user gave something real and got something generic back.

None of this requires a new kind of intelligence. It requires the intelligence that's already there — a stated goal, a self-logged achievement, a freely shared personal date, a stated preference for how the experience should feel — to actually reach the screen in front of the user. That is the whole distance between a product that merely stores what it's told and one where a user opens it and feels like someone was listening.
