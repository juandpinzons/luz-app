# ADR-0019 AIProvider Registry

Status: Accepted\
Date: July 2026\
Owner: Founder

## Context

`ai/index.ts`'s `getAIProvider()` (ADR-0003) constructed exactly one
hardcoded `OpenAIProvider`, cached as a module-level singleton, no
parameters. ADR-0016 and ADR-0017 — the two prior extensions to the
`AIProvider` contract — each explicitly named the same trigger in
their own "Future" sections: *"Revisit if a second AIProvider
implementation is ever added."* The Founder requested exactly that:
Kimi K3 (Moonshot AI) as a second, first-class `AIProvider`, under an
explicit constraint to build only what has a real, present justification
— no auto-routing between models, no per-provider capability
metadata, no fallback chain — since none of those have a real
consumer or real comparative evidence yet.

Separately, auditing the 12 real call sites of `getAIProvider()`
found that 10 of them (the Knowledge Engine V2 AI strategies —
Belief/Concept/Contradiction/Curiosity/Reasoning inference/Insight
generation — plus Life Capture and Morning Brief) had **zero**
observability: no log of which provider was called, which method,
how long it took, or whether it failed. The only signal on failure was
a generic outer catch several layers up (`enrichKnowledgeGraph`) that
could not distinguish an AI failure from a database failure, let alone
say which of the six AI strategies inside it had failed.

## Decision

`ai/index.ts` changes from a single cached instance to a small
registry, keyed by provider name:

```ts
export const AI_PROVIDER_NAMES = ["openai", "kimi"] as const;
export type AIProviderName = (typeof AI_PROVIDER_NAMES)[number];

const factories: Record<AIProviderName, () => AIProvider> = {
  openai: () => new LoggingAIProvider(new OpenAIProvider()),
  kimi: () => new LoggingAIProvider(new KimiProvider()),
};

const cache = new Map<AIProviderName, AIProvider>();

export function getAIProvider(name: AIProviderName = "openai"): AIProvider {
  let provider = cache.get(name);
  if (!provider) {
    provider = factories[name]();
    cache.set(name, provider);
  }
  return provider;
}
```

`getAIProvider()` called with no argument — every one of the 12 real
call sites, unchanged — returns byte-identical behavior to before
this ADR: the same cached `OpenAIProvider`, constructed once. `kimi`
is registered and reachable by explicit name, but nothing calls it
yet; constructing it (and therefore requiring `KIMI_API_KEY`) only
happens if a future caller asks for it by name.

`KimiProvider` (`ai/providers/kimi-provider.ts`) implements
`AIProvider` against Moonshot AI's OpenAI-compatible Chat Completions
API (`kimi-k3`, `https://api.moonshot.ai/v1`), reusing the already-
installed `openai` SDK with a different `baseURL` rather than adding a
new dependency. `KIMI_API_KEY`/`KIMI_MODEL`/`KIMI_BASE_URL`
(`core/config/env.ts`) are the first non-`OPENAI_*` provider config
this schema has ever held — `KIMI_API_KEY` is optional (the app must
keep starting without it; `OPENAI_API_KEY` remains the only mandatory
provider credential), `KIMI_MODEL`/`KIMI_BASE_URL` default so they're
inert without a key.

`generateStructured` on `KimiProvider` deliberately does **not** use
the OpenAI SDK's `.parse()` convenience method the way
`OpenAIProvider` does (ADR-0016) — `.parse()` is a client-side helper
built around OpenAI's own response shape, and its behavior against a
compatible-but-different backend isn't guaranteed by anything. Instead
it builds the same `response_format` via the same `zodResponseFormat`
helper (a pure function, not backend-coupled), calls `.create()`, and
validates the returned JSON against the Zod schema by hand — provable
correct by construction rather than by assumption. This is exactly
the freedom ADR-0016 already granted: *"each implementation decides
internally how it satisfies the schema."*

`LoggingAIProvider` (`ai/providers/logging-ai-provider.ts`) is a
decorator, not a per-implementation change: it wraps whatever
`AIProvider` a factory constructs and logs `provider`/`method`/
`durationMs`/success-or-failure around all three contract methods,
using the same structured `logger` the rest of the codebase already
uses. Composition, not inheritance or a change to either provider —
every current and future provider gets this for free, and neither
`OpenAIProvider` nor `KimiProvider` needs to know it exists.

Two things this ADR explicitly does **not** build, each with the
reason recorded so a future session doesn't have to re-derive it:

- **No AI Router / task-based auto-selection.** Deciding which
  provider handles which kind of task well needs real comparative
  quality data between providers — building that now would be
  encoding a guess as architecture. `getAIProvider(name)` already
  supports a future caller choosing explicitly once there's a reason
  to.
- **No fallback chain between providers.** With only one provider
  (`openai`) holding a real, working key today, a "fall back to kimi"
  path would fail identically to the primary — infrastructure with
  zero present effect. Revisit once `kimi` has both a real key and a
  real consumer.

## Consequences

### Positive

- Adding a third provider later is a new file in `ai/providers/` plus
  one line in `factories` — never a change to `AIProvider`, to
  `LoggingAIProvider`, or to any of the 12 real call sites. Exactly
  the extension shape ADR-0003's single-abstraction rule was meant to
  buy.
- Every AI call in the system — not just the two in
  `send-message.ts` that already had bespoke logging — now has a
  baseline of observability. Verified against real log output from a
  live smoke run against the real OpenAI API, not just a passing
  typecheck: `ai_provider.call_completed` for `generateReply`,
  `generateStructured`, and `generateReplyStream` all fired correctly.
- `getAIProvider()` with no argument is provably unchanged: a
  same-instance identity check (`getAIProvider() === getAIProvider("openai")`)
  is now a permanent smoke assertion
  (`smoke/ai-provider-registry.test.ts`), not just a one-time manual
  check.

### Trade-offs

- `KimiProvider` has never been called against the real Moonshot API
  — no real `KIMI_API_KEY` was available this session. Everything
  about it is correct per Moonshot's public documentation and
  verified patterns already established for `OpenAIProvider`
  (ADR-0016/0017), and the registry itself is verified (cache
  identity, fail-fast without a key), but "the code is right" and
  "confirmed working against the live API" are different claims —
  only the first is true today.
- `LoggingAIProvider` cannot log `requestId`/`conversationId` —
  `AIProvider` methods only receive messages/schemas, never request
  context. The two call sites that need that correlation
  (`send-message.ts`) already log it themselves with more detail; this
  decorator gives the other ten call sites a floor, not a ceiling.

### Future

Revisit AI Router / task-based selection once real comparative usage
data exists. Revisit fallback once `kimi` has a real key and a real
consumer. If AI-call telemetry ever needs to be queryable historically
(not just searchable in Vercel's log output), that's a deliberate,
separate decision — persisting it into `events`
(`core/db/schema/events.ts`) would need a migration and would mix
high-volume call metrics into a table designed for rare operational
incidents; audited and explicitly deferred, not overlooked.

## Related

- ADR-0003 AI Provider Abstraction
- ADR-0016 AIProvider Structured Output
- ADR-0017 AIProvider Streaming
- ADR-0018 Architecture V1 Frozen (this ADR adds no new
  `core/*-engine` module — `ai/` is infrastructure, not a domain
  engine, so it isn't gated by ADR-0018's rule)
- `ai/index.ts`, `ai/providers/kimi-provider.ts`,
  `ai/providers/logging-ai-provider.ts`,
  `smoke/ai-provider-registry.test.ts`
