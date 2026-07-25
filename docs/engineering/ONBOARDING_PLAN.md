# Onboarding Plan

Status: Proposed\
Owner: Founder\
Last verified: 2026-07-24

Scope first — same discipline as `SMOKE_TEST_PLAN.md` and
`OBSERVABILITY_PLAN.md`. The difference here: onboarding is the first
impression. A smoke test failure means a bug; an onboarding failure
means someone never comes back, and no amount of downstream
architecture fixes that.

Everything below is checked against the real, current code — not a
generic onboarding template. Several concrete risks turned up just
from reading the actual funnel, before talking to a single person.

## What "successful onboarding" means

A new person, unassisted, in one sitting:

1. Creates an account (Google OAuth — the only path today).
2. Understands what LUZ is within about a minute, without being told.
3. Sends a first message.
4. Gets a reply that feels like it was worth sending the message.
5. Comes back the next day knowing where to pick up.

This matches the Founder's own Alpha success criterion from the
2026-07-17 ALPHA MODE pivot (unassisted signup → Dashboard → chat →
feels remembered → feels different from a generic chatbot) — this plan
operationalizes that into something checkable, not a new definition.

## The real funnel (verified against code, 2026-07-24)

```
Landing (/)
  ↓ "Comenzar" / "Abrir LUZ"
Login (/login, Google OAuth only)
  ↓
First real screen  ←── branch point, see finding #1
  ↓
Empty state
  ↓
First message
  ↓
First response
  ↓
Return next day
```

**Finding #1 — the funnel branches, and the two docs in this repo
disagree with the code.** `components/Hero.tsx` and `components/CTA.tsx`
both point their primary CTA straight at `/chat`
(`href="/chat"`) — not `/dashboard`. But `app/dashboard/page.tsx` and
`app/login/page.tsx` both carry comments asserting "`/dashboard` es la
puerta de entrada post-login." Both can't be the primary path. In
practice: a brand-new user clicking the landing page's CTA lands on
`/chat`, not the Dashboard/Morning Brief — they never see `lifeLine`
or `continuityLine` (`build-morning-brief.ts`) unless they separately
navigate to Dashboard via the nav bar (`components/app-shell.tsx`,
present on every authenticated page). **This is a decision to make,
not a bug to silently fix** — see "Decisiones abiertas."

**Finding #2 — `/chat`'s empty state doesn't say what LUZ is.**
`app/chat/page.tsx` shows "¿Cómo te sientes hoy?" / "Estoy aquí para
escucharte." for zero messages — warm, on-brand, but assumes the
person already knows LUZ is for reflection/journaling (that
explanation lives only in `components/Features.tsx`, on the landing
page). Anyone who skips the landing page's scroll — which Finding #1
makes likely, since the primary CTA is right at the top — never sees
it. There is also no example of what to type first; the input is
blank with no suggested prompts.

**Finding #3 — one landing page button does nothing.** `components/Hero.tsx`'s
"Conocer más" button has no `href` and no `onClick` — a dead control on
the very first screen. Small, but it's the second thing on the page a
new visitor can click.

**Finding #4 — the Dashboard's empty state is graceful but thin.**
For a first-time user (verified via `build-morning-brief.ts` +
`app/dashboard/page.tsx`): `lifeLine` computes "No encontré eventos
importantes para hoy." but the page **never renders `lifeLine` at
all** — dead code, not a display bug, but worth knowing before anyone
tries to fix the empty state by editing a line that's never shown.
`continuityLine` is correctly `null` (hidden, never invented) with
nothing yet to reference. What a first-time user actually sees: a
greeting, the day of the week, a "Hablar con LUZ" button, and a
feedback link. Not broken, not empty-looking in a jarring way, but
there's very little reason to linger here versus going straight to
`/chat` — which, per Finding #1, is where the CTA already sent them
anyway.

**Finding #5 — "new user" is already known, but unused.**
`auth/config.ts`'s `signIn` event already records `isNewUser` on every
login (`events.type='auth_sign_in'`, `metadata.isNewUser`) — the data
exists to tell a first-timer apart from someone returning, but nothing
in the UI reads it. No first-time-only copy, tooltip, or example
exists anywhere today.

