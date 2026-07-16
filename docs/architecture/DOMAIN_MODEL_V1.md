# LUZ Domain Model v1

Version: 1.0\
Status: Accepted — frozen\
Related: ADR-0011, ARCHITECTURE_DIAGRAM_V1.md

## Purpose

Canonical shape of the domain after the identity architecture review
(Account vs. LifeGraph vs. Person). This is the reference for
implementing Phase 2 (Life Graph Foundation) and everything after it.
Supersedes the informal `UserContext`-based scoping used in Sprint 7.

## Three boundaries

```
Account (infrastructure)
    | resolves to (bootstrap on first login)
    v
LifeGraph (aggregate root — tenant boundary)
    | has members, one designated owner
    v
Person (domain entity — no boundary responsibility)
    |
    v
Goal, Project, Habit, Routine, Relationship, LifeEvent, LifeDomain
    (every one scoped by lifeGraphId, each attributable to a personId)
```

Memory, Knowledge and Context are not on this chain. They are
independent engines (ENGINE_MANIFESTO.md) that read `lifeGraphId` as a
tenant key — they are never contained by the `LifeGraph` aggregate.

## Aggregate roots

- **LifeGraph** — the aggregate root and only tenant/consistency
  boundary in the domain. Every query that today means "this user's
  data" means "this LifeGraph's data."
- **Person** — a member of exactly one `LifeGraph`. Membership is
  expressed by belonging to a graph, not by a self-referential owner
  field. Exactly one member per graph is the designated owner.

## Entities

| Entity | Aggregate | Scoped by | Responsibility |
|---|---|---|---|
| LifeGraph | itself | — | tenant boundary, membership, ownership |
| Person | LifeGraph | `lifeGraphId` | a human being — owner or related member |
| Relationship | LifeGraph | `lifeGraphId` | vínculo between two members |
| Goal | LifeGraph | `lifeGraphId` | intention with a target |
| Project | LifeGraph | `lifeGraphId` | bounded effort toward a goal |
| Habit | LifeGraph | `lifeGraphId` | declared recurring behavior |
| Routine | LifeGraph | `lifeGraphId` | recurring pattern detected by the system |
| LifeEvent | LifeGraph | `lifeGraphId` | timeline moment |
| LifeDomain | LifeGraph | `lifeGraphId` | wheel-of-life area instance |

Every entity above still carries the value objects already scoped for
Phase 2 (`GoalStatus`, `ProjectStatus`, `RoutineFrequency`,
`LifeDomainType`, `RelationshipType`) — this document changes ownership
wiring, not entity content.

## Identity flow

```
Google OAuth
    v
Auth.js session (AccountId = session.user.id)
    v
auth/user-context.ts   <- only file that knows both sides
    | resolves AccountId -> LifeGraph
    | (bootstraps LifeGraph + owner Person on first login)
    v
LifeGraphContext { lifeGraphId, personId }
    v
core/life, core/memory, core/knowledge, features/*
    (never see AccountId or import anything from auth/)
```

`LifeGraphContext` replaces `UserContext` as the type threaded through
every domain and feature function.

## Domain events (Phase 2 set, updated)

- `LifeGraphCreated` — new
- `PersonAddedToLifeGraph` — new (member joins, owner or related)
- `GoalCreated`, `HabitCreated`, `RoutineDetected`,
  `LifeEventRegistered`, `RelationshipUpdated` — payload now carries
  both `lifeGraphId` (which graph) and `personId` (which member),
  where the Phase 2 draft carried only an implicit single-user scope

## Explicitly out of scope for v1

- Persistence and migrations
- Ownership transfer flows
- Organization-level roles beyond owner/member
- Any change to Memory, Knowledge, Presence, or Tool engines
