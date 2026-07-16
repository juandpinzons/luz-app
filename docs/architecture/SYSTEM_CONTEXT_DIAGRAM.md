# SYSTEM CONTEXT DIAGRAM

Version: 1.0
Status: Draft
Owner: CTO

## External Actors
- User
- LLM Provider(s)
- Email Providers
- Calendar Providers
- Document Providers

## Core Systems
- Web App (Next.js)
- API Layer
- Memory Engine
- Knowledge Engine
- Planner Engine
- Worker
- PostgreSQL + pgvector

## Principle
External services never access domain logic directly.
All requests pass through application services.
