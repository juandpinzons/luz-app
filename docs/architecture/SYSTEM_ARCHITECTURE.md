# SYSTEM ARCHITECTURE

## Purpose
Describe the long-term architecture of LUZ.

## Core Layers

Reality
↓
Life Graph
↓
Relationship Graph
↓
Context
↓
Decision
↓
Action

## Core Engines

- Presence Engine
- Context Engine
- Identity Engine
- Memory Engine
- Knowledge Engine
- Life Orchestrator
- Tool Engine

## Connectors

External integrations (Gmail, Calendar, Garmin, WhatsApp, Photos...)
are Connectors, not engines (ADR-0015) — they feed `RealitySnapshot`,
they never couple to Knowledge, Memory, or any other engine directly.

## Rules

- Domain never depends on Next.js.
- Infrastructure is replaceable.
- Engines communicate through contracts/events.
- AI providers are adapters, never business logic.
- Connectors are adapters, never business logic (same rule as AI providers).
