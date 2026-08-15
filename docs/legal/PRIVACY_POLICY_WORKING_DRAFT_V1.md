# LUZ PRIVACY & DATA PROTECTION POLICY

LUZ Privacy & Data Governance Working Draft

Document ID: LUZ-POL-003\
Version: 0.1.0 (Working Draft)\
Status: **Working Draft — Pending Legal Review. Not a legally operative policy. Not published or presented to users.**\
Owner: Founder & Engineering Leadership\
Classification: Internal — Confidential (contains architecture and security detail; requires legal redaction before any public or investor-facing use)\
Audit Basis: LUZ codebase snapshot, `/Users/juandavidps/Desktop/AXA/beta1.02/luz`, commit `33d367a`, 2026-08-14. This is a code-snapshot audit, not a full git-history or infrastructure audit. Facts drawn from the live Neon/Vercel/OpenAI dashboards were not directly inspected and remain flagged for verification where relevant.

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

Data lifecycle modeled by this audit: **User → Identity (Account/LifeGraph/Person) → Conversation → Memory Engine (capture/connect/archive/forget) → Knowledge Engine / Belief Engine / Concept Graph (derived insights, beliefs, concepts) → RealitySnapshot (context assembly) → AI Provider (OpenAI/Kimi) → Response → Storage (Postgres/Neon) → Retention (currently indefinite) → Deletion (full-account only)**. Every stage below maps to at least one Policy section.

