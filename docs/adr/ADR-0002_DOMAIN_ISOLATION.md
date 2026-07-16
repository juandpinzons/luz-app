# ADR-0002 Domain Isolation

Status: Accepted
Date: July 2026
Owner: CTO

## Context

Frameworks evolve faster than business rules.

## Decision

Business domain must never depend on Next.js, Auth.js, OpenAI or database adapters.

## Consequences

### Positive
- Portable domain
- Easier testing

### Trade-offs
- More adapter code

### Future
Review when architectural assumptions change.
