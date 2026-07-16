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
        +----- Life Graph state ------+
              (goals/projects in flight
               read directly, not only
               via Knowledge)
```

## Legend

- Solid downward arrows: ownership / composition (aggregate contains
  entity)
- `lifeGraphId` fan-out: tenant scoping, not ownership — Memory,
  Knowledge and Context are independent engines that key their data by
  `lifeGraphId`, they are never members of the `LifeGraph` aggregate
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
   connected meaning; Context assembles a unified view from both
   Knowledge and the LifeGraph's current state directly.

A rendered version of this diagram was shown inline in the review
conversation that produced this document.
