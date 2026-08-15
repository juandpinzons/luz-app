# LUZ PRIVACY & DATA PROTECTION POLICY

LUZ Privacy & Data Governance Working Draft

Document ID: LUZ-POL-003\
Version: 0.2.0 (Working Draft — Second Pass)\
Status: **Working Draft — Pending Legal Review. Not a legally operative policy. Not published or presented to users.**\
Owner: Founder & Engineering Leadership\
Classification: Internal — Confidential (contains architecture and security detail; requires legal redaction before any public or investor-facing use)\
Audit Basis: LUZ codebase, `/Users/juandavidps/Desktop/AXA/beta1.02/luz`, working tree at commit `5374be7` (main, 2026-08-15), re-verified line-by-line against source for this revision. v0.1.0 was audited against commit `33d367a`. This remains a code-snapshot audit, not a full git-history or infrastructure audit; facts drawn from the live Neon/Vercel/OpenAI dashboards were not directly inspected and remain flagged for verification where relevant.

------------------------------------------------------------------------

## Revision Note — v0.2.0 (Adversarial Audit Pass)

v0.1.0 was reviewed by an independent adversarial audit applying the same source-verification discipline used to build it. The audit's verdict was **PASS WITH MATERIAL CHANGES**: the document's structure (CURRENT / IMPLEMENTED BUT NOT YET PUBLIC / PLANNED / UNKNOWN, `[VERIFY]` tags) held up, but several specific claims in v0.1.0 were re-verified against source and found to be **incomplete or inaccurate**, not merely unconfirmed. Every finding below was independently re-checked against the repository before being incorporated — this is not a transcription of the audit report, several of its findings were confirmed with corrected detail (see the person-record and "Consolidate"-stage notes below), and one (conversation images) had already changed underneath both audits by the time of this revision.

**What changed in this pass:**

1. **§8 (Derived and Inferred Information) was materially incomplete.** It named only Insights, Beliefs, and Concepts. The actual `RealitySnapshot` type sent to the AI provider (`core/reality/reality-snapshot.ts:30-57`) carries eleven distinct derived-data fields, including contradictions, a pending curiosity question, reasoning conclusions, growing/fading beliefs, and narrative-adjacent closure/reopen candidates — all rendered verbatim into AI-facing prompt text. Fixed.
2. **§10 (AI Processing) implied AI-provider calls happen only "when you interact with LUZ."** Fourteen production call sites invoke the AI provider outside any live chat turn — welcome-message generation, the morning brief, conversation titling, life-capture extraction, and a background enrichment pipeline (contradiction detection, curiosity question generation, concept extraction, belief consolidation, reasoning, insight generation). Fixed.
3. **§3's mapping table called `RealitySnapshot.signals` a "(placeholder)" two rows above marking Calendar and Garmin `CURRENT`** — a direct internal contradiction. Verified: `assemble-reality-snapshot.ts:538` populates `signals` with live calendar and wearable data on every chat turn; only document/email sources remain unpopulated. Fixed.
4. **§17 treated Auth.js OAuth-token encryption as an open question.** It is not — `auth/schema.ts:31-52` confirms `refresh_token`, `access_token`, and `id_token` are stored in plain `text()` columns with no cipher call anywhere in that file. This is now a confirmed negative finding, elevated in severity because a leaked OAuth token is a credential (account-takeover risk), not just content exposure. Fixed.
5. **§4 disclosed nothing about third parties.** `find-or-create-person.ts` / `find-or-create-relationship.ts` confirm that mentioning another person (e.g., "my mother") creates a persistent, structured `Person` record scoped to the LifeGraph — a name plus a relationship type — with no consent, no account, and no rights mechanism for that person. (Correction to the original audit finding: the `notes` free-text field these entities support is never populated by this automatic path — it stays `undefined` — so the confirmed captured fields are name and relationship type, not free-text notes.) Fixed.
6. **§15's "cannot restore the data" was unqualified.** `core/db/schema/events.ts` defines `events.userId` with `onDelete: "set null"`, not cascade — sign-in event rows survive account deletion, anonymized rather than removed. Fixed.
7. **§7's memory disclosure omitted a real classifier.** `deterministic-memory-ranking-strategy.ts:81-103` keyword-matches for `vulnerability` and `emotional_turning_point` categories (fear, insecurity, "it's hard for me to admit," turning-point language) to prioritize which memories are retrieved. Fixed, cross-referenced into §20.
8. **Conversation images (§3/§10/§11), reassessed.** At the moment the adversarial audit ran, the image-upload feature existed only as uncommitted working-tree files — genuinely not yet real by this document's own CURRENT definition. Between that audit and this revision, that work was committed and pushed to `main` (`5374be7`, "LUZ actually sees the photo," with an end-to-end verification against the live OpenAI API recorded in the commit message). It is CURRENT again, correctly this time. **This reversal is itself the finding worth keeping**: in a repository where "URGENT, live" features can be committed within the hour, a snapshot audit's shelf life can be shorter than the review cycle around it. See the Lawyer Review Notes (§6) for the process recommendation this implies.

None of the above change the document's core finding that account-level deletion, Gmail's minimal scope, and Kimi's genuine inactivity are honestly disclosed — those held up under adversarial review without correction.

------------------------------------------------------------------------

## How to Read This Document

Two verification tags are used throughout. They are not decoration — each one is a specific, closeable task for a specific team.

- `[LEGAL/PRODUCT ASSUMPTION — VERIFY]` — a statement of policy or business intent (a promise, a commitment, a legal characterization) that Legal or Product must confirm, choose, or formally adopt before this can be treated as final.
- `[TECHNICAL FACT TO VERIFY]` — a statement about how the system behaves that could not be fully confirmed by static code reading alone (e.g., depends on a third-party dashboard, a contractual term, or infrastructure configuration outside this repository) and must be checked against the running system or a vendor agreement.

Every capability described in this draft is additionally labeled with its real status, because a product roadmap is not a product:

| Label | Meaning |
|---|---|
| **CURRENT** | Exists and is reachable by a real user today, verified in code. |
| **IMPLEMENTED BUT NOT YET PUBLIC** | The underlying code exists and is technically functional, but there is no user-facing route (UI, API endpoint) that reaches it — a real user cannot trigger it today. |
| **PLANNED** | Described in architecture decisions (ADRs) or schema as an intended future capability; no working implementation exists yet, or the implementation is a deliberate stub. |
| **UNKNOWN** | Not confirmed one way or the other by this audit. |

This draft does not claim compliance with any law, regulation, or certification (GDPR, CCPA, Colombian Law 1581/2012, SOC 2, ISO 27001, or otherwise). It is a factual and structural foundation for outside counsel to convert into a compliant, jurisdiction-specific policy.

------------------------------------------------------------------------

## 1. Executive Assessment

### What this first policy needs to accomplish

LUZ is not a stateless chatbot wrapped around a single API call. It is a system that deliberately builds a longitudinal model of a person — explicit facts they state, structured knowledge derived from those facts, and a graph of how it all connects — and that model is reassembled and sent to a third-party AI provider on every interaction. A privacy policy modeled on a generic SaaS template would misrepresent this in two directions at once: it would understate what LUZ retains and infers (most SaaS privacy templates aren't built to describe "belief confidence scores" or "memory connections"), and it would overstate what LUZ can currently do for a user who wants control over that data (most templates promise granular deletion and correction rights that, as this audit found, LUZ's product surface does not yet implement).

This first working draft has three goals, in order:

1. **Say only what is true today**, using the CURRENT / IMPLEMENTED BUT NOT YET PUBLIC / PLANNED / UNKNOWN distinction rigorously, so that no clause in the eventual published policy can be contradicted by reading the source code.
2. **Give outside counsel a complete, organized starting point** — architecture mapped to privacy consequence, every open question already surfaced and triaged, so legal review time goes to jurisdictional judgment calls rather than product discovery.
3. **Avoid creating legal exposure through overclaiming.** Several of the most product-friendly-sounding claims a policy like this could make — "you can delete any memory," "we don't retain data with our AI providers," "your health data is specially protected" — are **not yet true** of the current system. This draft states plainly where that is the case instead of writing the aspirational version.

### Method

