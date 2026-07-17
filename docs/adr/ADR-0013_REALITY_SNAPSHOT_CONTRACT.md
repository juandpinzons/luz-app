# ADR-0013 Reality Snapshot Contract

Status: Accepted
Date: July 2026
Owner: CTO

## Context

Knowledge Engine Foundation (Engineering Package 04) originally
consumed a `Memory` (`core/memory-engine`) directly, transforming a
single piece of evidence into an insight. The architecture review
identified that this is too narrow: Knowledge should interpret
reality (ADR-0008), not only isolated memories — an insight is often
only meaningful in light of current Life Graph state (an active goal,
a running project) alongside the memory that triggered it.

A first proposal (Knowledge-specific `LifeGraphSnapshot`) was
rejected in favor of a generalized, engine-agnostic contract, since
any future engine — not only Knowledge — will plausibly need "the
current state of reality" as an input.

## Decision

Introduce `core/reality/`, a new shared-kernel module living alongside
`core/life` (not inside it, and not inside any engine). It exports a
single top-level contract:

```ts
interface RealitySnapshot {
  lifeGraphId: EntityId;
  capturedAt: Date;
  life: LifeStateSnapshot;      // structured Life Graph state
  memory: MemoryContextSnapshot; // relevant memory context
  signals: ExternalSignalSnapshot; // calendar/document/email/sensor — placeholder, no engine yet
}
```

Every section uses a **locally-defined, neutral vocabulary**
(`LifeStateItem`, `RealityMemoryItem`, `ExternalSignal`) — `core/reality`
does not import `Goal`/`Project`/`Habit` from `core/life`, nor `Memory`
from `core/memory-engine`. A future application-level assembler reads
from those modules and translates their real entities into this
neutral shape; that translation is the anti-corruption boundary and
never lives inside `core/reality` or inside any engine.

Knowledge Engine's `ExtractStage`, `InsightRelationshipStrategy`, and
`InsightGenerationStrategy` now consume `RealitySnapshot` /
`RealityMemoryItem` instead of `Memory`. Knowledge no longer imports
anything from `core/memory-engine` — its only dependencies are
`core/life`'s shared kernel (`EntityId`, `LifeGraphContext`,
`DomainEvent`) and `core/reality`.

## Consequences

### Positive

- Knowledge Engine's coupling to Memory Engine drops to zero — a
  stronger result than the original proposal (Memory + Knowledge-local
  DTO), which still imported `Memory` directly
- The pattern generalizes: any future engine (Presence, Context,
  Tool) that needs "current reality" consumes the same contract
  instead of each inventing its own snapshot shape
- Forward-compatible with signal sources that don't have engines yet
  (calendar, documents, email, sensors) without a future breaking
  change to the contract's shape

### Trade-offs

- `RealitySnapshot` is a point-in-time read (`capturedAt`), not a live
  view — consumers must not assume it stays current for the duration
  of a long-running operation
- Assembling a `RealitySnapshot` (translating real `core/life` and
  `core/memory-engine` data into the neutral shape) is new
  orchestration work with no owner yet — explicitly out of scope here
- **Resolved** (Engineering Package 05): the overlap with
  `CONTEXT_ENGINE_SPEC.md`'s "Unified Context Object" is not identity —
  `RealitySnapshot` is Context Engine's **input** contract, not its
  output. Context Engine consumes `RealitySnapshot` and produces a
  distinct `Context` object (`core/context-engine`). The original
  guess in this ADR (that `RealitySnapshot` was the likely output) was
  wrong; corrected here rather than left standing.

### Future

Extend `ExternalSignalSnapshot`'s sources as calendar/document/
email/sensor engines are built, not before.

## Related

- ADR-0008 Reality Model
- ADR-0011 Identity Architecture
- Knowledge Engine Foundation (Engineering Package 04)
- Context Engine Foundation (Engineering Package 05)
- docs/architecture/CONTEXT_ENGINE_SPEC.md
