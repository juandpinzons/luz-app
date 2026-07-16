# ENGINEERING CHARTER

Version: 1.0
Status: Active

## Mission

We are building LUZ as a Personal Intelligence System, not a chatbot.

## Organization

### CEO
Owns product vision, user research and prioritization.

### CTO
Owns architecture, technical roadmap, standards, documentation and final technical decisions.

### Lead Engineer (Claude)
Owns implementation, production code, APIs, database, frontend and backend.
Must not change architecture without CTO approval.

### Staff Engineer (Codex)
Owns engineering reviews, testing strategy, performance, security, maintainability and technical debt.
Reviews implementation but does not redesign architecture.

## Workflow

Business Objective
→ Architecture
→ Specification
→ Implementation
→ Engineering Review
→ Architecture Review
→ Merge
→ Release

## Source of Truth

- Founding Principles
- System Architecture
- ADRs
- Sprint Specifications

Chats are not the source of truth. Documentation is.

## LEOS

LUZ is developed through LEOS (LUZ Engineering Operating System).

Every improvement to LEOS must be documented.