Following the brief, four internally-differentiated candidate policies were drafted as reasoning tools (not as four full publishable documents — see Section 2), scored against 15 criteria, and the winning elements were combined into the single Consolidated Policy in Section 5. This is a synthesis, not a "pick the prettiest draft" exercise: the Conservative Legal and Technical Truth candidates dominated on raw score and form the backbone, but the User Trust candidate's plain-language framing and the Future-Proof candidate's evolution clause were both grafted in because they won specific criteria the backbone drafts didn't.

### Bottom line

LUZ can honestly make a small number of strong, specific privacy claims today (real hard-delete on account closure; minimal Gmail scope that cannot read message bodies; encrypted-at-rest OAuth credentials for optional connectors). It cannot yet honestly claim several things a user would reasonably expect from a "memory" product (per-item deletion, confirmed AI-provider data-retention terms, differentiated handling of health data). Section 4 and Section 7 exist to close that gap before publication — this document is deliberately not a green light to publish as-is.

------------------------------------------------------------------------

## 2. Tournament Matrix

### The four candidates

Rather than drafting four complete 26-section policies (redundant at this stage, and not what a lawyer needs to see), each candidate was developed as a distinct **editorial position** — a consistent set of choices about tone, hedging, and technical depth — then scored. Representative excerpts illustrate the difference in voice on the two hardest passages to write (memory/forget, AI providers).

**Candidate A — Conservative Legal.** Optimizes for minimal promises and maximum defensibility. Sample voice (memory/forget clause): *"LUZ may retain information you provide for as long as reasonably necessary to operate the Service. LUZ provides mechanisms to delete your Account and associated data as described herein."* Accurate, but tells a user almost nothing about how memory actually works, and is generic enough to have been written for any SaaS product.

**Candidate B — User Trust.** Optimizes for a normal user actually understanding what happens to their words. Sample voice: *"When you tell LUZ something, LUZ decides whether it's the kind of thing worth remembering — a fact, a pattern, a preference — and if so, stores it as a distinct memory you can look back on. You can ask LUZ to forget something, and it will stop using it and stop showing it to you."* Warm and clear — but the second sentence is **false today** (no user-facing forget exists). Left unedited, this candidate creates a real legal liability: a plain-language promise the product cannot keep.

**Candidate C — Technical Truth.** Optimizes for exact correspondence with the code. Sample voice: *"Content you provide may be evaluated by a deterministic classification process and, if it matches a recognized memory type (fact, pattern, ritual, preference, relationship, goal, event, or intention), persisted as a discrete memory record scoped to your LifeGraph, with a status of active, archived, or forgotten."* Precise and defensible, but reads like an engineering spec, not a policy a person or a judge skims in five minutes.

**Candidate D — Future-Proof.** Optimizes for surviving architectural change without a rewrite. Sample voice: *"LUZ's understanding of you may draw on additional data sources and processing methods as the product evolves, including but not limited to calendar, email, and connected device data, in each case consistent with the purposes described in this Policy."* Flexible — but the "including but not limited to" pattern, done carelessly, is exactly the kind of broad, ambiguous authorization the brief warned against. Its future-proofing value is real only when tightly bounded (see Section 5's "Evolution & Scope" clause, which keeps D's flexibility but removes the open-ended authorization).

### Scoring (1–10 per criterion)

| # | Criterion | A · Conservative Legal | B · User Trust | C · Technical Truth | D · Future-Proof | Winner |
|---|---|---|---|---|---|---|
| 1 | Factual accuracy | 7 | 6 | 9 | 6 | **C** |
| 2 | Technical accuracy | 6 | 5 | 10 | 5 | **C** |
| 3 | Privacy transparency | 5 | 9 | 7 | 6 | **B** |
| 4 | Legal usefulness | 9 | 5 | 6 | 7 | **A** |
| 5 | User comprehensibility | 4 | 9 | 5 | 6 | **B** |
| 6 | Data minimization (of promises made) | 7 | 7 | 8 | 5 | **C** |
| 7 | Defensibility | 8 | 5 | 6 | 7 | **A** |
| 8 | Future-proofing | 5 | 5 | 4 | 9 | **D** |
| 9 | Avoidance of overclaiming | 8 | 5 | 8 | 6 | **A / C (tie)** |
| 10 | Consistency with LUZ architecture | 5 | 5 | 10 | 5 | **C** |
| 11 | Clarity around AI providers | 6 | 6 | 9 | 6 | **C** |
| 12 | Clarity around memory and inferred data | 5 | 7 | 9 | 5 | **C** |
| 13 | Clarity around retention/deletion | 6 | 7 | 8 | 6 | **C** |
| 14 | Clarity around third-party processors | 6 | 6 | 9 | 6 | **C** |
| 15 | Jurisdictional adaptability | 8 | 4 | 5 | 9 | **D** |
| | **Total** | **95** | **91** | **113** | **94** | |

### Round 1 → Round 2

Ranking: **C (113) > A (95) > D (94) > B (91)**. B and D are close enough (91 vs. 94) that neither is a clean elimination on total score alone — but per-criterion, B and D each won only 2 of 15 criteria, and both wins are in the same lane (comprehension/transparency for B; future-proofing/jurisdiction for D). C and A together account for 11 of 15 criterion wins and the two highest totals, so they advance as the structural finalists.

**Round 2 — C vs. A.** C wins decisively on everything that makes this policy *this* policy rather than a generic template (architecture consistency, AI-provider clarity, memory/derived-data clarity — the areas the brief calls out as requiring special attention). A wins on the two things a first legal draft cannot skip (legal usefulness, defensibility). Neither alone is publishable: C's register is too technical for a user-facing document; A's is too generic to survive a "where exactly does the product do this" challenge from counsel.

### How the Consolidated Policy actually combines them

The Consolidated Policy in Section 5 uses **C's factual backbone** (every substantive claim about memory, AI providers, and derived data is written to Technical Truth's standard of accuracy) wrapped in **A's legal register and hedging discipline** (modal verbs, defined scope, no unqualified promises). Two elements are grafted in from the eliminated candidates because they won criteria neither finalist did:

- From **B**: a short plain-language summary sentence opens each of the memory-related sections (7, 8, 15), so a lay reader isn't left with only Technical Truth's precise-but-dense register.
- From **D**: Section 25 ("Changes to This Policy") uses D's bounded evolution language — flexible enough to cover new engines and providers without a rewrite, but scoped to "consistent with the categories and purposes already described here" rather than open-ended "including but not limited to" authorization.

This is why Section 5 is not simply "Candidate C" — it is the tournament's actual output.

------------------------------------------------------------------------

## 3. Architecture → Privacy Mapping

Data lifecycle modeled by this audit: **User → Identity (Account/LifeGraph/Person) → Conversation → Memory Engine (capture/connect/rank/archive/forget) → parallel derived-data generation (Knowledge/Belief/Concept/Contradiction/Curiosity/Reasoning Engines, each independently AI-Provider-backed) → RealitySnapshot (context assembly across all of the above) → AI Provider (OpenAI live; Kimi dormant) — reachable both from live chat and from a background enrichment pipeline, not chat-only → Response → Storage (Postgres/Neon) → Retention (currently indefinite) → Deletion (full-account cascade, with one confirmed exception)**. Every stage below maps to at least one Policy section. The v0.1.0 lifecycle line collapsed Contradiction/Curiosity/Reasoning into "Knowledge Engine / Belief Engine / Concept Graph" — corrected here; see the Revision Note above.

