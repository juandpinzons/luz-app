# BRANCHING STRATEGY

Version: 1.0

## Permanent Branches

main
- Production-ready code only.

develop
- Integration branch.

## Feature Branches

Naming:

feature/<scope>

Examples:

feature/sprint-7-identity-layer
feature/memory-engine
feature/knowledge-engine

## Hotfix Branches

hotfix/<name>

## Rules

- Never develop on main.
- Every feature starts from develop.
- Every feature is merged through a Pull Request.
- main is updated only after CTO approval.
