# ADR-0016 AIProvider Structured Output

Status: Accepted\
Date: July 2026\
Owner: Founder

## Context

`AIProvider.generateReply()` (ADR-0003) returns raw text only. Beta 1
Roadmap Sprint B2 and `ALPHA_BACKLOG.md` P1-1 both need the Knowledge
Engine's two AI-backed stages — `ExtractStage` and
`InsightGenerationStrategy` — to get validated, typed data back from
the model (candidate Evidence/Insight shapes), not prose to hand-parse.

Without an addition to the contract, either an engine imports the
OpenAI SDK directly (breaking ADR-0003's single-abstraction rule) or
every AI-backed stage reinvents its own fragile "ask for JSON in the
prompt, parse it, hope" logic. `BETA_ROADMAP_V1.md` flagged this
explicitly as a public-interface question requiring Founder
confirmation before either stage is written — this ADR is that
confirmation.

## Decision

Extend `AIProvider` additively with `generateStructured<T>()`.
`generateReply()` is unchanged; existing callers are unaffected.

```ts
export interface StructuredOutputRequest<T> {
  name: string;
  schema: z.ZodType<T>;
}

export interface AIProvider {
  readonly name: string;
  generateReply(messages: AIMessage[]): Promise<string>;
  generateStructured<T>(
    messages: AIMessage[],
    request: StructuredOutputRequest<T>,
  ): Promise<T>;
}
```

The expected shape is described with a **Zod schema** — the schema
language already used everywhere else in this codebase
(`core/config/env.ts`, `features/chat/types.ts`), not an
OpenAI-specific JSON Schema object. This is deliberate: the contract
stays a long-term abstraction, not a JSON-mode helper bolted onto
`AIProvider`. Each implementation decides internally *how* it
satisfies the schema (native JSON-schema mode, function calling,
whatever its SDK offers) — the contract only guarantees a parsed,
validated `T` comes back, or the call throws.

`OpenAIProvider` implements it with the OpenAI SDK's own
`zodResponseFormat` helper + `chat.completions.parse` (strict
JSON-schema-constrained decoding, zod v4-compatible, already available
in the installed `openai` package — no new dependency). It remains the
only file in the system that imports the `openai` SDK, same invariant
ADR-0003 established. A model refusal (`message.refusal`) is
surfaced as a thrown error, never silently swallowed.

Verified against the real OpenAI API before this ADR was recorded, not
just typechecked: a real request through `generateStructured` with a
small schema returned correctly typed, validated data.

## Consequences

### Positive

- `ExtractStage` and `InsightGenerationStrategy` (Sprint B2) can be
  built against a real, validated data contract instead of parsing
  free text — closes the last blocking gate named in
  `BETA_ROADMAP_V1.md` Section 4.
- No engine or feature gains a new reason to import an AI SDK
  directly — the single-abstraction rule from ADR-0003 holds.
- Schema-driven, not OpenAI-format-driven: a future second provider
  implements the same Zod-in, validated-`T`-out contract however its
  own SDK supports structured output, without changing any caller.

### Trade-offs

- Quality of constrained decoding is provider-implementation-dependent
  — not every future provider will support it as cleanly as OpenAI's
  native JSON-schema mode.
- Schemas passed to `generateStructured` must stay within what
  OpenAI's strict JSON-schema mode can represent (no schema features
  it can't compile) — a constraint on how `ExtractStage`/
  `InsightGenerationStrategy` design their Zod schemas, not on this
  contract itself.
- One more method on an interface the whole system depends on —
  accepted deliberately, additive, does not touch `generateReply()`.

### Future

Sprint B2 implements `ExtractStage` and `InsightGenerationStrategy`
against this contract. Revisit if a second `AIProvider` implementation
is ever added and its structured-output mechanism doesn't fit this
shape cleanly.

## Related

- ADR-0003 AI Provider Abstraction
- ADR-0014 Knowledge Engine Consolidation
- `docs/engineering/BETA_ROADMAP_V1.md` (Sprint B2)
- `docs/engineering/ALPHA_BACKLOG.md` (P1-1)
- `ai/provider.ts`, `ai/providers/openai-provider.ts`
