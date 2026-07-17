# Architecture Diagram v1

Version: 1.0\
Status: Accepted — frozen\
Related: ADR-0011, DOMAIN_MODEL_V1.md

## Identity and domain boundaries

```
+-------------------------------------------+
| Infrastructure                             |
|                                             |
|   Account (Auth.js, OAuth, sessions)       |
|                                             |
+---------------------|----------------------+
                       | resolves to LifeGraph
                       | (bootstrap on first login)
                       v
+-------------------------------------------+
| LifeGraph (aggregate root / tenant bound.) |
|                                             |
|   Person (member, one designated owner)    |
|         |                                  |
|         v                                  |
|   Goal, Project, Habit, Routine,           |
|   Relationship, LifeEvent, LifeDomain      |
|                                             |
+---------------------|----------------------+
                       | lifeGraphId (tenant key,
                       | not aggregate membership)
        +--------------+--------------+
        v              v              v
   +---------+   +-----------+   +---------+
   | Memory  |-->| Knowledge |-->| Context |
   +---------+   +-----------+   +---------+
        ^                             ^
        |                             |
        +---- RealitySnapshot --------+
           (core/reality, ADR-0013 —
            life state + memory context
            + external signals, assembled
            by a future orchestrator,
            never read directly by Context)
```

## Legend

- Solid downward arrows: ownership / composition (aggregate contains
  entity)
- `lifeGraphId` fan-out: tenant scoping, not ownership — Memory,
  Knowledge and Context are independent engines that key their data by
  `lifeGraphId`, they are never members of the `LifeGraph` aggregate
- `RealitySnapshot` (`core/reality`) is the only way Context reads
  Life Graph or Memory state — never a direct read of either. Its
  fields use their own neutral vocabulary, not `core/life`'s or
  `core/memory-engine`'s entity types (ADR-0013)
- The only line crossing the Infrastructure/Domain boundary is
  Account → LifeGraph resolution; no other box ever holds an
  `AccountId`

## Reading order

1. An authenticated Account resolves to exactly one `LifeGraph` per
   login (bootstrapped once, on first login).
2. The `LifeGraph` is the aggregate root for the eight Life Graph
   entities — this is the tenant boundary the rest of the domain reads
   from.
3. Memory and Knowledge process evidence from that `LifeGraph` into
   connected meaning. Context never reads either directly — it
   consumes a `RealitySnapshot`, assembled by a future orchestrator
   from Life Graph and Memory state, and produces a `Context` object:
   what is most relevant right now.

A rendered version of this diagram was shown inline in the review
conversation that produced this document.
