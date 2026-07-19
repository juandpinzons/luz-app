# Change Control Policy

How a change to documentation is proposed, approved, and applied.
Code review, commit conventions, and branching are governed elsewhere
(`docs/engineering/GIT_WORKFLOW.md`, `COMMIT_CONVENTION.md`,
`DEFINITION_OF_DONE.md`) — this document does not repeat them. It
covers what those do not: how *documentation itself*, especially
Normative and Historical documents, is allowed to change.

------------------------------------------------------------------------

## Approval Authority

Who can approve what is defined once, in `12_DECISION_BOUNDARIES.md` —
this document does not restate that list. In general: the Founder
approves; the Lead Engineer (Claude) and AI Engineering Advisor(s)
implement, propose, and flag, but do not self-approve consequential
changes.

## Workflow

1. **Classify** the document per `DOCUMENT_CLASSIFICATION.md` before
   touching it. This determines whether the change is direct,
   administrative, or forbidden.
2. **Normative and Operational documents**: propose the change,
   implement it, get Founder review before or after depending on
   urgency — these are living documents, low ceremony.
3. **Architectural documents (Proposed)**: same as above, but changes
   should be checked against the ADR they will eventually become.
4. **Architectural documents (Accepted) and Historical documents**:
   never edit directly. If something is factually wrong or blocking
   (see `DOCUMENT_CLASSIFICATION.md`'s Historical exceptions):
   - Identify the conflict explicitly — do not silently resolve it.
   - Produce a migration report: every file affected, the proposed
     replacement, and which files will be left untouched and why.
   - Wait for explicit Founder approval before applying.
   - Apply only the approved subset; report what was done and what
     was intentionally preserved.
5. **New governance documents** (anything under `docs/governance/` or
   `docs/legal/`, or a new top-level `docs/` category): requires
   Founder approval before creation — this is the same rule
   `05_FOLDER_STRUCTURE.md` already states for top-level folders in
   general, restated here because governance documents carry more
   weight than an ordinary file.

## Evidence Requirement

A migration report or change proposal must cite the actual occurrences
found (file and line), not a summary or estimate. This mirrors the
project's standing verification standard (real data over assumption)
applied to documentation instead of code.

## Single Source of Truth

Before adding information to any document, check whether it already
has a canonical home per the ownership map in `DOCUMENT_CLASSIFICATION.md`
and `ORGANIZATION_MODEL.md`. If it does, reference it — do not restate
it. A governance system with the same fact in two places is already
out of sync; it just hasn't been noticed yet.
