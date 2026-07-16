# ADR-0011 Identity Architecture

Status: Accepted
Date: July 2026
Owner: CTO

## Context

ADR-0009 established that the domain uses Person, not User, but left two
things undefined: how an Account resolves to a Person, and what serves
as the tenant/consistency boundary for a person's data. A single Person
cannot cleanly serve as both "a human being" and "the ownership
boundary of a whole graph" — that becomes untenable the moment a graph
is shared by more than one person (a family, an organization).

## Decision

Introduce three distinct identity concepts, replacing the informal
`UserContext` used throughout the domain today:

- **Account** (infrastructure) — Auth.js session, OAuth, billing. Owned
  by `auth/` and `core/db/schema/users.ts`. Never referenced by domain
  code.
- **LifeGraph** (domain aggregate root) — the tenant/consistency
  boundary. Owns `Person`, `Goal`, `Project`, `Habit`, `Routine`,
  `Relationship`, `LifeEvent`, `LifeDomain`.
- **Person** (domain entity) — a human being, a member of exactly one
  `LifeGraph`. One member is designated the graph's owner. Person
  carries no boundary responsibility of its own.

An Account resolves to a `LifeGraph` (bootstrapping one, plus its owner
`Person`, on first login). All domain code receives a
`LifeGraphContext { lifeGraphId, personId }` — never an `AccountId`.

Memory, Knowledge and Context remain independent engines
(ENGINE_MANIFESTO.md) scoped by `lifeGraphId`; they are not members of
the `LifeGraph` aggregate. Folding them in would violate "no engine
owns another engine."

`auth/user-context.ts` remains the only file in the repository allowed
to know both `AccountId` and `LifeGraphContext` — its role as the sole
bridge is preserved, it now resolves/bootstraps instead of passing
through.

## Consequences

### Positive

- Clean multi-tenancy model, ready for families and organizations
  without a later redesign
- Person is a pure domain entity, free of boundary responsibility
- Domain events can attribute an action to both "which graph" and
  "which member", which a bare `personId` could not express
- Closes the ADR-0009 gap: no domain code references an infrastructure
  identity concept

### Trade-offs

- One more indirection (`lifeGraphId` → `personId`) even for the
  common single-person case
- Larger Phase 2 scope than a root-Person-only design: a new
  `LifeGraph` entity and repository, plus a membership concept
- Every file currently using `UserContext`/`userId` needs updating to
  `LifeGraphContext`/`lifeGraphId` — mechanical, but touches ~11 files

### Future

Review when multi-owner transfer or organization-level roles beyond
"owner"/"member" are needed. Until then, `LifeGraph` membership has
exactly two states.

## Related

- ADR-0001 Ownership Model
- ADR-0002 Domain Isolation
- ADR-0009 Person not User
- docs/architecture/DOMAIN_MODEL_V1.md
- docs/architecture/ARCHITECTURE_DIAGRAM_V1.md
