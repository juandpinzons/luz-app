# Document Classification

Every document in `docs/` belongs to exactly one of four categories.
The category determines how the document is allowed to change. This
is the canonical source for that rule — no other document should
redefine it.

------------------------------------------------------------------------

## The Four Categories

### Normative

Defines rules: who has authority, how the organization works, how
documentation itself is governed.

- **Always reflects the current state.** Never historical.
- Examples: `docs/README.md`, `docs/governance/*`, `12_DECISION_BOUNDARIES.md`,
  `AI_DEVELOPMENT_POLICY.md`.
- **Update policy:** edited directly when the organization or rule
  changes. No approval workflow beyond normal Founder review — these
  documents are expected to evolve.

### Architectural

Defines systems: how LUZ is built, what its engines and contracts are.

- Evolves through ADRs (`docs/adr/`), not silent edits.
- Examples: `docs/architecture/*`, ADRs.
- **Update policy:** a document with `Status: Proposed` is not yet
  binding and may be revised freely until accepted. A document with
  `Status: Accepted` requires a new ADR (or an explicit superseding
  decision) to change — never a silent edit.

### Operational

Defines processes: how engineering work actually happens day to day.

- Examples: `docs/engineering/*` (excluding governance-normative files
  already listed above), `docs/engineering/claude/*`.
- **Update policy:** edited directly as process improves — these are
  living documents, but changes should be deliberate, not incidental.

### Historical

Preserves evidence: what was decided, planned, or reported at a
specific point in time.

- Examples: completed ADRs, `docs/sprints/*`, progress/milestone
  reports once the milestone they describe has closed.
- **Update policy:** never rewritten. Two exceptions only:
  1. **Blocked**: a field (commonly a `Status` or `Owner` line)
     references something that no longer exists in a way that makes
     the document impossible to interpret or act on correctly (e.g. a
     status permanently awaiting approval from a role that no longer
     exists). This may be corrected administratively — the correction
     must not touch the engineering decision or reasoning the document
     records, only the blocking field.
  2. **Addendum**: new context can be appended in a clearly separated
     section (dated, marked as added after the original), never mixed
     into the original text.

------------------------------------------------------------------------

## Living vs. Historical

This is the one distinction that matters more than the four labels
above: **Living documentation evolves. Historical documentation
preserves.** Normative, Architectural (while Proposed), and
Operational documents are living. Architectural documents once
Accepted, and all Historical documents, are not — they are the
permanent record of how LUZ actually got here, and rewriting them
would make that record untrustworthy.

------------------------------------------------------------------------

## Applying This

When touching any document, ask in order:

1. Is this document's category Historical, and has whatever it
   describes already concluded (an Accepted ADR, a closed sprint, a
   closed milestone)? → Do not rewrite it. Blocked-field correction or
   an addendum only, per the rules above.
2. Is it Normative? → Update it directly to match current reality.
3. Is it Architectural and still Proposed, or Operational? → Update
   directly, deliberately.

This sequence is what should make future terminology or role
migrations mechanical rather than requiring a fresh judgment call on
every file.
