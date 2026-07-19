# LUZ Documentation

Version: 1.0\
Status: Canonical

------------------------------------------------------------------------

# Purpose

This directory contains the canonical documentation for LUZ.

The documentation is the source of truth for product, architecture and
engineering decisions.

Code implements the documentation.

Documentation defines the code.

------------------------------------------------------------------------

# Documentation Map

    docs/

    README.md

    vision/
    concepts/
    governance/
    architecture/
    adr/
    engineering/
    product/
    reviews/
    sprints/
    legal/

------------------------------------------------------------------------

# Reading Order

A new engineer should read the documentation in this order:

1.  vision/
2.  concepts/
3.  governance/
4.  architecture/
5.  adr/
6.  engineering/
7.  legal/
8.  sprints/
9.  product/
10. reviews/

This sequence explains:

Why LUZ exists.

What LUZ is.

How LUZ works.

Why architectural decisions were made.

How engineering is organized.

What is currently being built.

------------------------------------------------------------------------

# Folder Responsibilities

## vision/

Permanent product vision — why LUZ exists, and how it should behave
and feel regardless of implementation (`BEHAVIORAL_PRINCIPLES.md` and
the documents that operationalize it). Not architecture, not
governance, not engineering — see
[`docs/governance/DOCUMENT_CLASSIFICATION.md`](governance/DOCUMENT_CLASSIFICATION.md)
for how these layers stay independent.

Changes are extremely rare.

------------------------------------------------------------------------

## concepts/

Canonical language of LUZ.

Defines Person, Relationship, Life, Context, Intelligence and Trust.

No implementation details belong here.

------------------------------------------------------------------------

## governance/

Rules: who the organization is, how documents are classified, how
changes to documentation are approved.

Not architecture. Not process. The rules that the rest of the
documentation system — including this file — is built on.

------------------------------------------------------------------------

## architecture/

System architecture.

Engine responsibilities.

Interaction models.

Domain boundaries.

Data flow.

------------------------------------------------------------------------

## adr/

Architecture Decision Records.

Every major architectural decision must be documented before
implementation.

No significant architectural change may bypass an ADR.

------------------------------------------------------------------------

## engineering/

Engineering standards.

Git workflow.

Definition of Done.

Release strategy.

Security.

Development practices.

------------------------------------------------------------------------

## sprints/

Engineering Packages.

Sprint goals.

Acceptance criteria.

Implementation roadmap.

------------------------------------------------------------------------

## product/

Product specifications.

UX.

Features.

Roadmaps.

Experience evolution.

------------------------------------------------------------------------

## reviews/

Architecture reviews.

Code reviews.

Postmortems.

Technical audits.

------------------------------------------------------------------------

## legal/

Governance and compliance policy.

Not architecture. Not implementation guidance.

Defines how the project itself is governed — including AI-assisted
development.

------------------------------------------------------------------------

# Governance

Documentation follows this hierarchy:

Vision

↓

Concepts

↓

Architecture

↓

ADR

↓

Engineering

↓

Implementation

Lower layers may never contradict higher layers.

------------------------------------------------------------------------

# Documentation Lifecycle

Idea

↓

Discussion

↓

ADR

↓

Canonical Document

↓

Implementation

↓

Review

↓

Maintenance

------------------------------------------------------------------------

# Source of Truth

When documentation and code disagree:

Documentation wins.

The implementation must be updated.

------------------------------------------------------------------------

# Ownership

Canonical roster and role definitions: [`docs/governance/ORGANIZATION_MODEL.md`](governance/ORGANIZATION_MODEL.md).
Decision authority (who approves what): [`docs/engineering/claude/12_DECISION_BOUNDARIES.md`](engineering/claude/12_DECISION_BOUNDARIES.md).
AI governance: [`docs/legal/AI_DEVELOPMENT_POLICY.md`](legal/AI_DEVELOPMENT_POLICY.md).

"CTO" is legacy terminology and no longer describes a role in this
project (see `ORGANIZATION_MODEL.md`'s Legacy Terminology note).

Staff Engineer — performs architectural reviews — remains a defined
role pending inclusion in the current organizational model.

------------------------------------------------------------------------

# Canonical Rule

No feature should be implemented unless it can be traced back to:

Vision

↓

Concept

↓

Architecture

↓

ADR

↓

Engineering Package

This guarantees long-term consistency.

------------------------------------------------------------------------

End of Document