## What to measure

Same principle as `OBSERVABILITY_PLAN.md`: derive from what already
exists before adding new events.

| Signal | Already derivable today | Needs new instrumentation |
|---|---|---|
| Account created | ✅ `events` (`auth_sign_in`, `metadata.isNewUser=true`) | |
| First message sent | ✅ `MIN(conversations.created_at)` per `userId` | |
| First response completed | ✅ `message_sent` event tied to that first conversation | |
| Returned next day | ✅ Any `message_sent`/`auth_sign_in` on a later calendar date than signup | |
| Landing page reached / CTA clicked | | **New** — nothing pre-auth is instrumented at all today; the landing page is fully anonymous |
| Abandoned mid-onboarding (signed up, never sent a message) | ✅ Derivable *by absence*: `users` with no matching `conversations` row — this is exactly the "2 of 13 users never sent a message" finding from the 2026-07-24 user report, already answerable with today's data |

Given that, `onboarding.started` / `.first_message_sent` /
`.first_response_completed` don't need to be new events — they're
queries against `events` + `conversations`, the same pattern
`observability/report.ts` already uses. The one real gap is
pre-auth landing-page instrumentation, which is genuinely new
(anonymous, no `userId` yet) — flagged, not built, per the same
"pause new instrumentation until it's earned" call from today's
observability audit.

## Success criteria (measurable, not "it works")

- A first-time user reaches their first sent message with zero
  external help (no one explaining the product out loud).
- No blank/broken screens or errors anywhere in the funnel above —
  covered today by `smoke/dashboard.test.ts` and `smoke/first-message.test.ts`,
  but those check *the mechanism*, not *the impression*.
- Time to first response stays within whatever P95 first-token
  threshold `OBSERVABILITY_PLAN.md` settles on once a week of real
  data exists — onboarding shouldn't need its own separate latency
  target.
- Of users who send a first message, some non-trivial share return
  within 48h — the "2 of 13 never sent a message" number from
  2026-07-24 is the honest current baseline for the step before that;
  this plan's job is to not add a second drop-off point after it.

## Human validation (Founder's recommendation)

Logs and smoke tests can't answer "did they understand what LUZ is,"
"did they know what to type," or "what did they expect that didn't
happen" — only a person watching another person can. 5–10 external
testers, not the Founder, not anyone who already knows the product:

- **Who**: mix of Colombia Tech Week attendees and people outside the
  existing 13 pilot users — someone who already gets it can't tell you
  where a stranger gets stuck.
- **When**: some before the event (time to actually fix what's found),
  some live during Colombia Tech Week (closest to real demo
  conditions, but too late to fix anything found there before the
  demo itself).
- **Setup**: hand them a phone/laptop with nothing pre-explained
  beyond "here's a link, try it out" — the silence is the point; any
  explanation given out loud is exactly the crutch a real stranger
  won't have.
- **Watch for, don't lead**: where they hesitate, what they click first,
  whether they scroll past the landing page or click "Comenzar"
  immediately (answers Finding #1 empirically), what they type as a
  first message (or if they ask "what do I say?").
- **Ask after, not during**: did you understand what LUZ does? Did you
  know what to write first? Was there a confusing moment? What did you
  expect to happen that didn't?
- **Capture**: a short structured note per tester (not a full
  transcript) — screen where they hesitated, their first message
  verbatim, their answers to the four questions above. Pattern across
  5-10 people matters more than any single session.

## Decisiones abiertas (antes de escribir código)

1. **¿El CTA principal va a `/chat` o a `/dashboard`?** Finding #1 is a
   real product decision, not a bug — resolve deliberately (either fix
   the code to match the "`/dashboard` is the entry point" comments, or
   update those comments to match the code's actual, possibly
   intentional, "straight to chat" design).
2. **¿Se arreglan los hallazgos 2-4 antes o durante la validación
   humana?** Fixing "Conocer más" and adding example prompts is cheap;
   worth doing before the 5-10 testers so their feedback is about
   real gaps, not ones already known and easy to fix.
3. **¿Quiénes son los 5-10 testers y cuándo?** Needs names/dates to
   become actionable — this plan defines the protocol, not the
   calendar.
