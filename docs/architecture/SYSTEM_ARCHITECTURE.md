# SYSTEM_ARCHITECTURE

Version: 1.0

## Vision

LUZ is composed of independent engines communicating through clear interfaces.

## Layers

UI
↓
Features
↓
Core (Domain)
↓
Infrastructure

## Engines

### Conversation Engine
Handles conversations and messaging.

### Memory Engine
Decides between structured memory and semantic memory.

### Knowledge Engine
Runs asynchronously:
Extract → Classify → Relate → Generate → Validate → Persist

### Planner Engine
Transforms goals into plans and follow-up actions.

### Tool Engine
Connects external capabilities (calendar, email, documents, etc.).

## Infrastructure

- Next.js
- React
- TypeScript
- PostgreSQL
- pgvector
- Drizzle ORM
- AI Provider abstraction
- Worker + Job Queue

## Rules

- Business logic never depends on Next.js.
- UI never accesses the database directly.
- LLMs never write directly to memory.
- Workers execute heavy processing asynchronously.