| Component | Status | What it actually does | Data involved | Privacy implication | Policy §§ | Source |
|---|---|---|---|---|---|---|
| Identity split (Account / LifeGraph / Person) | CURRENT | Auth.js `Account` resolves to a `LifeGraph` (tenant boundary) containing one or more `Person` members; domain code never sees raw account IDs | email, name, avatar, internal IDs | Clean tenant isolation; but multi-tenancy design (shared LifeGraph) means a future "family" feature would need its own consent model | 4, 17 | ADR-0011 |
| Auth.js (Google Sign-In) | CURRENT | Sole configured OAuth provider; database-backed sessions (server-revocable, not JWT) | email, name, avatar image, OAuth access/refresh/ID tokens, session tokens | Standard SSO login; token table encryption status unconfirmed | 4, 17 | `auth/config.ts:18-54`, `auth/providers/index.ts:1,18` |
| Memory Engine (capture/connect/archive) | CURRENT | Deterministic keyword classifier (no AI) turns conversation/journal/document content into typed memory records; links related memories | memory content (verbatim text), type, source, timestamps | Memory is rule-based, not AI-judged — a factual detail that changes how "AI decides what to remember" claims should be worded | 7 | `core/memory-engine/classification/deterministic-memory-classifier.ts` |
| Memory "forget" stage | **IMPLEMENTED BUT NOT YET PUBLIC** | Sets a memory's status to `forgotten`; content is never truncated or deleted, only excluded from status-filtered reads | memory content (retained, not erased) | A policy cannot claim users can "forget" a memory today — no route reaches this code | 7, 15 | `core/memory-engine/lifecycle/default-forget-stage.ts:6-31` (zero external callers, verified by grep) |
| `suppressed` flag on memories | **IMPLEMENTED BUT NOT YET PUBLIC**, developer-only | Hides a memory from all user-facing surfaces; set only by an internal, out-of-git maintenance script, never by user action | memory content (hidden, not deleted) | Must not be described as a user privacy control | 7 | `.scratch/flag-suppressed-memories.ts` (not shipped in app) |
| Knowledge Engine (insights) | CURRENT | Generates typed insights (pattern/preference/fact/risk/recommendation) from a `RealitySnapshot`, with a 0–100 confidence score | derived text, confidence score | Personal data the user never typed; must be disclosed as "derived," not "provided" | 8 | `core/db/schema/knowledge-engine.ts:48-80` |
| Belief Engine | CURRENT | Consolidates multiple insights into a `belief` with a confidence score that changes over time; append-only history of confidence changes | derived text, confidence score, change history | Same as above; the append-only history means a "belief" can be traced back through its evidence chain | 8 | `core/db/schema/belief-engine.ts:38-164` |
| Concept Graph | CURRENT | Links concepts (labeled ideas/domains) with directed, strength-scored relationships, evidenced by insights/memories | concept labels, relationship strength | Derived personal data; feeds personalization | 8 | `core/db/schema/concept-graph.ts` |
| `memory_embeddings` / pgvector | **PLANNED**, schema-only | Vector column exists (1536 dims) and the Postgres `vector` extension is enabled, but embedding generation is not implemented; the one live consumer uses the table for referential bookkeeping only, never search | none generated today | No semantic/vector-based profiling of user content currently occurs — must not be described as current | 8, 12 | `core/db/schema/memory.ts:22,28-30,37-59`; `core/reference-integrity/registry/reference-registry.ts:26,171-175` |
| Dead semantic-search module (`core/memory/`) | Not in use (dead code) | A separate, unused module whose semantic search explicitly throws "not implemented"; never imported by the running app | none | No product or policy relevance beyond confirming (4) above | — | `core/memory/semantic/semantic-memory.repository.ts:31-38` |
| RealitySnapshot | CURRENT | Point-in-time assembly of Life Graph state, memory context, insights, beliefs, concepts, and (placeholder) external signals; rebuilt fresh per request, not a persisted profile file | aggregated derived + memory data | This is what's actually sent to the AI provider, not a static "profile" — precise framing matters for accuracy | 7, 8, 10 | ADR-0013 (Accepted); `core/reality/reality-snapshot.ts:30-57` |
| AIProvider abstraction | CURRENT | Single interface; OpenAI is the default and only provider actually receiving traffic today | — | Clean separation of "LUZ" from "the AI vendor LUZ currently uses" | 10, 11 | `ai/provider.ts:41-79` |
| OpenAI (chat) | CURRENT | Receives up to 60 recent messages, the assembled RealitySnapshot rendered into system messages, and any attached images (as base64) | conversation text, memory/derived context, images | No confirmed retention or training opt-out configured on LUZ's side — **critical gap** | 10, 11 | `features/chat/services/send-message.ts:31-46`; `ai/providers/openai-provider.ts:41-55` |
| Moonshot AI / "Kimi" | **IMPLEMENTED BUT NOT YET PUBLIC** | Registered as a second AIProvider; zero live call sites — nothing routes to it without an explicit, currently-unused code path | none currently | Must be disclosed as reserved/inactive, not as an active subprocessor, until activated — and activation should trigger a policy update | 10, 11, 25 | `ai/index.ts:11,33-46` |
| Conversation images | CURRENT | User-uploaded images are sent to OpenAI as base64 and persisted in the database | image binary data | Same AI-provider and storage caveats apply to images as to text | 6, 10, 12 | `ai/providers/openai-provider.ts:43-55`; migration `0033_conversation_message_images.sql` |
| Gmail integration | CURRENT, opt-in | Real OAuth flow and persistence; scope is `gmail.metadata` only — cannot request message bodies | email metadata only (not content), encrypted OAuth tokens | A genuinely strong minimization claim LUZ can make honestly | 4, 11 | `features/reality/providers/gmail/gmail-client.ts:10-16`; `app/api/gmail/*` |
| Calendar integration | CURRENT, opt-in, **Apple only** | Live client is Apple Calendar via CalDAV (Apple ID + app-specific password); Google/Outlook are schema placeholders with no working client | Apple ID, app-specific password (encrypted), calendar event data | "Calendar integration" must not be described as Google Calendar — a real correction from prior assumptions | 4, 11 | `features/reality/providers/apple/apple-calendar-provider.ts:70`; `core/db/schema/calendar-connections.ts` |
| Garmin (wearable) | CURRENT, opt-in, **manual/human-in-the-loop** | Not a live API integration — user emails an exported file to LUZ, and personnel run an internal script to import it | steps, resting heart rate, sleep stages, stress score | Unusual transfer channel for health-adjacent data; needs explicit disclosure and a real consent step | 4, 20 | `app/garmin/page.tsx:9-14,44`; `.scratch/import-garmin-export.ts`; `core/db/schema/wearable.ts:31-60` |
| Encrypted credential storage | CURRENT | AES-256-GCM encryption for Gmail/Apple Calendar credentials at rest; disconnect actively wipes the secret (not just a status flag) | OAuth/CalDAV secrets only | Strong, narrow claim; does **not** extend to memory/conversation/derived content | 12, 18 | `core/security/secret-cipher.ts:44-53` |
| Bulk of stored content (memories, beliefs, concepts, conversations) | CURRENT | Stored in standard (non-encrypted-at-application-level) Postgres columns | conversation text, memory content, derived text | Cannot claim "encrypted at rest" for the substance of what a user says — only for connector secrets | 12, 18 | Audit item 10 (no encryption config found outside `secret-cipher.ts`) |
| Full account deletion | CURRENT | Auth-scoped endpoint; transactional hard delete of the LifeGraph (cascades to memories/beliefs/concepts/connections) and the user record; two-step-confirm UI | all personal data tied to the account | The strongest, most defensible deletion claim LUZ can make today | 15 | `app/api/account/delete/route.ts`; `core/account/delete-account.ts:8-9,27-39`; `components/delete-account-button.tsx:14-60` |
| Sentry error monitoring | CURRENT | Crash/performance monitoring; DSN intentionally public (write-only by design); session replay explicitly disabled; no custom PII-scrubbing hook configured | error context, stack traces, 10% trace sample | Relies on SDK defaults for what's captured — needs an explicit scrubbing decision before final policy language | 5, 18 | `instrumentation-client.ts:4-11`; `sentry.server.config.ts` |
| Structured logs / `events` table | CURRENT | JSON logs to stdout (captured by hosting log pipeline); operational events (e.g., sign-in) persisted separately | operational metadata | No confirmed retention limit on either | 5, 14 | `core/observability/logger.ts`; `core/observability/record-event.ts:20-47` |
| Neon (Postgres host) | CURRENT | Production database host | all persisted data | Region and backup/PITR terms not confirmed in this repo | 12, 13 | `.env.smoke.example:7-9` |
| Vercel (hosting + cron) | CURRENT | Application hosting, two daily/scheduled cron jobs; currently on the Hobby plan | — | Hobby plan ToS is scoped for personal/non-commercial use while LUZ has real, dependent users — a business/legal risk beyond privacy scope, flagged for completeness | 13 | `vercel.json`; `docs/engineering/BETA_DEVELOPMENT_ROADMAP_V1.md:97-113` |
| No analytics/advertising tooling | CURRENT (absence confirmed) | No PostHog, Google Analytics, or similar found anywhere in dependencies or code | — | Section 22 (Cookies/Analytics) can be short and honest | 22 | Repo-wide grep, zero hits |
| No age-gating | CURRENT (absence confirmed) | No age verification, minimum-age field, or COPPA-style logic anywhere in code | — | Children's Privacy section must disclose this gap, not just assert a minimum age | 19 | Repo-wide grep, zero hits except a target-market doc explicitly disclaiming demographic gating |