| Component | Status | What it actually does | Data involved | Privacy implication | Policy §§ | Source |
|---|---|---|---|---|---|---|
| Identity split (Account / LifeGraph / Person) | CURRENT | Auth.js `Account` resolves to a `LifeGraph` (tenant boundary) containing one or more `Person` members; domain code never sees raw account IDs | email, name, avatar, internal IDs | Clean tenant isolation; but multi-tenancy design (shared LifeGraph) means a future "family" feature would need its own consent model | 4, 17 | ADR-0011 |
| Auth.js (Google Sign-In) | CURRENT | Sole configured OAuth provider; database-backed sessions (server-revocable, not JWT) | email, name, avatar image, OAuth access/refresh/ID tokens, session tokens | **Confirmed, not merely unconfirmed**: `refresh_token`/`access_token`/`id_token` are plain `text()` columns — no `secret-cipher.ts` call anywhere in this file. A leaked row is an exploitable Google-session credential, not just readable content. | 4, 12, 17 | `auth/schema.ts:31-52` (verified: zero cipher calls in file) |
| Third-party (non-user) Person/Relationship records | CURRENT | Mentioning another person in conversation (e.g., "my mother") auto-creates a persistent `Person` record (deduplicated by name) and, where a relationship is described, a `Relationship` record, scoped to the user's LifeGraph | third party's name + relationship type (e.g., "mother," "colleague"); the schema's free-text `notes` field exists but is `undefined`/unpopulated on this automatic path | Personal data about a non-consenting third party, with no account, no notice, and no rights mechanism reaching them | 4 (new) | `core/life/services/find-or-create-person.ts:21-46`; `core/life/services/find-or-create-relationship.ts:30-67` (both confirmed: `notes: undefined` at creation) |
| Memory Engine (capture/connect/archive) | CURRENT | Deterministic keyword classifier (no AI) turns conversation/journal/document content into typed memory records; links related memories | memory content (verbatim text), type, source, timestamps | Memory is rule-based, not AI-judged — a factual detail that changes how "AI decides what to remember" claims should be worded | 7 | `core/memory-engine/classification/deterministic-memory-classifier.ts` |
| Memory "forget" stage | **IMPLEMENTED BUT NOT YET PUBLIC** | Sets a memory's status to `forgotten`; content is never truncated or deleted, only excluded from status-filtered reads | memory content (retained, not erased) | A policy cannot claim users can "forget" a memory today — no route reaches this code | 7, 15 | `core/memory-engine/lifecycle/default-forget-stage.ts:6-31` (zero external callers, verified by grep; confirmed no "consolidate"/edit stage exists in `core/memory-engine/lifecycle/` either, which supports, not weakens, §7's "never silently edited" claim) |
| Memory ranking — vulnerability/emotional-content detection | CURRENT | Keyword classifier tags memories as `vulnerability` (e.g., "I'm afraid of," "it's hard for me to admit") or `emotional_turning_point` ("everything changed when," "I realized that") to boost retrieval priority | classification label attached to memory content | LUZ specifically detects and prioritizes emotionally vulnerable disclosures — not disclosed anywhere in v0.1.0 | 7, 20 (new) | `core/memory-engine/ranking/deterministic-memory-ranking-strategy.ts:80-103` |
| `suppressed` flag on memories | **IMPLEMENTED BUT NOT YET PUBLIC**, developer-only | Hides a memory from all user-facing surfaces; set only by an internal, out-of-git maintenance script, never by user action | memory content (hidden, not deleted) | Must not be described as a user privacy control | 7 | `.scratch/flag-suppressed-memories.ts` (not shipped in app) |
| Knowledge Engine (insights) | CURRENT | Generates typed insights (pattern/preference/fact/risk/recommendation) from a `RealitySnapshot`, with a 0–100 confidence score | derived text, confidence score | Personal data the user never typed; must be disclosed as "derived," not "provided" | 8 | `core/db/schema/knowledge-engine.ts:48-80` |
| Belief Engine (incl. growing/fading beliefs) | CURRENT | Consolidates multiple insights into a `belief` with a confidence score that changes over time; append-only history of confidence changes; a belief still forming (confidence 30–54) or one that just expired/was retracted are both surfaced separately | derived text, confidence score, change history | Same as above; the append-only history means a "belief" can be traced back through its evidence chain | 8 | `core/db/schema/belief-engine.ts:38-164`; `core/reality/reality-snapshot.ts:47-50` (`growingBeliefs`/`fadingBeliefs` fields) |
| Concept Graph | CURRENT | Links concepts (labeled ideas/domains) with directed, strength-scored relationships, evidenced by insights/memories | concept labels, relationship strength | Derived personal data; feeds personalization | 8 | `core/db/schema/concept-graph.ts` |
| Contradiction Engine | CURRENT | Detects a real tension between what the person said and what they still believe or are pursuing; the `contradiction.description` is rendered **verbatim** into AI-facing conversation-strategy text | derived text describing the specific tension | Derived data category entirely absent from v0.1.0 §8; also demonstrates derived text reaching the AI provider as prompt content, not just internal state | 8, 10 (new) | `core/conversation-strategy-engine/rules/challenge-strategy-rule.ts:38-43` (`contradiction.description` interpolated into prompt text) |
| Curiosity Engine | CURRENT | Generates a concrete pending question about the person; `pending.question` is rendered **verbatim** into AI-facing prompt text when a natural opening exists | derived text (a question about the user) | Same category gap as Contradiction Engine | 8, 10 (new) | `core/conversation-strategy-engine/rules/curiosity-strategy-rule.ts:121-127` |
| Reasoning Engine / Knowledge Gaps | CURRENT | Synthesizes validated conclusions across multiple insights (`reasoning`), and separately ranks which life domains LUZ understands least well (`knowledgeGaps`) | derived text, confidence score | Same category gap | 8, 10 (new) | `core/reality/reality-snapshot.ts:37-40` |
| `memory_embeddings` / pgvector | **PLANNED**, schema-only | Vector column exists (1536 dims) and the Postgres `vector` extension is enabled, but embedding generation is not implemented; the one live consumer uses the table for referential bookkeeping only, never search | none generated today | No semantic/vector-based profiling of user content currently occurs — must not be described as current | 8, 12 | `core/db/schema/memory.ts:22,28-30,37-59`; `core/reference-integrity/registry/reference-registry.ts:26,171-175` |
| Dead semantic-search module (`core/memory/`) | Not in use (dead code) | A separate, unused module whose semantic search explicitly throws "not implemented"; never imported by the running app | none | No product or policy relevance beyond confirming (4) above | — | `core/memory/semantic/semantic-memory.repository.ts:31-38` |
| RealitySnapshot | CURRENT | Point-in-time assembly of **eleven** distinct derived/contextual fields — life state, memory, insights, external signals, knowledge gaps, reasoning, curiosity, contradictions, communication-style preference, growing/fading beliefs, reopen candidates, closures, and concepts; rebuilt fresh per request, not a persisted profile file. **Corrected from v0.1.0**: `signals` is not uniformly "(placeholder)" — calendar and wearable sources are populated live on every chat turn; only document and email sources remain empty pending future connectors. | aggregated derived + memory + live calendar/wearable data | This is what's actually sent to the AI provider, not a static "profile," and it is broader than "memory + life + signals" — precise framing matters for accuracy | 7, 8, 10 | ADR-0013 (Accepted); `core/reality/reality-snapshot.ts:30-57` (full field list); `features/chat/services/assemble-reality-snapshot.ts:530-538` (signals population, confirmed calendar+wearable live, document/email empty) |
| AIProvider abstraction | CURRENT | Single interface; OpenAI is the default and only provider actually receiving traffic today | — | Clean separation of "LUZ" from "the AI vendor LUZ currently uses" | 10, 11 | `ai/provider.ts:41-79` |
| OpenAI (chat) | CURRENT | Receives up to 60 recent messages, the assembled RealitySnapshot rendered into system messages, and any attached images (as base64) | conversation text, memory/derived context, images | No confirmed retention or training opt-out configured on LUZ's side — **critical gap** | 10, 11 | `features/chat/services/send-message.ts:31-46`; `ai/providers/openai-provider.ts:41-55` |
| AI provider calls outside live chat | CURRENT | 14 confirmed production call sites invoke the AI provider independently of an active chat turn: welcome-message generation, the morning brief, conversation titling, life-capture extraction (×3), plus a background/enrichment pipeline for contradiction detection, curiosity question generation, concept extraction, belief consolidation, reasoning, and insight generation | conversation/memory/derived content, per the calling engine | §10 in v0.1.0 implied "when you interact with LUZ" is the trigger — it is not the only one; any contractual retention/training terms need to cover batch as well as interactive calls | 10 (new) | Confirmed via repo-wide grep for `getAIProvider(`: `ai-contradiction-detection-strategy.ts:43`, `ai-curiosity-question-generation-strategy.ts:50`, `ai-concept-extraction-strategy.ts:52`, `ai-belief-consolidation-strategy.ts:40`, `ai-reasoning-strategy.ts:51`, `ai-insight-generation-strategy.ts:61`, `generate-welcome.ts:176`, `build-morning-brief.ts:121`, `generate-title.ts:47`, `life-capture-service.ts:134,168,195` |
| Moonshot AI / "Kimi" | **IMPLEMENTED BUT NOT YET PUBLIC** | Registered as a second AIProvider; zero live call sites — nothing routes to it without an explicit, currently-unused code path | none currently | Must be disclosed as reserved/inactive, not as an active subprocessor, until activated — and activation should trigger a policy update | 10, 11, 25 | `ai/index.ts:11,33-46` |
| Conversation images | CURRENT (confirmed committed and merged, commit `5374be7`; migration `0033` applied in the current schema) | User-uploaded images are compressed client-side, sent to OpenAI as a base64 data URI for that turn only, and persisted inline on `conversation_messages.image_data`; server-side validation caps size/type regardless of client behavior | image binary data | Same AI-provider and storage caveats apply to images as to text; no separate blob storage is configured, the image lives in the same plaintext-column posture as the rest of conversation content (see Storage row below) | 6, 10, 12 | `ai/providers/openai-provider.ts:43-55`; migration `0033_conversation_message_images.sql`; commit `5374be7` |
| Gmail integration | CURRENT, opt-in | Real OAuth flow and persistence; scope is `gmail.metadata` only — cannot request message bodies | email metadata only (not content), encrypted OAuth tokens | A genuinely strong minimization claim LUZ can make honestly | 4, 11 | `features/reality/providers/gmail/gmail-client.ts:10-16`; `app/api/gmail/*` |
| Calendar integration | CURRENT, opt-in, **Apple only** | Live client is Apple Calendar via CalDAV (Apple ID + app-specific password); Google/Outlook are schema placeholders with no working client | Apple ID, app-specific password (encrypted), calendar event data | "Calendar integration" must not be described as Google Calendar — a real correction from prior assumptions | 4, 11 | `features/reality/providers/apple/apple-calendar-provider.ts:70`; `core/db/schema/calendar-connections.ts` |
| Garmin (wearable) | CURRENT, opt-in, **manual/human-in-the-loop** | Not a live API integration — user emails an exported file to LUZ, and personnel run an internal script to import it | steps, resting heart rate, sleep stages, stress score | Unusual transfer channel for health-adjacent data; needs explicit disclosure and a real consent step | 4, 20 | `app/garmin/page.tsx:9-14,44`; `.scratch/import-garmin-export.ts`; `core/db/schema/wearable.ts:31-60` |
| Encrypted credential storage | CURRENT | AES-256-GCM encryption for Gmail/Apple Calendar credentials at rest; disconnect actively wipes the secret (not just a status flag) | OAuth/CalDAV secrets only | Strong, narrow claim; does **not** extend to memory/conversation/derived content | 12, 18 | `core/security/secret-cipher.ts:44-53` |
| Bulk of stored content (memories, beliefs, concepts, conversations) | CURRENT | Stored in standard (non-encrypted-at-application-level) Postgres columns | conversation text, memory content, derived text | Cannot claim "encrypted at rest" for the substance of what a user says — only for connector secrets | 12, 18 | Audit item 10 (no encryption config found outside `secret-cipher.ts`) |
| Full account deletion | CURRENT, **with one confirmed exception** | Auth-scoped endpoint; transactional hard delete of the LifeGraph (cascades to memories/beliefs/concepts/connections) and the user record; two-step-confirm UI. **Correction**: `events.userId` uses `onDelete: "set null"`, not cascade — sign-in/operational event rows survive deletion with the identifying `userId` stripped, not removed | all personal data tied to the account, except anonymized operational-event rows | Still the strongest deletion claim LUZ can make, but "cannot restore the data" needs to be scoped — it is accurate for identifiable data, not for the fact that some anonymized rows persist | 15 | `app/api/account/delete/route.ts`; `core/account/delete-account.ts:8-9,27-39`; `components/delete-account-button.tsx:14-60`; `core/db/schema/events.ts:82-84` (`onDelete: "set null"`, confirmed) |
| Sentry error monitoring | CURRENT | Crash/performance monitoring across three runtime configs (server, edge, client); DSN intentionally public (write-only by design); session replay explicitly disabled; no custom PII-scrubbing hook configured in any of the three | error context, stack traces, 10% trace sample | Relies on SDK defaults for what's captured — needs an explicit scrubbing decision before final policy language | 5, 18 | `instrumentation-client.ts:4-11`; `sentry.server.config.ts`; `sentry.edge.config.ts:1-8` (v0.1.0 cited only the first two) |
| Structured logs / `events` table | CURRENT | JSON logs to stdout (captured by hosting log pipeline); operational events (e.g., sign-in) persisted separately | operational metadata | No confirmed retention limit on either | 5, 14 | `core/observability/logger.ts`; `core/observability/record-event.ts:20-47` |
| Neon (Postgres host) | CURRENT | Production database host | all persisted data | Region and backup/PITR terms not confirmed in this repo | 12, 13 | `.env.smoke.example:7-9` |
| Vercel (hosting + cron) | CURRENT | Application hosting, two daily/scheduled cron jobs; currently on the Hobby plan | — | Hobby plan ToS is scoped for personal/non-commercial use while LUZ has real, dependent users — a business/legal risk beyond privacy scope, flagged for completeness | 13 | `vercel.json`; `docs/engineering/BETA_DEVELOPMENT_ROADMAP_V1.md:97-113` |
| No analytics/advertising tooling | CURRENT (absence confirmed) | No PostHog, Google Analytics, or similar found anywhere in dependencies or code | — | Section 22 (Cookies/Analytics) can be short and honest | 22 | Repo-wide grep, zero hits |
| No age-gating | CURRENT (absence confirmed) | No age verification, minimum-age field, or COPPA-style logic anywhere in code | — | Children's Privacy section must disclose this gap, not just assert a minimum age | 19 | Repo-wide grep, zero hits except a target-market doc explicitly disclaiming demographic gating |

