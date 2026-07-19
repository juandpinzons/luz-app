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
3.  architecture/
4.  adr/
5.  engineering/
6.  legal/
7.  sprints/
8.  product/
9.  reviews/

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

Permanent product vision.

Changes are extremely rare.

------------------------------------------------------------------------

## concepts/

Canonical language of LUZ.

Defines Person, Relationship, Life, Context, Intelligence and Trust.

No implementation details belong here.

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

Current organizational model — see [`docs/legal/AI_DEVELOPMENT_POLICY.md`](legal/AI_DEVELOPMENT_POLICY.md).
"CTO" is legacy terminology and no longer describes a role in this
project.

Founder

Defines product direction. Owns architecture and documentation. Final
approval authority.

Lead Engineer (Claude)

Implements Engineering Packages.

AI Engineering Advisor(s)

Support technical analysis and review. Hold no independent approval
authority.

Future Human Engineering Team

Not yet staffed.

Staff Engineer

Performs architectural reviews.

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
