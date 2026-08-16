# ADR-0024 Content Encryption, Key Separation & Break-Glass Access

Status: Accepted
Date: August 2026
Owner: Founder

## Context

An adversarial privacy audit of `docs/legal/PRIVACY_POLICY_WORKING_DRAFT_V1.md`
(LUZ-POL-003) confirmed, against real code and a real production query
this same session, that LUZ has no technical barrier between a human
and any user's stored content:

- `conversation_messages`, `memory`, `belief`, `insight`, `concept_graph`,
  `contradiction`, `feedback_responses`, and the Auth.js `accounts`
  table (Google OAuth `refresh_token`/`access_token`/`id_token`) are
  all plain, unencrypted Postgres columns. A raw `SELECT` with the
  production `DATABASE_URL` returns everything, in full.
- `app/admin/users/[id]/page.tsx` already renders, for any user id,
  up to 50 memories' verbatim content, all active beliefs, validated
  insights, concepts, open contradictions, and feedback comments — in
  plain text, no redaction. Its own docblock records why it exists:
  *"pedido directo del Founder (2026-08-06): quien pregunte ya no
  debería necesitar interrogar a LUZ en el chat para averiguarlo."*
  Gated only by `isAdmin()` — an `ADMIN_EMAILS` string allowlist, no
  MFA, no logging of who viewed which user or when.
- The only encryption anywhere in the domain is
  `core/security/secret-cipher.ts` (AES-256-GCM via `node:crypto`),
  scoped narrowly to Gmail/Apple Calendar connector credentials — it
  was never extended to the substance of what a user actually says.
- `docs/engineering/SECURITY_POLICY.md` states "least privilege" as a
  principle but has never had a technical mechanism enforcing it: every
  human with the shared database credential, and every `ADMIN_EMAILS`
  account, has had identical, unaudited, full-content access since the
  product's first user.

This ADR is deliberately scoped. It closes the gap between "least
privilege" as a stated principle and as an enforced mechanism, and it
closes LUZ-POL-003's CRITICAL findings #2 (plaintext content) and #5
(plaintext OAuth tokens) in one coordinated build. It does **not**
attempt true end-to-end / zero-knowledge encryption, and should not be
read or described as achieving that. Two things already true of LUZ's
architecture make zero-knowledge encryption structurally incompatible
with the product as it exists: every message is sent to OpenAI in
plaintext to generate a response, and Memory/Knowledge/Belief/Concept/
Contradiction/Curiosity Engines all read plaintext server-side to build
the derived understanding of a person that is the product's core
value. Encrypting storage does not change either of those. What this
ADR delivers is: **no undetected, unaudited, casual human access** —
not **no human or AI ever processes plaintext**. Conflating the two in
any future user-facing claim would repeat exactly the overclaiming
failure mode LUZ-POL-003 was built to avoid.

## Decision

### 1. Column-level encryption, extending the existing `secret-cipher.ts` pattern

A new module (e.g. `core/security/content-cipher.ts`), same AES-256-GCM
/ `iv:authTag:ciphertext` (base64, colon-packed) shape already proven
in `secret-cipher.ts`, parameterized by a **new, separate** key (see
Decision 2). Applied to:

- `conversation_messages.content`, `conversation_messages.image_data`
- `memory.content`
- `belief.statement`
- `insight.description`
- `concept_graph` labels
- `contradiction.description`
- reasoning-conclusion statement text (`core/knowledge-engine`)
- `feedback_responses.comment`
- Auth.js `accounts.refresh_token` / `access_token` / `id_token`
  (closes LUZ-POL-003 CRITICAL #5 in this same pass, using the same
  primitive already applied to Gmail/Calendar credentials)
- Third-party `Person`/`Relationship` free-text fields, defensively,
  even though confirmed currently unpopulated (`notes: undefined` at
  both call sites per the prior audit) — the column allows it, so it
  is encrypted the moment anything is ever written there.

Decryption happens only inside the repository layer, immediately
before use — the same discipline `secret-cipher.ts` already follows:
`core/life`, `features/`, and every engine above the repository
continue to see plain domain objects, never ciphertext, never a key.

Explicitly out of scope for this pass: `memory_embeddings`/pgvector.
Confirmed unused (zero generation anywhere in the codebase, multiple
audits this session) — nothing to encrypt yet. Revisit under Future
if embeddings are ever activated.

### 2. Key separation from database access

