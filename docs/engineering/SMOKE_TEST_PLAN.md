# Smoke Test Plan

Status: Active\
Owner: Founder\
Last verified: 2026-07-24

## What this is, and what it isn't

A smoke test answers one question: **did the last deploy leave LUZ
usable, or not.** It is not a correctness suite, not a regression suite,
and not a substitute for the Founder's own lived usage — a scripted
check proves the mechanism ran, never that the experience is good.
Small, deterministic, fast (5–10 min run), and scoped to **"is
production broken"**, not "is production perfect."

**What passing guarantees**: the seven flows below completed with no
P0-level failure (defined below), against the real production database
and a real deployed request/response cycle — not mocks.

**What passing does NOT guarantee**: response quality, memory relevance,
Knowledge Engine output (still disconnected stubs per `ALPHA_BACKLOG.md`
P1-1 — out of scope for this suite on purpose), UX polish, or that any
individual user's data is correct. A green smoke test means "safe to
tell people to use it," not "finished."

Referenced from `DEPLOY_RUNBOOK.md`'s post-deploy checklist, which this
plan formalizes.

## P0 definition — any one of these blocks a deploy / triggers immediate rollback

- Can't log in.
- Can't send a first message.
- The stream doesn't respond, or cuts off before finishing.
- No conversation gets created.
- Dashboard or `/life` return a 500, or silently show empty/degraded
  content that should have real data (see the 2026-07-24 incident —
  this specific failure mode doesn't throw, it just goes quiet).
- Pending migrations at deploy time (should no longer be possible per
  the `drizzle-kit migrate && next build` change, but the smoke test
  double-checks it rather than trusting the build step blindly).
- New critical error events in `events` (`type = 'error'`) during the
  test run that aren't explained by the test itself.

## The seven flows

Each flow: **Preconditions** → **Steps** → **Success criteria** (and
explicitly, what would count as failure).

### 1. Landing
- **Preconditions**: none (public route).
- **Steps**: load `/`. Click the primary CTA.
- **Success criteria**: page renders with no client console errors;
  CTA navigates to `/login` (or `/dashboard` if already authenticated).
  Failure: blank page, hydration error, dead CTA.

### 2. Login
- **Preconditions (manual)**: a dedicated test Google account (not the
  Founder's own — avoids polluting real usage data). LUZ only supports
  Google OAuth today, there's no email/password signup to test
  separately.
- **Steps (manual)**: `/login` → Google OAuth consent → redirect back.
- **Success criteria**: lands on `/dashboard` (the post-login entry
  point), a row exists in `sessions` for the new session, and — for a
  first-ever login — a `users` row, an `account_identities` row, and a
  `life_graphs` row all get created (see `auth/drizzle-identity-resolver.ts`).
  Failure: redirect loop, 500 on callback, no session row.
- **Automated version** (`smoke/login.test.ts`): deliberately narrower
  — it injects a `sessions` row directly for a fixed fixture account
  (`smoke-test@luz.internal`, see "Test data" below) instead of driving
  real Google OAuth, since scripting a third party's consent screen
  isn't LUZ's to test or maintain. It verifies the part that *is* LUZ's
  responsibility: a valid database session actually authenticates
  `/dashboard`. The OAuth handshake itself stays a manual/occasional
  check.

### 3. First message (streaming)
- **Preconditions**: logged in (flow 2), no existing conversation for
  a clean "new conversation" path.
- **Steps**: send a message from `/chat` with SSE streaming (the
  default client behavior since ADR-0017).
- **Success criteria**: chunks arrive progressively (not one blob at
  the end); a `conversations` row is created; both the user and
  assistant `conversation_messages` rows are persisted; the
  conversation's `title` is non-null within a few seconds after the
  reply finishes (proves the `after()`-scheduled background task in
  `finalizeReply` actually ran — this is the exact mechanism the
  2026-07-24 `after()` incident broke). Failure: stream hangs/errors,
  no persisted messages, title stays `null` indefinitely.

### 4. Memory / Life Capture (background)
- **Preconditions**: flow 3 completed, message content that Memory
  Engine should classify with a real understanding signal (e.g.
  mentions a concrete goal or relationship — see
  `DeterministicMemoryRankingStrategy` / `UNDERSTANDING_SIGNALS`).
- **Steps**: none beyond flow 3 — this flow only *observes* what
  happens in the background after sending that message.
- **Success criteria**: no new `events` row with `type = 'error'` tied
  to this request; if the memory's rank score clears
  `MIN_SCORE_WITH_UNDERSTANDING_SIGNAL`, a corresponding row appears in
  the relevant `core/life` table (`life_goals`/`life_projects`/
  `life_habits`/`life_relationships`) and a `knowledge_jobs` row gets
  enqueued. Explicitly **not** checked: whether the Knowledge Engine
  ever processes that job — it's disconnected stubs today (P1-1),
  checking further would test something not built yet.

### 5. Dashboard / Life
- **Preconditions**: a test account with at least one real Goal/Project
  captured via flow 4 (an account with zero Life data can't
  distinguish "correctly empty" from "silently broken").
- **Steps**: load `/dashboard`, then `/life`.
- **Success criteria**: no 500s; if the test account has Goals/Projects,
  they render (not just the generic "Buenos días" fallback — that
  fallback is only valid for an account that genuinely has none yet).
  This is precisely the check that would have caught the
  2026-07-24 missing-migration incident before it reached real users.

### 6. New session (persistence)
- **Preconditions**: flows 2–3 completed.
- **Steps**: sign out. Sign back in with the same test account.
- **Success criteria**: `/chat` shows the same conversation history
  (via `GET /api/chat`); `/dashboard` still reflects the same Life
  data. Failure: history gone, session doesn't restore, data reset.

### 7. Deploy sanity
- **Preconditions**: a deploy just completed.
- **Steps**: per `DEPLOY_RUNBOOK.md` — check the build log for the
  `drizzle-kit migrate` step, check `drizzle.__drizzle_migrations`
  count against `core/db/migrations/meta/_journal.json`, check `events`
  for new errors in the last 10 minutes.
- **Success criteria**: migrate step ran and reported success; no
  migration count gap; zero unexplained new error events.

## Phasing

Automate first, in this order — these three cover most of LUZ's
functional risk and catch major regressions fastest:

1. **Login** (flow 2)
2. **First message with streaming** (flow 3)
3. **Dashboard** (flow 5)

Flows 1, 4, 6, 7 stay manual for now (7 is already a documented
`DEPLOY_RUNBOOK.md` checklist, not blocked on automation) and get
automated incrementally without holding up Colombia Tech Week prep.

## Implementation (built 2026-07-24)

`smoke/` — a small `tsx` script, no new test framework (Playwright,
etc.): more setup and more fragile than a 3–10 flow suite at this
project's size calls for.

```
smoke/
  runner.ts              -- CLI entry point, registers + runs flows
  types.ts               -- SmokeFlow / SmokeContext / SmokeResult
  login.test.ts
  first-message.test.ts
  dashboard.test.ts
  utils/
    test-account.ts      -- resets + returns the fixture account
    http.ts               -- fetch wrapper carrying the session cookie
```

Run with `npm run smoke` (all flows) or `npm run smoke -- --flow
<name>` (one flow — still self-contained, the runner resets the
fixture account before any flow regardless of which one is selected).
Needs `.env.smoke` (gitignored — copy `.env.smoke.example`) pointing
`DATABASE_URL` at whichever environment you're testing, normally
production. Each flow throws to fail; the runner catches it, prints
PASS/FAIL with duration, and exits `1` if anything failed — ready to
wire into CI later without changes.

### Test data

A single fixture account, `smoke-test@luz.internal`, reused (not
recreated) every run — `resetTestAccount()` deletes its `life_graphs`
row first (cascades to everything hanging off it: `persons`,
`account_identities`, `life_goals/projects/habits/routines/
relationships`, `memories`, `memory_connections`, `memory_embeddings`
— all `ON DELETE CASCADE`), plus its `conversations` and
`knowledge_jobs`, then re-bootstraps a fresh `LifeGraphContext` through
the same `AccountIdentityResolver` production uses and opens a new
session. Every run starts from the same known-empty state — no flow
depends on what a previous run left behind.

**This account is a real, permanent row in production's `users`
table by design.** Exclude it from any user-count report or the
`/admin` dashboard once it exists (`email <> 'smoke-test@luz.internal'`,
or filter the `@luz.internal` domain generally) — it will otherwise
inflate real user metrics. It was already excluded from the
2026-07-24 user report by construction (that report predates this
account).