------------------------------------------------------------------------

## 4. Unknowns & Legal Verification Queue

Owner tags: **L** = Legal, **P** = Product, **E** = Engineering. Several items need more than one owner; the first listed is primary.

### CRITICAL

1. **(L/E)** No confirmed data-retention or model-training opt-out terms with OpenAI or Moonshot/Kimi. `[LEGAL/PRODUCT ASSUMPTION — VERIFY]` — obtain and document the actual API terms (or a Zero Data Retention agreement, if available at LUZ's account tier) before publishing any claim about how AI providers handle submitted data.
2. **(E/L)** Memories, beliefs, concepts, conversation text, and uploaded images are stored in **plaintext** database columns — only third-party connector credentials (Gmail/Apple Calendar) are encrypted at the application level. `[TECHNICAL FACT TO VERIFY]` — confirm whether Neon provides disk-level encryption-at-rest as a compensating control, and decide whether column-level encryption is needed for higher-sensitivity fields (e.g., wearable health metrics).
3. **(P/L)** Garmin health/biometric data is transferred via an unencrypted email attachment to an admin inbox and imported by hand — no formal consent capture or secure-transfer channel. This is special-category data under GDPR Art. 9 with no differentiated safeguard today.
4. **(L)** No confirmed Data Processing Agreements or documented subprocessor terms with OpenAI, Moonshot/Kimi, Google, Apple, Neon, Vercel, or Sentry. `[LEGAL/PRODUCT ASSUMPTION — VERIFY]`
5. **(E)** Encryption status of the Auth.js `accounts` table (Google OAuth login tokens) was not confirmed either way by this audit — only the separate Gmail/Calendar connector tables were confirmed to use `secret-cipher.ts`. `[TECHNICAL FACT TO VERIFY]`
6. **(L/P)** Vercel's Hobby plan is contractually scoped for personal/non-commercial use; LUZ has real users depending on it daily. This is a commercial/ToS risk, not a privacy clause per se, but it affects any uptime/reliability representation this policy or LUZ's terms of service might make.
7. **(E)** Neon database region(s) and Vercel deployment region(s) are not documented anywhere in the repository. Required before Section 13 (International Data Transfers) can say anything specific.
8. **(L)** No minimum-age policy has been chosen. Required before any EU (GDPR "information society services," age varies 13–16 by member state) or US (COPPA, 13) representation can be finalized.

### HIGH

9. **(E)** Sentry has no explicit PII-scrubbing hook (`beforeSend`) or confirmed `sendDefaultPii: false` — relying entirely on SDK defaults for what's captured in error/performance data. `[TECHNICAL FACT TO VERIFY]`
10. **(P/L)** Per-memory "forget" exists in code but has no UI or API route — a real user cannot delete an individual memory today, only the entire account. Any policy language implying otherwise would be false as published.
11. **(P)** The `suppressed` flag is developer-only tooling, not a user control — must not appear in user-facing rights language.
12. **(E)** Neon's backup/PITR window, retention length, and backup encryption are not confirmed in writing. `[TECHNICAL FACT TO VERIFY]`
13. **(L)** No confirmed security certifications (SOC 2, ISO 27001) or independent security review for any subprocessor.
14. **(P/E)** If Moonshot/Kimi is ever activated for live traffic, it becomes a new active subprocessor without any current trigger requiring a policy update first. `[LEGAL/PRODUCT ASSUMPTION — VERIFY]` — recommend a hard rule: no provider activation without a policy review.
15. **(L/E)** No documented incident-response or breach-notification procedure exists.

### MEDIUM

16. **(E)** The `users.metadata` JSONB field is open-ended/flexible by design — confirm nothing sensitive is being placed there without review.
17. **(E)** Vercel's own log-retention period for structured application logs is not confirmed.
18. **(E/L)** No confirmed retention limit on the `events` table (e.g., sign-in records) or on Knowledge/Belief/Concept derived data.
19. **(E)** Conversation image storage (`conversation_messages.image_data`) has no retention/deletion policy distinct from the rest of conversation content — confirmed as stored, not confirmed as time-bound.
20. **(E)** `RealitySnapshot.signals` is a placeholder for future calendar/document/email/sensor signal ingestion beyond what's live today — confirm exactly what currently feeds into AI prompts before finalizing Section 10/11 language, since this expands as connectors go live.
21. **(L)** GDPR legal basis (contract, consent, legitimate interest) has not been formally chosen per processing activity, nor has an Art. 9 basis for health data been chosen.

### LOW

22. **(L)** LUZ's legal entity name, incorporation jurisdiction, and registered address are not confirmed for Section 1 ("Who We Are"). `[LEGAL/PRODUCT ASSUMPTION — VERIFY]`
23. **(L/P)** No designated privacy contact email or (if required under GDPR) Data Protection Officer has been established.
24. **(P)** Whether LUZ intends to pursue SOC 2/ISO 27001 in the future affects only forward-looking language, not any current-state claim.

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

Stored memory content is preserved as originally recorded; LUZ does not silently summarize, truncate, or edit it over time.

To personalize a response, LUZ assembles a fresh, point-in-time snapshot of relevant memories, your current life context, and related derived information (Section 8) for that specific interaction — not a single, static profile document. This snapshot is rebuilt each time and is not guaranteed to remain current beyond the moment it was assembled.

### 8. Derived and Inferred Information

*In plain terms: beyond what you directly say, LUZ's internal systems draw conclusions from patterns across what you've said and done — for example, noticing a preference you never stated outright. LUZ treats these conclusions as probable, not certain, and they can change as more information comes in.*

Formally, LUZ's internal systems generate several kinds of derived information from your stored memories and context:

- **Insights** — an interpretation of a memory in light of your broader context (e.g., a pattern, preference, or risk), each with an internal confidence score.
- **Beliefs** — a synthesis across multiple insights into a more durable characterization, also confidence-scored, with a history of how that confidence has changed over time.
- **Concepts** — labeled ideas or domains in your life, connected to one another and to the evidence (memories or insights) that supports each connection.

This derived information is personal data about you, even though you did not type it directly, and LUZ uses it the same way it uses memory: to personalize your experience.

`[PLANNED — NOT CURRENT]` LUZ's data architecture includes a placeholder for representing memory content as numerical vectors ("embeddings") to support meaning-based search, and the underlying database extension needed for this is enabled. As of this Policy's drafting, LUZ does not generate or use embeddings for search or retrieval — no vector-based or "semantic" analysis of your content is currently performed. This Policy will be updated before that capability is activated for real use.

### 9. How We Use Information

LUZ uses the information described above to: provide and operate the product (including generating responses and maintaining memory and context); personalize your experience; communicate with you about your account; maintain the security and integrity of the service; and comply with legal obligations. `[VERIFY: confirm whether any aggregated or de-identified use of data for product-improvement purposes beyond operational debugging is intended — this audit found no analytics pipeline in place today, but Product should confirm no such use is planned without updating this section first.]`

### 10. AI and Machine Learning Processing

LUZ uses third-party AI providers to generate conversational responses. As of this Policy's drafting, OpenAI is LUZ's active AI provider for all live traffic. LUZ has also technically integrated a second provider (Moonshot AI, "Kimi") behind the same internal interface, but `[IMPLEMENTED BUT NOT YET PUBLIC]` no user traffic is currently routed to it — it is reserved for potential future use, and this Policy will be updated before it is activated.

When you interact with LUZ, information sent to the active AI provider to generate a response can include: a bounded portion of your recent conversation history (currently capped, not sent in full regardless of conversation length), the memory and derived-context snapshot described in Sections 7 and 8, and any images you attach to a message.

`[LEGAL/PRODUCT ASSUMPTION — VERIFY — CRITICAL]` LUZ has not yet confirmed, in writing or by contract, whether its AI providers retain submitted data beyond what is needed to generate a response, or whether submitted data may be used to train the provider's models. Until this is confirmed, users should not assume either zero retention or training exclusion, and this Policy will be updated once verified.

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

Credentials for optional third-party connections (Gmail, Apple Calendar) are encrypted at rest using industry-standard authenticated encryption. `[TECHNICAL FACT TO VERIFY]` Broader encryption-at-rest coverage — for the substance of conversations, memories, and derived data generally, beyond connector credentials — has not been confirmed at the infrastructure level as of this draft.

### 13. International Data Transfers

LUZ's infrastructure and AI providers may process and store information in locations other than your own. `[TECHNICAL FACT TO VERIFY]` The specific data-center region(s) used by LUZ's hosting and database providers have not been confirmed and documented as of this draft. Where a transfer mechanism is legally required (for example, transfers out of the EEA or UK), LUZ will identify and rely on an appropriate one — such as Standard Contractual Clauses — once its vendor and region configuration is finalized. `[Jurisdictional note: this section requires country-specific counsel input — see Section 6 of this document.]`

### 14. Data Retention

*In plain terms: LUZ does not currently delete things on a timer. Content you provide is kept until you delete your account, reflecting the product's purpose of building a long-term understanding of you — but this also means there is currently no automatic expiration.*

`[LEGAL/PRODUCT ASSUMPTION — VERIFY — this is a gap, not a settled policy]` LUZ does not currently define or enforce an explicit retention period for conversation, memory, or derived data; such content is retained by default until the account is deleted (Section 15). Operational logs, error-monitoring data, and third-party processor data are retained according to those providers' own default settings, which have not yet been independently confirmed or configured by LUZ. Legal review should evaluate this default against any applicable minimum- or maximum-retention requirements before publication.

### 15. Data Deletion

*In plain terms: today, you can delete your entire account and everything in it, permanently. You cannot yet delete a single memory or conversation on its own — that capability is planned but not built.*

**Full account deletion.** LUZ provides a direct, user-initiated way to delete your account. Deleting your account permanently deletes your associated data — including memories, derived insights and beliefs, concepts, conversations, and connected-integration records — together with your account and authentication record. This is an irreversible, hard deletion, not a status change: once completed, LUZ cannot restore the data. *(CURRENT.)*

**Deleting individual items.** `[IMPLEMENTED BUT NOT YET PUBLIC — disclose honestly, do not imply otherwise]` LUZ does not currently offer a way to delete or "forget" a single memory, conversation, or piece of derived information without deleting your entire account. The underlying capability is part of LUZ's intended design but is not yet available through the product. See Section 7 (P0 in Section 7 of the accompanying Product/Engineering Actions) for the plan to close this gap.

**Disconnecting an integration.** `[TECHNICAL FACT TO VERIFY]` Disconnecting an optional integration (e.g., Gmail, Calendar) removes the stored access credential for that integration. Whether it also removes memories or derived content already created from that integration's data has not been confirmed and should be tested before this section is finalized.

**Backups.** `[TECHNICAL FACT TO VERIFY]` Whether, and for how long, deleted data may persist in infrastructure-level backups or snapshots has not been confirmed.

### 16. User Privacy Rights

Depending on where you live, you may have rights regarding your personal information, which can include the right to access, correct, delete, restrict or object to processing, and receive a copy of your data, and — where applicable — to withdraw consent or lodge a complaint with a data protection authority. `[LEGAL/PRODUCT ASSUMPTION — VERIFY: this section is deliberately general; final rights language must be adapted per jurisdiction (see Section 6) and paired with an actual intake process — see Unknowns item 23.]` Today, the primary mechanism available to exercise these rights is full account deletion (Section 15); `[VERIFY]` a distinct request channel for access/correction requests short of deletion should be established before publication.

### 17. Account and Authentication Data

LUZ uses Google Sign-In for authentication, with server-side, database-backed sessions that LUZ can revoke directly (rather than long-lived tokens that persist independent of the server). Information stored for this purpose includes your email address, name, profile image, and the OAuth and session tokens needed to keep you signed in. `[TECHNICAL FACT TO VERIFY]` Whether these authentication tokens are encrypted at rest, beyond the standard protection of the underlying database, has not been confirmed by this audit and should be verified against the same standard applied to Gmail/Calendar credentials (Section 12).

### 18. Security

LUZ applies the following measures today: encrypted storage (AES-256-GCM) for optional third-party connector credentials, with disconnection actively erasing the stored secret rather than merely marking it inactive; a deliberately minimal permission scope for Gmail access that cannot read message content; account-scoped API access (for example, account deletion can only be triggered by the authenticated account owner); server-revocable sessions; and error monitoring configured without screen-recording. `[LEGAL/PRODUCT ASSUMPTION — VERIFY]` LUZ does not hold, and does not claim, any independent security certification (such as SOC 2 or ISO 27001) as of this draft. Broader protections — including encryption-at-rest for the substance of stored content, a documented incident-response procedure, and a completed subprocessor security review — are in progress; this Policy will avoid general assurances ("industry-leading security") that are not backed by a specific, verifiable control.

### 19. Children's Privacy

LUZ is intended for adult use and is not directed at children. `[LEGAL/PRODUCT ASSUMPTION — VERIFY — gap, not settled policy]` As of this draft, LUZ does not operate an age-verification mechanism, and this Policy cannot yet state a specific enforced minimum age. Counsel must set the exact minimum-age representation appropriate to each jurisdiction of operation (commonly 13 in the US under COPPA; 13–16 in the EU/UK depending on member state) before any public claim is made, and Product/Engineering should confirm what, if anything, LUZ will do if it becomes aware a child has provided personal information.

### 20. Sensitive / Highly Personal Information

LUZ places no topical restriction on what you can discuss in conversation, and may therefore process sensitive personal topics you choose to share. Separately, if you opt into wearable data sharing, LUZ may process health-adjacent information such as step count, resting heart rate, sleep stages, and stress level.

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

Priority order for counsel's attention, most consequential first:

1. **Section 14 (Retention) and Section 15 (Deletion).** The product currently has no retention ceiling and only account-level (not item-level) deletion. This is the single largest gap between what a "memory" product implies to a reasonable user and what it can currently deliver. Decide whether to (a) publish with the gap disclosed as this draft does, (b) require Engineering to close it first (see Section 7, item 3), or (c) both — disclose now, commit to a date.
2. **Section 10/11 (AI Providers).** No confirmed retention or training-opt-out terms exist with OpenAI or Moonshot/Kimi. Recommend obtaining this in writing (or activating a zero-data-retention option if available) before this section is treated as final — this is the item most likely to matter in an actual regulatory inquiry.
3. **Section 20 (Sensitive Information) and the Garmin flow specifically.** Manually emailing health/biometric data to an admin inbox for hand-import is a genuine outlier in this draft — most privacy risk in this document concentrates here. Advise whether this integration should be gated, paused, or restructured before EU/UK users are onboarded, independent of what the policy says.
4. **Section 19 (Children).** No enforcement exists; counsel needs to pick the actual minimum-age representation per jurisdiction, and confirm whether a technical gate is required as a condition of that representation (some regulators expect one, not just a policy statement).
5. **Section 13 (International Transfers).** Currently cannot be written with any specificity — hosting/database region is undocumented. Needs Engineering input before counsel can select a transfer mechanism.
6. **Section 1 (Who We Are) and Section 26 (Contact).** Purely administrative gaps (entity name, address, privacy contact) but block publication regardless of substantive readiness.
7. **Vercel Hobby-plan ToS mismatch (flagged in Unknowns, item 6).** Not a privacy clause, but counsel should be aware it may affect representations LUZ makes elsewhere (terms of service, uptime commitments) about infrastructure.
8. **Section 23 ("we do not sell personal information") and Section 24 (Business Transfers).** Standard boilerplate, but each is a forward-looking legal commitment this draft made as a reasonable default — confirm both reflect actual business intent before adoption.
9. **General register check.** Confirm the plain-language sentences opening Sections 7, 8, and 15 don't inadvertently create a stronger commitment than the formal paragraph beneath them — that was exactly the failure mode Candidate B fell into (Section 2) and this draft tried to avoid by keeping the plain-language lines strictly descriptive, not promissory.

------------------------------------------------------------------------

## 7. Product/Engineering Actions

Ordered by the priority tier from Section 4.

**CRITICAL**

1. Obtain and document actual data-retention and model-training terms with OpenAI and Moonshot/Kimi; enable a zero-data-retention option if available at LUZ's account tier.
2. Decide and implement an encryption-at-rest strategy for memories, beliefs, concepts, conversations, and images (currently plaintext) — at minimum, confirm Neon's disk-level encryption as a compensating control; evaluate column-level encryption for the highest-sensitivity fields (e.g., wearable health metrics).
3. Build a real, user-facing "delete/forget this memory" flow that calls the already-existing (but unwired) forget-stage logic — or make an explicit product decision not to expose it, and update Section 15 accordingly rather than leaving the gap open indefinitely.
4. Replace or gate the manual email + admin-import Garmin flow: at minimum, add a real consent step before import; longer-term, replace it with a secured transfer channel before offering it broadly.

**HIGH**

5. Add an explicit PII-scrubbing configuration to Sentry (`beforeSend` hook; confirm `sendDefaultPii` is disabled) and document exactly what error/performance context is captured.
6. Confirm and document Neon and Vercel deployment region(s); evaluate whether region pinning is needed for EU users.
7. Resolve the Vercel Hobby-plan ToS mismatch — upgrade, or obtain written clarification — since real users currently depend on infrastructure licensed for personal/non-commercial use.
8. Establish a documented incident-response and breach-notification procedure.

**MEDIUM**

9. Confirm the encryption status of the Auth.js `accounts` table (Google OAuth login tokens); apply the existing `secret-cipher.ts` pattern if currently plaintext.
10. Define a retention schedule (or a documented rationale for indefinite retention) for logs, `events` table rows, and derived Knowledge/Belief/Concept data.
11. Stand up a privacy contact channel (and a DPO, if EU operation requires one) plus a basic data-subject-request intake process, even if manual at first.

**LOW**

12. Treat any future activation of Moonshot/Kimi for live traffic as a mandatory policy-update trigger — do not activate silently.
13. Before any future activation of embeddings-based/semantic memory search, revisit Sections 8 and 10 of this Policy — activating it changes what can honestly be claimed about how memory works.

------------------------------------------------------------------------

*End of working draft. Prepared for legal review; not for publication or user-facing distribution in this form.*
