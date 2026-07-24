# Deploy Runbook

Status: Active\
Owner: Founder\
Last verified: 2026-07-24

How a change goes from `main` to real users, and how to confirm it
actually worked. Written after the 2026-07-24 incident where migration
`0011_left_imperial_guard` was committed but never run against
production — Dashboard/Life silently returned empty for every user for
days because nothing enforced or automated that step. See ADR-0017's
2026-07-24 amendment for the `after()` incident from the same day.

## How a deploy actually happens

There is no separate CI pipeline. `main` is connected directly to the
Vercel project `joinluz/luz-app` — every push to `main` triggers a
production build and deploy automatically.

`package.json`'s `build` script is:

```
"build": "drizzle-kit migrate && next build"
```

This means **every deploy applies any pending database migrations
first, automatically**, using the same `DATABASE_URL` the app runs
with (Vercel's Sensitive environment variables are available during
the build step, not just at runtime). If `drizzle-kit migrate` fails
for any reason (bad SQL, an unreachable database, a broken migration
file), `next build` never runs and the whole deploy fails loudly in the
Vercel build log — a deploy can no longer silently ship code that
expects tables the database doesn't have yet.

**This replaces manually running `npm run db:migrate` against
production.** Don't run it by hand against prod anymore — it happens as
part of every deploy now. Local development is unaffected: `npm run
build` locally still migrates your local `.env` database first, same
as it always effectively should have.

## Before pushing to `main`

1. `npx tsc --noEmit` — typecheck.
2. `npx eslint .` — lint.
3. If the change touches `core/db/schema/`, make sure the migration was
   generated (`npm run db:generate`) and is committed **together with**
   the code that depends on it, in the same PR/commit. A migration
   file sitting uncommitted (or committed but the code that needs it
   held back) is exactly the gap that caused the 2026-07-24 incident —
   there is no manual "remember to migrate later" step anymore, but
   there is also no gate stopping an unrelated, not-yet-approved
   migration from applying the moment it's merged. Don't commit a
   migration for a feature that isn't ready to ship (see
   `core/db/schema/feedback.ts` / migration `0010_lively_bug`, sitting
   uncommitted on purpose as of this writing, for exactly this reason).
4. `npm run build` locally at least once if the change is
   non-trivial — it exercises the same migrate-then-build sequence
   Vercel will run.

## After a deploy lands (smoke test)

Vercel marks a deployment "Ready" once the build succeeds — that only
means the code compiled and migrations applied without error, **not**
that the app works. Confirm manually:

1. Open the production URL, log in with Google.
2. **Dashboard loads with real content**, not just the "Buenos días"
   fallback — if you have any Goals/Projects, they should render. An
   empty Dashboard for an account that should have data is the exact
   symptom of the 2026-07-24 incident; treat it as a signal to check
   migration status (below), not just a UI quirk.
3. Send a chat message and confirm the reply streams in (not just
   arrives all at once) — confirms `/api/chat`'s SSE path is healthy.
4. Reload `/chat` and confirm the conversation history is still there.
5. Check for new rows in `events` where `type = 'error'` from the last
   few minutes — zero is healthy:

   ```sql
   select route, message, count(*)
   from events
   where type = 'error' and created_at > now() - interval '10 minutes'
   group by route, message;
   ```

The full scope of this checklist — preconditions, steps, and success
criteria per flow, plus what a smoke test does and doesn't guarantee —
is `docs/engineering/SMOKE_TEST_PLAN.md`. Login, first message
(streaming), and Dashboard are the first three flows planned for
automation; until they're built, this manual pass is the gate.

## Checking migration status directly

If a smoke test fails in a way that looks like a missing table/column,
check whether the deploy's migrate step actually ran and succeeded —
first place to look is the Vercel build log for that deployment
(`drizzle-kit migrate` output appears near the top, before the Next.js
build output). To check the database's own state directly:

```sql
-- How many migrations Postgres thinks are applied:
select count(*) from drizzle.__drizzle_migrations;
```

Compare against the number of entries in
`core/db/migrations/meta/_journal.json` on `main` at the deployed
commit. If the database count is lower, migrations are pending —
redeploy (which re-runs `drizzle-kit migrate`) rather than applying
anything by hand.

## Rollback

There's no automatic migration rollback (Drizzle doesn't generate
`down` migrations here). If a migration ships something wrong:

1. Revert the offending commit on `main` and push — this redeploys the
   previous code, but **does not** undo the migration that already
   ran (migrations only ever move forward).
2. If the schema change itself needs to be undone, write a new forward
   migration that reverses it (e.g. a `DROP COLUMN` migration) rather
   than trying to edit or delete an already-applied migration file.
