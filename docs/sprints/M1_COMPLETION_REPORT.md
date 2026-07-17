# M1 Completion Report — Identity Flow + LifeGraph Persistence

Phase II (Behavior Implementation), Milestone 1. Covers completion of
Sprint 07 (Identity Layer) scope and the persistence portion of Sprint
08 (Life Graph Foundation) from `ROADMAP.md`. Delivered as six
sequential, individually reviewed PRs (PR-001 through PR-006).

## Objectives achieved

- A real, persistent `lifeGraphId` / `personId` tenant boundary exists
  (ADR-0011) and is resolvable from a live Account session.
- A LifeGraph and its owner Person are created atomically on an
  Account's first login (`LifeGraphBootstrap`), resolving the
  LifeGraph↔Person mutual-reference without any deferred-constraint
  support in the ORM.
- `AccountIdentityResolver` is implemented and wired into the live
  request path: an authenticated chat request now resolves (and
  bootstraps if needed) its caller's `LifeGraphContext`.
- The existing chat flow (Auth.js login → `/chat` UI → `/api/chat` →
  OpenAI → persistence) is verified unchanged at every step — compiled
  and linted clean after each PR, with grep confirmation that no new
  class was referenced outside its own file until PR-006 intentionally
  wired one in.

## Files added

- `core/db/schema/life-graph.ts` — `life_graphs`, `persons` tables
- `core/db/migrations/0003_add_life_graphs_and_persons.sql` (+ `meta/0003_snapshot.json`)
- `core/db/migrations/0004_add_account_identities.sql` (+ `meta/0004_snapshot.json`)
- `core/life/repositories/drizzle-life-graph.repository.ts` — `DrizzleLifeGraphRepository`
- `core/life/repositories/drizzle-person.repository.ts` — `DrizzlePersonRepository`
- `core/life/services/drizzle-life-graph-bootstrap.ts` — `DrizzleLifeGraphBootstrap`
- `auth/drizzle-identity-resolver.ts` — `DrizzleAccountIdentityResolver` + `createAccountIdentityResolver`

## Files modified

- `core/db/schema/index.ts` — barrel export for `life-graph`
- `core/life/index.ts` — barrel exports for the three new `core/life` files
- `auth/schema.ts` — added `account_identities` link table
- `auth/user-context.ts` — added `getLifeGraphContext()`
- `app/api/chat/route.ts` — additive, try/caught call to `getLifeGraphContext()`
- `core/db/migrations/meta/_journal.json` — drizzle-kit bookkeeping

## Known limitations

- Downstream consumers (`features/chat`, Memory, Knowledge) still run
  on `UserContext`, not `LifeGraphContext`. `conversations` and
  `conversation_messages` remain keyed by plain `userId`. Migrating
  them is explicitly out of M1's scope.
- A concurrent first-login race can leave one bootstrapped LifeGraph +
  Person orphaned (never referenced, self-limiting). No lock was
  implemented — documented trade-off, not a defect.
- No domain events are emitted (`LifeGraphCreated`,
  `PersonAddedToLifeGraph`). No event bus or publisher exists anywhere
  in the codebase to emit them to.
- `DrizzleLifeGraphRepository.save()` cannot persist an ownerless
  LifeGraph on its own, since the domain type requires a non-null
  `ownerPersonId`. `LifeGraphBootstrap` works around this with direct,
  ordered table inserts inside one transaction rather than widening
  that interface.
- `LifeGraphContext` resolution is triggered from the first
  authenticated `/api/chat` request, not from Auth.js's own sign-in
  event. Chosen deliberately to avoid adding a new failure mode to the
  working OAuth callback; resolution is idempotent regardless of when
  it first runs.
- Migrations 0003 and 0004 were generated and schema-validated but not
  applied against a running database in this environment — no
  Postgres instance was available to verify against.

## Architectural decisions respected

- ADR-0011 (Identity Architecture): `core/life` never references
  `AccountId`. The `account_identities` link table lives in
  `auth/schema.ts`, not in the domain schema.
- `DOMAIN_MODEL_V1.md`: `LifeGraph` / `Person` entity shapes are
  exactly as already frozen — no field added, removed, or retyped.
- No new engine, no domain-model change, no public interface change —
  consistent with `docs/engineering/claude/11_FORBIDDEN_ACTIONS.md` and
  `12_DECISION_BOUNDARIES.md`.
- A deferred FK constraint was considered for the LifeGraph↔Person
  creation order and rejected after confirming the installed
  `drizzle-orm@0.45.2` has no API for it — resolved instead with an
  ordered-insert transaction, touching neither the domain types nor
  the repository interfaces already approved in PR-002.
- `UserContext` and `LifeGraphContext` intentionally coexist, per
  ADR-0011's own migration note — no consumer was switched over ahead
  of its own milestone.

## Next milestone prerequisites

- Authorization decision for Memory Engine Phase B: the migration plan
  (`MEMORY_ENGINE_MIGRATION_PLAN.md`) and ADR-0012 both currently mark
  it "not authorized to execute." The next milestone depends on it.
- Ownership/location decision for the RealitySnapshot assembler
  (ADR-0013 leaves this explicitly unowned).
- `features/chat`'s scoping (`conversations` / `conversation_messages`
  by `userId`) is untouched by M1 and will need a deliberate cutover
  decision when Memory scoping changes.
- Apply and verify migrations `0003`/`0004` against a running database
  before any real deployment relies on this work.
