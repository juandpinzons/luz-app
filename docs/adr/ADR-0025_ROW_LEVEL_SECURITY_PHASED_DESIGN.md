# ADR-0025 Row Level Security — Phased Design (Not Yet Implemented)

Status: Proposed — design only, no production changes
Date: August 2026
Owner: Founder (approach chosen 2026-08-21: "diseño por fases, sin tocar prod aún")

## Context

A security audit (2026-08-21) confirmed that LUZ has **no database-level
Row Level Security (RLS) anywhere** — `grep` across all 44 migrations and
`core/db/schema/` for `ENABLE ROW LEVEL SECURITY`/`CREATE POLICY` returns
zero matches. Every table's authorization is enforced entirely at the
application layer: repositories and services filter by `userId`/
`lifeGraphId` before reading or writing (`core/db/client.ts:19` connects
with a single shared Postgres role — `postgres(env.DATABASE_URL,
{prepare:false})` — no per-request role switching).

The same audit sampled ten API routes across chat, conversations,
memories, feedback, gmail, admin, mobile-auth, wearable, and account
deletion, and found no IDOR: every route resolves identity first
(`getUserContext()`/`auth()`), then scopes the query by that identity.
App-level authorization is real and currently passes verification, not
a theoretical claim.

RLS is being evaluated as **defense in depth**, not because app-level
authorization has a known hole. The risk this ADR manages is a
different one: a *future* bug — a repository method written without a
`WHERE userId = ...` clause, a raw SQL query, an admin script run
against the wrong scope — would today have nothing at the database
layer to catch it. RLS makes "forgot the WHERE clause" fail closed
instead of silently returning another user's rows.

## Why this is not a one-line config change

Postgres RLS policies are enforced **per connection role**, not per
query. Today's app connects as a single owner-equivalent role for every
request, from every user. Two consequences that make naive activation
dangerous on a live production database with real users:

1. **Table owners bypass RLS by default.** If the connecting role owns
   the tables (as `neondb_owner`-equivalent typically does), enabling
   RLS with `ENABLE ROW LEVEL SECURITY` does nothing until
   `FORCE ROW LEVEL SECURITY` is also set — and if it's set before the
   app has any way to tell Postgres *which* user is making the request,
   every query returns zero rows. That is a full outage, not a
   degraded state.
2. **There is currently no mechanism to tell Postgres who the request
   is for.** RLS policies need something to compare against —
   typically a `SET LOCAL app.current_user_id = '<uuid>'` session
   variable set at the start of every transaction, or a distinct
   Postgres role per user (impractical at this scale: connection
   pooling, Neon's pooler in transaction mode, and per-role connection
   limits all fight this pattern). Building and wiring that session
   variable is real application code, not a database migration.

Getting this wrong on Neon production, serving real users, is the kind
of mistake that is hard to reverse quickly (every query starts failing
the moment `FORCE ROW LEVEL SECURITY` takes effect) — which is why the
Founder's explicit direction was design-and-verify-first, not ship.

## Proposed phased rollout

**Phase 1 — Policies exist, inert.** Add `ENABLE ROW LEVEL SECURITY`
and `CREATE POLICY` statements for the highest-sensitivity tables
first (`conversation_messages`, `memories`, `beliefs`) as a migration,
**without** `FORCE ROW LEVEL SECURITY`. Because the connecting role
owns these tables, RLS stays bypassed for the existing connection —
the app's behavior does not change at all. This phase is safe to apply
to production on its own: it changes nothing observable, it only makes
the policies exist for Phase 2 to activate.

**Phase 2 — Session-scoped identity, verified locally first.**
Introduce a `withRequestScope(userId, fn)` wrapper around
`core/db/client.ts` that runs `SET LOCAL app.current_user_id = $1`
inside every request-scoped transaction, and write the matching
policies (`USING (user_id = current_setting('app.current_user_id')::uuid)`).
Verify end-to-end against a local/staging Postgres — seed two users,
confirm cross-user reads return zero rows under the new role/policy
combination, confirm the existing app-level checks still produce
identical results (RLS should be *redundant* with them at this point,
never the only thing standing between a bug and a leak).

**Phase 3 — Switch the connection role, force RLS, one table at a
time.** Only after Phase 2 is verified: create the least-privilege
role from the still-unapplied `create_restricted_ops_role.sql`
(tracked as open since ADR-0024), grant it row access gated by the new
policies, point the app's runtime connection at it, and set
`FORCE ROW LEVEL SECURITY`. Roll out one table at a time, watching
error rates, with an immediate rollback path (repoint the connection
string back to the owner role) at every step.

## Explicitly deferred, not decided by this ADR

- Which tables beyond `conversation_messages`/`memories`/`beliefs`
  need policies, and in what order — a candidate list, not a
  commitment: `insights`, `concepts`, `contradictions`,
  `feedback_responses`, `accounts` (OAuth tokens), `journal_entries`
  (currently orphaned — see the 2026-08-21 audit note on this table's
  dead status before deciding it needs policies at all).
- Whether Phase 3's restricted role reuses `create_restricted_ops_role.sql`
  as-is or needs a distinct definition for the *application's* runtime
  connection versus the break-glass ops role ADR-0024 already
  describes — these may end up being the same role or two different
  ones; not resolved here.
- Timeline. This ADR exists so the design is ready when the Founder
  decides to schedule Phase 1; it does not itself schedule anything.

## Status of this decision

No SQL has been written or applied against any database, local or
production, as part of this ADR. `core/db/client.ts` is unchanged.
Application-level authorization (verified clean in the 2026-08-21
audit) remains the only enforcement mechanism today.