A dedicated `CONTENT_ENCRYPTION_KEY`, distinct from
`CALENDAR_CREDENTIALS_ENCRYPTION_KEY` — a compromise of one must not
compromise the other. Phase 1 (this build): the key lives only in the
deployed application's production runtime environment (Vercel,
`Sensitive`-flagged), never in any `.env`/`.env.local` file, never
passed to a script run outside the deployed app. A human holding only
`DATABASE_URL` — including the exact scenario from this session, a raw
connection string pasted into a chat — gets ciphertext, full stop.
Local development uses a separately-generated, non-production key
(`openssl rand -base64 32`, same instruction already documented for
the existing key), so a leaked local `.env` is never a path to
decrypting real user content — consistent with this session's finding
that local `.env` already points at a near-empty dev database, not
production.

### 3. Break-glass admin access

`/admin/users/[id]`, and any future admin surface reading decrypted
user content, requires:

- A justification field submitted before decrypted content renders —
  no justification, no view.
- An immutable audit row per access, new table `admin_access_log`
  (`adminUserId`, `viewedUserId`, `justification`, `accessedAt`,
  `route`) — modeled on the existing `events`/`record-event.ts`
  pattern but append-only, and explicitly **excluded** from any
  account-deletion cascade: an admin's access history is not the
  viewed user's personal data to erase on their request.
- `isAdmin()` upgraded from a bare email allowlist to allowlist + MFA.

Left open, not decided by this ADR: whether an accessed user is
ever notified or can review their own `admin_access_log` entries —
a Product/Legal call, not an engineering default.

### 4. Separate, least-privilege database role

A second Postgres role (Neon supports additional roles) with SELECT
only on non-content columns (ids, timestamps, counts, categories,
status fields) and explicit `REVOKE` on every column named in
Decision 1 — a structural second layer independent of ciphertext
being unreadable. This role becomes the one used for ad hoc ops/
debugging queries — exactly the situation earlier this session. The
application's own connection (`core/db/client.ts`) remains the only
credential with both full read/write and the decryption key;
`neondb_owner`-level access becomes break-glass itself, not a
daily-use credential for anyone, including engineering.

## Consequences

### Positive

- Closes LUZ-POL-003 CRITICAL #2 and #5 together, using one proven
  primitive instead of two separate ad hoc patches.
- Repeating this session's exact scenario — a shared connection string
  in the wrong place — yields ciphertext, not a user's memories.
- Every human view of another person's content becomes attributable
  and reviewable, closing the specific gap the "100% private, no human
  can break it" conversation surfaced.
- No new encryption library or pattern to vet — `secret-cipher.ts` is
  already a known, working, minimal-dependency precedent.

### Trade-offs

- Every read path touching an encrypted column needs updating across
  Memory/Belief/Insight/Concept/Contradiction/Reasoning/Feedback
  repositories and conversation persistence — a real, multi-file
  migration, not a one-file change.
- Decryption on every read adds latency to high-volume paths (chat
  history, `RealitySnapshot` assembly) that `secret-cipher.ts`'s
  current narrow use never had to absorb — needs real measurement
  before rollout, not assumed free.
- Encrypted columns cannot be searched or filtered at the SQL level
  (`LIKE`, full-text search) — any future feature needing server-side
  text search over this content must be designed around that from the
  start, not discovered after the fact.
- Break-glass friction is deliberate and will slow down the exact
  "quickly see what LUZ knows about this person" workflow the admin
  page was built for on 2026-08-06 — an accepted cost, not an
  oversight.
- Does **not** achieve end-to-end/zero-knowledge encryption — see
  Context. Any future policy or marketing language must not describe
  this ADR as delivering that.

### Future

- Migrate `CONTENT_ENCRYPTION_KEY` from a plain environment variable to
  a managed KMS once operational maturity justifies the added
  complexity — env var is this ADR's pragmatic Phase 1, not the end
  state.
- Decide explicitly, if `memory_embeddings` is ever activated, whether
  embedding generation reads decrypted content (likely required) and
  whether the embedding vectors themselves need protection — not
  decided here.
- AI-provider data-retention terms (LUZ-POL-003 CRITICAL #1) remain a
  related, distinct, unclosed gap — encrypting storage does not change
  what OpenAI receives per message.
- Whether to notify or grant self-review of `admin_access_log` entries
  to the affected user (Decision 3) — open Product/Legal question.

## Related

- `core/security/secret-cipher.ts` — the precedent pattern this ADR extends.
- `docs/legal/PRIVACY_POLICY_WORKING_DRAFT_V1.md` (LUZ-POL-003) —
  CRITICAL items #2 and #5; Product/Engineering Actions items #2 and #5.
- `app/admin/users/[id]/page.tsx`, `app/admin/is-admin.ts` — the
  concrete surface Decision 3 modifies.
- `core/db/client.ts` — the single existing global connection; Decision
  4 introduces the second, restricted role alongside it.
- `docs/engineering/SECURITY_POLICY.md` — three lines today; this ADR
  is the first architecture giving "least privilege" real technical
  enforcement.
