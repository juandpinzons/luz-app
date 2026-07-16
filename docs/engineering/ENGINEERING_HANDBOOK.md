# ENGINEERING_HANDBOOK

Version: 1.0
Status: Active
Owner: CTO

# Purpose

This handbook defines how engineering is performed at LUZ.

The objective is to build a Personal Intelligence System that can evolve for the next decade.

---

# Engineering Organization

CEO
- Product vision
- User research
- Prioritization

CTO
- Architecture
- Technical roadmap
- Standards
- Architecture reviews

Lead Engineer
- Implementation
- Production code
- Sprint execution

Staff Engineer
- Reviews
- Quality
- Performance
- Security
- Testing

---

# Engineering Workflow

Idea
↓
Architecture
↓
Specification
↓
Implementation
↓
Engineering Review
↓
Architecture Review
↓
Merge
↓
Release

---

# Definition of Done

A sprint is complete only if:

- Code works.
- Architecture is respected.
- No critical review findings remain.
- Documentation is updated.
- ADRs are updated when needed.
- Build passes.
- Lint passes.
- Types pass.

---

# Non-Negotiable Rules

- Domain before framework.
- No business logic in UI.
- LLMs never own system state.
- Every architectural decision is documented.
- Prefer explicit code over clever code.
- Optimize for long-term maintainability.

---

# Living Documents

The CTO maintains:

- Architecture Ledger
- Engineering Ledger
- Risk Ledger
- ADRs
- Technical Roadmap

This handbook evolves with the project.