------------------------------------------------------------------------

## 4. Unknowns & Legal Verification Queue

Owner tags: **L** = Legal, **P** = Product, **E** = Engineering. Several items need more than one owner; the first listed is primary.

### CRITICAL

1. **(L/E)** No confirmed data-retention or model-training opt-out terms with OpenAI or Moonshot/Kimi. `[LEGAL/PRODUCT ASSUMPTION — VERIFY]` — obtain and document the actual API terms (or a Zero Data Retention agreement, if available at LUZ's account tier) before publishing any claim about how AI providers handle submitted data. **Now confirmed to matter beyond live chat**: 14 production call sites send data to the AI provider outside interactive sessions (item 5 below) — confirm the same terms cover batch/background calls.
2. **(E/L)** Memories, beliefs, concepts, conversation text, and uploaded images are stored in **plaintext** database columns — only third-party connector credentials (Gmail/Apple Calendar) are encrypted at the application level. `[TECHNICAL FACT TO VERIFY]` — confirm whether Neon provides disk-level encryption-at-rest as a compensating control, and decide whether column-level encryption is needed for higher-sensitivity fields (e.g., wearable health metrics).
3. **(P/L)** Garmin health/biometric data is transferred via an unencrypted email attachment to an admin inbox and imported by hand — no formal consent capture or secure-transfer channel. This is special-category data under GDPR Art. 9 with no differentiated safeguard today.
4. **(L)** No confirmed Data Processing Agreements or documented subprocessor terms with OpenAI, Moonshot/Kimi, Google, Apple, Neon, Vercel, or Sentry. `[LEGAL/PRODUCT ASSUMPTION — VERIFY]`
5. **(E) CONFIRMED, not merely open** — the Auth.js `accounts` table (Google OAuth login tokens: `refresh_token`, `access_token`, `id_token`) is stored in **plain, unencrypted `text()` columns** — verified zero `secret-cipher.ts` calls anywhere in `auth/schema.ts`. This is a credential-class exposure (session/account-takeover risk), not just content exposure, and should be weighted at least as high as item 2. `auth/schema.ts:31-52`.
6. **(L/P) NEW** — Structured, persistent records (name + relationship type) are created about people the user mentions in conversation, with no consent, no notice to that person, and no rights mechanism reaching them. `core/life/services/find-or-create-person.ts:21-46`, `find-or-create-relationship.ts:30-67`. This is a distinct data-subject category (third parties, not the account holder) that Section 4 of the policy did not previously acknowledge.
7. **(L/P) NEW** — A deterministic classifier in the memory-ranking pipeline explicitly detects and up-ranks `vulnerability` and `emotional_turning_point` content (fear, insecurity, admissions of difficulty, turning-point language) to prioritize retrieval. `core/memory-engine/ranking/deterministic-memory-ranking-strategy.ts:80-103`. Legal should assess whether this constitutes processing "adjacent to" special-category data (mental/emotional state) under a broad reading of GDPR Art. 9, even though no explicit emotion label is persisted as its own field.
8. **(L/P)** Vercel's Hobby plan is contractually scoped for personal/non-commercial use; LUZ has real users depending on it daily. This is a commercial/ToS risk, not a privacy clause per se, but it affects any uptime/reliability representation this policy or LUZ's terms of service might make.
9. **(E)** Neon database region(s) and Vercel deployment region(s) are not documented anywhere in the repository. Required before Section 13 (International Data Transfers) can say anything specific.
10. **(L)** No minimum-age policy has been chosen. Required before any EU (GDPR "information society services," age varies 13–16 by member state) or US (COPPA, 13) representation can be finalized.

### HIGH

11. **(E)** Sentry has no explicit PII-scrubbing hook (`beforeSend`) or confirmed `sendDefaultPii: false` in any of its three runtime configs (server/edge/client) — relying entirely on SDK defaults for what's captured in error/performance data. `[TECHNICAL FACT TO VERIFY]`
12. **(P/L)** Per-memory "forget" exists in code but has no UI or API route — a real user cannot delete an individual memory today, only the entire account. Any policy language implying otherwise would be false as published.
13. **(P)** The `suppressed` flag is developer-only tooling, not a user control — must not appear in user-facing rights language.
14. **(E)** Neon's backup/PITR window, retention length, and backup encryption are not confirmed in writing. `[TECHNICAL FACT TO VERIFY]`
15. **(L)** No confirmed security certifications (SOC 2, ISO 27001) or independent security review for any subprocessor.
16. **(P/E)** If Moonshot/Kimi is ever activated for live traffic, it becomes a new active subprocessor without any current trigger requiring a policy update first. `[LEGAL/PRODUCT ASSUMPTION — VERIFY]` — recommend a hard rule: no provider activation without a policy review.
17. **(L/E)** No documented incident-response or breach-notification procedure exists.
18. **(L) NEW** — `events.userId` is anonymized (`onDelete: "set null"`) rather than deleted when an account is removed. Confirm whether anonymization satisfies an "erasure" right (e.g., GDPR Art. 17) or whether physical row deletion is required. `core/db/schema/events.ts:82-84`.

### MEDIUM

19. **(E)** The `users.metadata` JSONB field is open-ended/flexible by design — confirm nothing sensitive is being placed there without review.
20. **(E)** Vercel's own log-retention period for structured application logs is not confirmed.
21. **(E/L)** No confirmed retention limit on the `events` table (e.g., sign-in records) or on Knowledge/Belief/Concept derived data.
22. **(E)** Conversation image storage (`conversation_messages.image_data`) has no retention/deletion policy distinct from the rest of conversation content — confirmed as stored, not confirmed as time-bound.
23. **(E) CORRECTED** — `RealitySnapshot.signals` is only *partially* a placeholder: calendar and wearable sources are confirmed live on every chat turn (`assemble-reality-snapshot.ts:538`); document and email sources remain genuinely empty pending future connectors. Confirm this stays accurate as connectors evolve, since it directly determines what Section 10/13 can honestly say is sent to the AI provider.
24. **(L)** GDPR legal basis (contract, consent, legitimate interest) has not been formally chosen per processing activity, nor has an Art. 9 basis for health data (item 3) or vulnerability-classified memories (item 7) been chosen.

### LOW

25. **(L)** LUZ's legal entity name, incorporation jurisdiction, and registered address are not confirmed for Section 1 ("Who We Are"). `[LEGAL/PRODUCT ASSUMPTION — VERIFY]`
26. **(L/P)** No designated privacy contact email or (if required under GDPR) Data Protection Officer has been established.
27. **(P)** Whether LUZ intends to pursue SOC 2/ISO 27001 in the future affects only forward-looking language, not any current-state claim.
28. **(E) NEW** — This repository ships "URGENT, live" features within hours (see the Revision Note's image-upload reversal). Any future audit of this document should re-verify immediately before the document is actually sent to counsel, not rely on a snapshot taken days earlier.

------------------------------------------------------------------------

## 5. Consolidated Privacy Policy — Working Draft

> **Notice:** This is a working draft prepared for legal review. It is not in effect, has not been reviewed by counsel, and must not be published, linked from the product, or shown to users in this form. Bracketed items marked `[VERIFY]` require confirmation, a business decision, or counsel's judgment before this document can be finalized.

------------------------------------------------------------------------

### 1. Who We Are

LUZ ("LUZ," "we," "us") operates a Personal Intelligence System designed to build a longitudinal understanding of the people who use it, through conversation, memory, and context, in order to be present and useful over time. `[LEGAL/PRODUCT ASSUMPTION — VERIFY: legal entity name, form, jurisdiction of incorporation, and registered address are not confirmed by this audit and must be inserted here before publication.]`

### 2. Scope

This Policy applies to the LUZ product — the web application and any account, conversation, memory, and integration data associated with it. It does not apply to third-party websites or services LUZ may link to, nor to LUZ's internal engineering or governance documentation. `[VERIFY: confirm whether any additional surface — e.g., a future mobile app or public API — should be brought into scope before publication.]`

### 3. Information We Collect

LUZ collects information in three ways: information you provide directly (Section 4), information collected automatically as you use the product (Section 5), and information LUZ derives or infers from the above (Section 8). Sections 6–8 explain, in order, the difference between these — a distinction that matters more for LUZ than for most products, because LUZ is designed to remember selectively, not to log everything indiscriminately.

### 4. Information You Provide Directly

- **Account information**, via Google Sign-In: your email address, name, and profile image. *(CURRENT — Google is currently the only sign-in method LUZ offers.)*
- **Conversation content** — anything you type or otherwise communicate to LUZ in chat.
- **Images** you attach to a conversation.
- **Journal entries** and other content you author directly in the product.
- **Life information** you provide — goals, projects, habits, relationships, and similar structured details about your life.
- **Feedback** you submit about the product.
- **Optional integrations**, if you choose to connect them:
  - **Gmail** — via a separate Google OAuth consent, limited to a metadata-only scope that does not permit LUZ to read the content of your messages.
  - **Apple Calendar** — via your Apple ID and an app-specific password, used to read your calendar events.
  - **Wearable device data (currently Garmin)** — `[IMPORTANT — this is not an automated integration today. If you choose to share this data, you do so by sending an exported file, which is imported by LUZ personnel on your behalf. This process, and its privacy implications, are described further in Section 20.]`

**Information about other people.** `[LEGAL/PRODUCT ASSUMPTION — VERIFY — new in this revision]` When you mention another person in conversation — for example, a family member or colleague — LUZ may create a structured, persistent record representing that person within your account, consisting of their name and the type of relationship you described. This happens automatically as part of how LUZ organizes information about your life; the person you mention does not consent to this, is not notified, and has no account or rights channel with LUZ. LUZ does not currently apply any additional safeguard to this category of information beyond the general protections applied to your account data. Legal and Product must decide whether this practice should be limited, disclosed more prominently, or paired with a data-minimization change before publication (see Section 7 of the accompanying action list).

### 5. Information Collected Automatically

- **Authentication session data** — a session identifier used to keep you signed in, which LUZ can revoke server-side.
- **Operational and error-monitoring data** — technical logs and error reports (including a sampled portion of performance traces) collected through our error-monitoring provider. Screen-recording ("session replay") is deliberately disabled.
- **Operational event records** — for example, a record that a sign-in occurred.

LUZ does not currently use analytics, advertising, or cross-site tracking tools or cookies. See Section 22.

### 6. Conversation Data

What you say to LUZ in a conversation is stored so LUZ can respond, maintain context within that conversation, and — where relevant — draw on it later (see Section 7). Conversation data is distinct from memory: not everything you say becomes a standing memory, and Section 7 explains how that distinction actually works.

### 7. Memory and Personalization

*In plain terms: LUZ doesn't treat every message as something it will remember forever. It looks at what you say and decides, using a fixed set of rules, whether it looks like the kind of thing worth keeping as a distinct memory — and if so, stores it as one.*

Formally: content you provide (through conversation, journal entries, documents, or connected integrations) may be evaluated by a rule-based classification process and, where it matches a recognized memory type (fact, pattern, ritual, preference, relationship, goal, event, or intention), stored as a discrete memory record. This classification is deterministic — it is not performed by, or dependent on, the AI models described in Section 10. Memory records can be linked to one another to represent relationships in your history, and each carries a status: active, archived, or `[IMPLEMENTED BUT NOT YET PUBLIC]` a status representing "forgotten," which today has no user-facing control attached to it — see Section 15 for what deletion actually means right now.

Stored memory content is preserved as originally recorded; LUZ does not currently have any process that summarizes, truncates, or edits it over time. `[Forward-looking note — VERIFY before relying on this in future: if a content-editing or "consolidation" capability is ever added to memory processing, this Section must be revisited before that capability is activated, consistent with Section 25.]`

Separately, when deciding which memories are most relevant to retrieve for a given interaction, LUZ's ranking logic recognizes certain kinds of content — including language associated with fear, insecurity, difficulty admitting something, or a described turning point — and gives it retrieval priority, on the premise that this kind of disclosure is often what matters most to understanding you. This is disclosed here, and cross-referenced in Section 20, because it means LUZ specifically identifies and prioritizes emotionally significant content, not just topically relevant content.

To personalize a response, LUZ assembles a fresh, point-in-time snapshot of relevant memories, your current life context, and related derived information (Section 8) for that specific interaction — not a single, static profile document. This snapshot is rebuilt each time and is not guaranteed to remain current beyond the moment it was assembled.

### 8. Derived and Inferred Information

*In plain terms: beyond what you directly say, LUZ's internal systems draw conclusions from patterns across what you've said and done — for example, noticing a preference you never stated outright, a tension between two things you've said, or a question LUZ has been meaning to ask you. LUZ treats these conclusions as probable, not certain, and they can change as more information comes in.*

Formally, LUZ's internal systems generate several kinds of derived information from your stored memories and context. `[Corrected in this revision — the previous version of this Section named only the first three categories below; the full set is what LUZ's context-assembly system actually carries into every interaction.]`

- **Insights** — an interpretation of a memory in light of your broader context (e.g., a pattern, preference, or risk), each with an internal confidence score.
- **Beliefs** — a synthesis across multiple insights into a more durable characterization, also confidence-scored, with a history of how that confidence has changed over time; a belief still forming and a belief that has recently stopped holding are each tracked distinctly.
- **Concepts** — labeled ideas or domains in your life, connected to one another and to the evidence (memories or insights) that supports each connection.
- **Contradictions** — a detected tension between something you said and something you still appear to believe or be pursuing.
- **A pending question** — a specific question LUZ has "in mind" to ask you when a natural opening arises, generated ahead of time rather than improvised in the moment.
- **Reasoning conclusions** — synthesis across multiple insights into a validated higher-order conclusion, and a ranking of which areas of your life LUZ currently understands least well.
- **Communication-style preference, unresolved intentions, and recent closures** — inferred signal about how you prefer to be addressed, an unresolved intention worth revisiting, or a recent completion worth acknowledging.

This derived information is personal data about you, even though you did not type it directly, and LUZ uses it the same way it uses memory: to personalize your experience — and, per Section 10, several of these categories (contradictions, the pending question, reasoning conclusions) are rendered directly into the text sent to the AI provider, not only used internally.

`[PLANNED — NOT CURRENT]` LUZ's data architecture includes a placeholder for representing memory content as numerical vectors ("embeddings") to support meaning-based search, and the underlying database extension needed for this is enabled. As of this Policy's drafting, LUZ does not generate or use embeddings for search or retrieval — no vector-based or "semantic" analysis of your content is currently performed. This Policy will be updated before that capability is activated for real use.

### 9. How We Use Information

LUZ uses the information described above to: provide and operate the product (including generating responses and maintaining memory and context); personalize your experience; communicate with you about your account; maintain the security and integrity of the service; and comply with legal obligations. `[VERIFY: confirm whether any aggregated or de-identified use of data for product-improvement purposes beyond operational debugging is intended — this audit found no analytics pipeline in place today, but Product should confirm no such use is planned without updating this section first.]`

### 10. AI and Machine Learning Processing

LUZ uses third-party AI providers to generate conversational responses and to power several background processes described below. As of this Policy's drafting, OpenAI is LUZ's active AI provider for all live traffic. LUZ has also technically integrated a second provider (Moonshot AI, "Kimi") behind the same internal interface, but `[IMPLEMENTED BUT NOT YET PUBLIC]` no user traffic is currently routed to it — it is reserved for potential future use, and this Policy will be updated before it is activated.

**What is sent.** When LUZ calls its AI provider, the information sent can include: a bounded portion of your recent conversation history (currently capped, not sent in full regardless of conversation length); a context snapshot combining your relevant memories, life state, and the full range of derived information described in Section 8 — which, in addition to insights, beliefs, and concepts, can include a detected contradiction, a pending question LUZ has been meaning to ask you, and reasoning conclusions, each rendered as text directly into what the AI provider receives; calendar and wearable-device signals, when you have connected those integrations (document and email signals are not yet populated by any connector); and any images you attach to a message. `[Corrected in this revision — the previous version of this Section described a narrower payload of "conversation history, memory, and derived context" without naming these specific categories.]`

**When it is sent.** Sending is not limited to moments when you are actively chatting with LUZ. AI-provider calls also occur when LUZ generates a welcome message for you, prepares your morning brief, titles a conversation, extracts structured life information from what you've written, and — on a recurring background schedule, independent of whether you are using the product at that moment — evaluates your data for contradictions, generates candidate curiosity questions, extracts concepts, consolidates beliefs, and produces reasoning conclusions and insights. `[Corrected in this revision — the previous version implied this only happens "when you interact with LUZ."]`

`[LEGAL/PRODUCT ASSUMPTION — VERIFY — CRITICAL]` LUZ has not yet confirmed, in writing or by contract, whether its AI providers retain submitted data beyond what is needed to generate a response, or whether submitted data may be used to train the provider's models — and, separately, whether any such terms apply equally to the background/scheduled calls described above as to interactive ones. Until this is confirmed, users should not assume either zero retention or training exclusion, and this Policy will be updated once verified.

Memory classification (Section 7) is performed by LUZ's own deterministic logic, not by an AI provider — a distinction this Policy states explicitly because it is easy to assume, incorrectly, that an AI model is what decides what LUZ remembers.

`[LEGAL/PRODUCT ASSUMPTION — VERIFY]` LUZ does not use your conversation content to train its own proprietary models; this audit found no such training pipeline, but Product/Engineering should confirm this remains true before publication and flag if it changes.

### 11. Third-Party Service Providers

LUZ uses the following categories of third-party providers to operate the product. `[LEGAL/PRODUCT ASSUMPTION — VERIFY: a full subprocessor list with contractual terms has not yet been compiled; the entries below reflect what this audit could confirm from code, not a completed vendor review.]`

| Provider | Purpose | Status |
|---|---|---|
| OpenAI | Generates conversational responses | CURRENT — primary/active |
| Moonshot AI ("Kimi") | Alternative response generation | IMPLEMENTED BUT NOT YET PUBLIC — no live traffic |
| Google | Sign-in; optional Gmail metadata access | CURRENT |
| Apple | Optional Calendar integration (CalDAV) | CURRENT, opt-in |
| Garmin | Optional wearable data, via manual file transfer | CURRENT, opt-in, manual process (see Section 20) |
| Neon | Database hosting | CURRENT |
| Vercel | Application hosting and scheduled jobs | CURRENT |
| Sentry | Error and performance monitoring | CURRENT |

### 12. Data Storage

LUZ stores data in a PostgreSQL database. The database includes a vector-search-capable extension, which is enabled but — as described in Section 8 — not currently used to store or search embeddings of your content.

Credentials for optional third-party connections (Gmail, Apple Calendar) are encrypted at rest using industry-standard authenticated encryption. `[TECHNICAL FACT TO VERIFY]` Broader encryption-at-rest coverage — for the substance of conversations, memories, and derived data generally, beyond connector credentials — has not been confirmed at the infrastructure level as of this draft. `[LEGAL/PRODUCT ASSUMPTION — VERIFY — confirmed gap, not merely unconfirmed]` The OAuth tokens used to keep you signed in via Google (Section 17) are, as of this draft, **not** encrypted at the application level — a narrower but more consequential gap than the general content-encryption gap above, since a compromised token is a usable credential rather than only readable content.

### 13. International Data Transfers

LUZ's infrastructure and AI providers may process and store information in locations other than your own. `[TECHNICAL FACT TO VERIFY]` The specific data-center region(s) used by LUZ's hosting and database providers have not been confirmed and documented as of this draft. Where a transfer mechanism is legally required (for example, transfers out of the EEA or UK), LUZ will identify and rely on an appropriate one — such as Standard Contractual Clauses — once its vendor and region configuration is finalized. `[Jurisdictional note: this section requires country-specific counsel input — see Section 6 of this document.]`

### 14. Data Retention

*In plain terms: LUZ does not currently delete things on a timer. Content you provide is kept until you delete your account, reflecting the product's purpose of building a long-term understanding of you — but this also means there is currently no automatic expiration.*

`[LEGAL/PRODUCT ASSUMPTION — VERIFY — this is a gap, not a settled policy]` LUZ does not currently define or enforce an explicit retention period for conversation, memory, or derived data; such content is retained by default until the account is deleted (Section 15). Operational logs, error-monitoring data, and third-party processor data are retained according to those providers' own default settings, which have not yet been independently confirmed or configured by LUZ. Legal review should evaluate this default against any applicable minimum- or maximum-retention requirements before publication.

### 15. Data Deletion

*In plain terms: today, you can delete your entire account and everything in it, permanently. You cannot yet delete a single memory or conversation on its own — that capability is planned but not built.*

**Full account deletion.** LUZ provides a direct, user-initiated way to delete your account. Deleting your account permanently deletes your associated data — including memories, derived insights and beliefs, concepts, conversations, and connected-integration records — together with your account and authentication record. This is an irreversible, hard deletion, not a status change: once completed, LUZ cannot restore the deleted data. *(CURRENT.)* `[Corrected in this revision]` One category of internal operational record — a log entry marking that a sign-in occurred — is not deleted by this process; instead, the entry is stripped of the identifier linking it to you and retained in that anonymized form. This does not restore any of your personal data, but it means "all... data" should not be read as an unqualified claim about every database row.

**Deleting individual items.** `[IMPLEMENTED BUT NOT YET PUBLIC — disclose honestly, do not imply otherwise]` LUZ does not currently offer a way to delete or "forget" a single memory, conversation, or piece of derived information without deleting your entire account. The underlying capability is part of LUZ's intended design but is not yet available through the product. See Section 7 (P0 in Section 7 of the accompanying Product/Engineering Actions) for the plan to close this gap.

**Disconnecting an integration.** `[TECHNICAL FACT TO VERIFY]` Disconnecting an optional integration (e.g., Gmail, Calendar) removes the stored access credential for that integration. Whether it also removes memories or derived content already created from that integration's data has not been confirmed and should be tested before this section is finalized.

**Backups.** `[TECHNICAL FACT TO VERIFY]` Whether, and for how long, deleted data may persist in infrastructure-level backups or snapshots has not been confirmed.

### 16. User Privacy Rights

Depending on where you live, you may have rights regarding your personal information, which can include the right to access, correct, delete, restrict or object to processing, and receive a copy of your data, and — where applicable — to withdraw consent or lodge a complaint with a data protection authority. `[LEGAL/PRODUCT ASSUMPTION — VERIFY: this section is deliberately general; final rights language must be adapted per jurisdiction (see Section 6) and paired with an actual intake process — see Unknowns item 26.]` Today, the primary mechanism available to exercise these rights is full account deletion (Section 15); `[VERIFY]` a distinct request channel for access/correction requests short of deletion should be established before publication.

### 17. Account and Authentication Data

LUZ uses Google Sign-In for authentication, with server-side, database-backed sessions that LUZ can revoke directly (rather than long-lived tokens that persist independent of the server). Information stored for this purpose includes your email address, name, profile image, and the OAuth and session tokens needed to keep you signed in. `[LEGAL/PRODUCT ASSUMPTION — VERIFY — CRITICAL, confirmed gap]` These authentication tokens are, as of this draft, stored without application-level encryption — unlike the credentials for optional connectors such as Gmail and Apple Calendar (Section 12), which do use such encryption. Engineering has identified applying the same protection here as a priority action (Section 7 of the accompanying action list); this Policy will be updated once that gap is closed.

### 18. Security

LUZ applies the following measures today: encrypted storage (AES-256-GCM) for optional third-party connector credentials, with disconnection actively erasing the stored secret rather than merely marking it inactive; a deliberately minimal permission scope for Gmail access that cannot read message content; account-scoped API access (for example, account deletion can only be triggered by the authenticated account owner); server-revocable sessions; and error monitoring configured without screen-recording. `[LEGAL/PRODUCT ASSUMPTION — VERIFY]` LUZ does not hold, and does not claim, any independent security certification (such as SOC 2 or ISO 27001) as of this draft. Broader protections — including encryption-at-rest for the substance of stored content, a documented incident-response procedure, and a completed subprocessor security review — are in progress; this Policy will avoid general assurances ("industry-leading security") that are not backed by a specific, verifiable control.

### 19. Children's Privacy

LUZ is intended for adult use and is not directed at children. `[LEGAL/PRODUCT ASSUMPTION — VERIFY — gap, not settled policy]` As of this draft, LUZ does not operate an age-verification mechanism, and this Policy cannot yet state a specific enforced minimum age. Counsel must set the exact minimum-age representation appropriate to each jurisdiction of operation (commonly 13 in the US under COPPA; 13–16 in the EU/UK depending on member state) before any public claim is made, and Product/Engineering should confirm what, if anything, LUZ will do if it becomes aware a child has provided personal information.

### 20. Sensitive / Highly Personal Information

LUZ places no topical restriction on what you can discuss in conversation, and may therefore process sensitive personal topics you choose to share. As described in Section 7, LUZ's memory-retrieval logic specifically recognizes and prioritizes emotionally vulnerable disclosures (for example, expressions of fear, insecurity, or a described turning point) — this is a form of processing sensitive personal content by design, not an incidental byproduct, and is disclosed here for that reason. Separately, if you opt into wearable data sharing, LUZ may process health-adjacent information such as step count, resting heart rate, sleep stages, and stress level.

`[LEGAL/PRODUCT ASSUMPTION — VERIFY — CRITICAL, disclose honestly]` As of this draft, LUZ does not apply differentiated technical safeguards, a distinct consent flow, or special-category legal-basis handling to this kind of information beyond the general protections applied to all account data — and, as described in Section 4, wearable data is currently transferred to LUZ manually rather than through an automated, secured channel. Before this integration is offered more broadly — and particularly before any operation in jurisdictions that regulate special-category data (e.g., GDPR Art. 9) — Legal and Product must determine whether explicit, separate consent and heightened safeguards are required, and Engineering must close the manual-transfer gap described in Section 7 of the accompanying action list.

### 21. Legal Bases for Processing (where applicable)

`[LEGAL/PRODUCT ASSUMPTION — VERIFY]` For jurisdictions that require an enumerated legal basis (e.g., GDPR Article 6), LUZ anticipates relying primarily on the necessity of processing to provide the service you requested (contract), and consent for optional integrations (Gmail, Calendar, wearable data). Where special-category data is involved (Section 20), a distinct Article 9 basis (most likely explicit consent) will be required. Counsel must formally select and document the applicable basis per processing activity before this Policy is finalized for any jurisdiction requiring one.

### 22. Cookies / Analytics

LUZ currently uses only the cookie strictly necessary to maintain your authenticated session. LUZ does not currently use analytics, advertising, or cross-site tracking cookies or software development kits. `[VERIFY: reconfirm at time of publication, since this is an absence-of-evidence finding, not a permanent commitment; if analytics tooling is added, this section must be updated before launch.]`

### 23. Data Sharing / Disclosure

LUZ shares information with the third-party service providers described in Section 11, solely to operate the product on LUZ's behalf. `[LEGAL/PRODUCT ASSUMPTION — VERIFY]` LUZ does not sell personal information. LUZ may also disclose information where required by law, to protect the rights, safety, or property of LUZ or others, or in connection with a business transfer (Section 24).

### 24. Business Transfers

If LUZ is involved in a merger, acquisition, financing, reorganization, or sale of assets, personal information may be transferred as part of that transaction. `[LEGAL/PRODUCT ASSUMPTION — VERIFY]` Any successor will be expected to honor the commitments of this Policy, or you will be notified of any material change, consistent with Section 25.

### 25. Changes to This Policy

LUZ may update this Policy as the product — including its AI, memory, and integration architecture — evolves, consistent with the categories of information and purposes already described here. `[LEGAL/PRODUCT ASSUMPTION — VERIFY: notice mechanism]` Material changes will be communicated before they take effect (mechanism to be confirmed — e.g., in-app notice, email). The date at the top of this document reflects its most recent revision. A new AI provider, a newly activated capability described here as "planned" or "not yet public" (e.g., per-memory deletion, embeddings-based search, a second AI provider), or a new category of connected data source will each trigger a review of this Policy before activation, not after.

### 26. Contact / Privacy Requests

`[LEGAL/PRODUCT ASSUMPTION — VERIFY]` A designated privacy contact (email address, and a Data Protection Officer if required under GDPR) has not yet been established. This section cannot be finalized until one exists.

------------------------------------------------------------------------

## 6. Lawyer Review Notes

Priority order for counsel's attention, most consequential first. Items 1–3 were added or elevated by the v0.2.0 adversarial audit pass; the rest carry over from v0.1.0.

1. **Section 17/12 (Auth.js OAuth tokens) — new, CRITICAL.** Confirmed, not merely suspected: Google sign-in tokens are stored without application-level encryption. This is a credential exposure, not just a content exposure — a leaked row could be used to act as the user's Google session. Recommend treating this with the same urgency as the AI-provider retention question (item 2 below), independent of the broader "content is plaintext" gap already flagged.
2. **Section 10/11 (AI Providers) — scope expanded.** No confirmed retention or training-opt-out terms exist with OpenAI or Moonshot/Kimi, and this now confirmed to matter beyond live chat: 14 production call sites send data to the AI provider on a schedule independent of user activity (welcome messages, morning briefs, titling, life-capture, and a full background enrichment pipeline). Confirm whether any future contractual terms need to explicitly cover batch/background use, not just interactive chat.
3. **Section 4 ("Information about other people") — new.** LUZ creates structured records (name, relationship type) about people the user mentions, with no consent or rights mechanism reaching that third party. This is a distinct data-subject category from anything else in this document and is the kind of fact pattern a data-protection regulator would flag first. Advise whether disclosure alone is sufficient or whether Product should minimize what's captured (see Section 7, item 6).
4. **Section 14 (Retention) and Section 15 (Deletion).** The product currently has no retention ceiling and only account-level (not item-level) deletion, with one further exception: anonymized sign-in event rows survive account deletion rather than being removed. This is the single largest gap between what a "memory" product implies to a reasonable user and what it can currently deliver. Decide whether to (a) publish with the gap disclosed as this draft does, (b) require Engineering to close it first (see Section 7, item 3), or (c) both — disclose now, commit to a date. Separately, confirm whether the anonymize-not-delete pattern for event rows needs to change or is adequately covered by disclosure.
5. **Section 20 (Sensitive Information) and the Garmin flow specifically.** Manually emailing health/biometric data to an admin inbox for hand-import is a genuine outlier in this draft — most privacy risk in this document concentrates here. Advise whether this integration should be gated, paused, or restructured before EU/UK users are onboarded, independent of what the policy says. Also assess, alongside this, whether the memory-ranking classifier that up-ranks fear/insecurity/vulnerability language (Section 7/20) needs its own Art. 9 analysis.
6. **Section 19 (Children).** No enforcement exists; counsel needs to pick the actual minimum-age representation per jurisdiction, and confirm whether a technical gate is required as a condition of that representation (some regulators expect one, not just a policy statement).
7. **Section 13 (International Transfers).** Currently cannot be written with any specificity — hosting/database region is undocumented. Needs Engineering input before counsel can select a transfer mechanism.
8. **Section 1 (Who We Are) and Section 26 (Contact).** Purely administrative gaps (entity name, address, privacy contact) but block publication regardless of substantive readiness.
9. **Vercel Hobby-plan ToS mismatch (flagged in Unknowns, item 8).** Not a privacy clause, but counsel should be aware it may affect representations LUZ makes elsewhere (terms of service, uptime commitments) about infrastructure.
10. **Section 23 ("we do not sell personal information") and Section 24 (Business Transfers).** Standard boilerplate, but each is a forward-looking legal commitment this draft made as a reasonable default — confirm both reflect actual business intent before adoption.
11. **General register check.** Confirm the plain-language sentences opening Sections 7, 8, and 15 don't inadvertently create a stronger commitment than the formal paragraph beneath them — that was exactly the failure mode Candidate B fell into (Section 2) and this draft tried to avoid by keeping the plain-language lines strictly descriptive, not promissory.
12. **Process recommendation, new.** This repository saw a materially relevant feature (image upload) go from uncommitted to committed-and-verified within the span of one audit cycle. Whatever the final review cadence, re-run a fast source-verification pass on this document immediately before it is actually transmitted to outside counsel — not on the date this draft happens to be dated.

------------------------------------------------------------------------

## 7. Product/Engineering Actions

Ordered by the priority tier from Section 4. Items 5–7 are new or reclassified in this revision.

**CRITICAL**

1. Obtain and document actual data-retention and model-training terms with OpenAI and Moonshot/Kimi; enable a zero-data-retention option if available at LUZ's account tier. Confirm these terms (or the lack of them) apply equally to the 14 background/scheduled call sites, not only interactive chat.
2. Decide and implement an encryption-at-rest strategy for memories, beliefs, concepts, conversations, and images (currently plaintext) — at minimum, confirm Neon's disk-level encryption as a compensating control; evaluate column-level encryption for the highest-sensitivity fields (e.g., wearable health metrics).
3. Build a real, user-facing "delete/forget this memory" flow that calls the already-existing (but unwired) forget-stage logic — or make an explicit product decision not to expose it, and update Section 15 accordingly rather than leaving the gap open indefinitely.
4. Replace or gate the manual email + admin-import Garmin flow: at minimum, add a real consent step before import; longer-term, replace it with a secured transfer channel before offering it broadly.
5. **Reclassified from MEDIUM #9 in v0.1.0 — now CRITICAL, confirmed rather than suspected.** Encrypt the Auth.js `accounts` table (Google OAuth login tokens: `refresh_token`, `access_token`, `id_token`) using the existing `secret-cipher.ts` AES-256-GCM pattern already applied to Gmail/Calendar credentials. This is a credential-class exposure, not just a content one — prioritize alongside item 2, arguably ahead of it given the exploitability difference.

**HIGH**

6. **New.** Make a product decision on third-party (non-user) data capture in `find-or-create-person.ts`/`find-or-create-relationship.ts`: keep capturing name + relationship type as-is and rely on policy disclosure, restrict what's auto-captured, or add a lightweight mechanism (even if manual, e.g. an email intake) for a mentioned third party to request removal of their record.
7. **New.** Document, for the legal team, which of the 14 `getAIProvider()` call sites run outside an active user session (see Section 3 mapping table) so Legal can confirm applicable AI-provider contractual terms cover that usage.
8. Add an explicit PII-scrubbing configuration to Sentry (`beforeSend` hook; confirm `sendDefaultPii` is disabled) across all three runtime configs (server/edge/client) and document exactly what error/performance context is captured.
9. Confirm and document Neon and Vercel deployment region(s); evaluate whether region pinning is needed for EU users.
10. Resolve the Vercel Hobby-plan ToS mismatch — upgrade, or obtain written clarification — since real users currently depend on infrastructure licensed for personal/non-commercial use.
11. Establish a documented incident-response and breach-notification procedure.

**MEDIUM**

12. Decide whether `events.userId` should cascade-delete on account removal instead of anonymizing (`onDelete: "set null"`), or formally document anonymization as the intended design — either resolves the Section 15 gap, but it is a product/legal decision, not a default engineering fix.
13. Define a retention schedule (or a documented rationale for indefinite retention) for logs, `events` table rows, and derived Knowledge/Belief/Concept data.
14. Stand up a privacy contact channel (and a DPO, if EU operation requires one) plus a basic data-subject-request intake process, even if manual at first.

**LOW**

15. Treat any future activation of Moonshot/Kimi for live traffic as a mandatory policy-update trigger — do not activate silently.
16. Before any future activation of embeddings-based/semantic memory search, revisit Sections 8 and 10 of this Policy — activating it changes what can honestly be claimed about how memory works.
17. **New.** Given how quickly this repository ships ("URGENT, live" commits within hours), treat any future privacy-document review as needing a same-day re-verification pass immediately before external transmission, not a reliance on a dated snapshot audit.

------------------------------------------------------------------------

*End of working draft. Prepared for legal review; not for publication or user-facing distribution in this form.*
