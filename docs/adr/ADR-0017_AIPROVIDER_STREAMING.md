# ADR-0017 AIProvider Streaming

Status: Accepted\
Date: July 2026\
Owner: Founder

## Context

`AIProvider.generateReply()` (ADR-0003) waits for the full response
before returning anything — the chat UI showed a fixed "LUZ está
escribiendo…" indicator for the entire generation time, with no
visible progress. `ALPHA_BACKLOG.md` P2-1 named this as a real,
measured latency-perception gap. The Founder requested streaming
explicitly as the next priority — this ADR is that confirmation,
following the same process ADR-0016 established for extending this
contract.

## Decision

Extend `AIProvider` additively with `generateReplyStream()`.
`generateReply()` and `generateStructured()` are unchanged; existing
callers are unaffected.

```ts
export interface AIProvider {
  readonly name: string;
  generateReply(messages: AIMessage[]): Promise<string>;
  generateStructured<T>(
    messages: AIMessage[],
    request: StructuredOutputRequest<T>,
  ): Promise<T>;
  generateReplyStream(messages: AIMessage[]): AsyncIterable<string>;
}
```

The contract only guarantees that the yielded fragments, concatenated
in order, form the same text `generateReply()` would have returned for
the same input — it does not prescribe how an implementation achieves
that. `OpenAIProvider` implements it with the SDK's native `stream:
true` mode, yielding each non-empty `delta.content` fragment as it
arrives. It remains the only file in the system that imports the
`openai` SDK, same invariant ADR-0003 established.

`features/chat/services/send-message.ts` splits its existing internal
logic into two shared, private helpers — `prepareMessage()` (everything
that already ran before calling the provider: persist the user
message, Context Builder, Memory capture) and `finalizeReply()`
(everything that already ran after: persist the assistant message,
enqueue the Knowledge Engine job, record the event). The existing
`sendMessage()` is rebuilt on top of these two helpers with identical
external behavior; the new `sendMessageStream()` reuses the same two
helpers and only replaces "await the full reply" with "iterate the
provider's stream, accumulate, then finalize with the accumulated
text" — no logic is duplicated between the streaming and non-streaming
paths.

`POST /api/chat`'s contract does not change. Streaming is a new
capability, negotiated by the standard `Accept` request header — never
a silent replacement of the existing response shape. By default (no
`Accept: text/event-stream`, or any other value) the route behaves
exactly as it always has: JSON `{conversationId, reply}` via
`sendMessage()`. Only a client that explicitly sends `Accept:
text/event-stream` gets a real Server-Sent Events stream via
`sendMessageStream()` — a `meta` event first (carrying `conversationId`,
known before any AI call happens), then one `chunk` event per text
fragment, each event's `data` JSON-encoded to avoid any ambiguity if a
fragment contains a literal newline. Every error path (401
unauthenticated, 429 rate limited, 400 invalid request, 500 if message
preparation itself fails) is JSON in both cases, unchanged.

Verified against the real local server, not just typechecked: the
real 401 JSON shape confirmed via curl (identical regardless of
`Accept`), `sendMessageStream()` exercised directly against real
OpenAI and the real local database (88 fragments arriving over ~1s,
persisted text matching the streamed text exactly), and the SSE
wire mechanism (headers, framing, a stream that errors partway through)
exercised against real `Response`/`ReadableStream` objects, not mocks.

## Consequences

### Positive

- Responses appear progressively as the model generates them — the
  perceived latency gap named in P2-1 is closed without changing what
  gets stored, sent to Memory, or handed to the Knowledge Engine.
- No engine or feature gains a new reason to import an AI SDK directly
  — the single-abstraction rule from ADR-0003 holds.
- `POST /api/chat`'s existing contract is untouched for any caller that
  doesn't explicitly opt in — streaming is additive at the transport
  level too, not just at the `AIProvider` level.
- `sendMessage()` and `sendMessageStream()` are both real, both called
  by the route (one per negotiated representation) — neither is dead
  code, and both share 100% of their substantive logic via
  `prepareMessage()`/`finalizeReply()`, so a future bug fix to message
  preparation or finalization can never drift between the two paths.

### Trade-offs

- A failure that happens *after* the 200 status and headers are
  already sent (mid-stream, SSE path only) can no longer be reported
  as an HTTP error status — it surfaces as a broken stream, which the
  client interprets the same way it already interprets a network
  failure (ADR context: same fallback message introduced when
  `/chat`'s error handling was fixed to use the server's real error
  text instead of a generic one).
- Two response formats for one endpoint is one more thing a future
  reader of `app/api/chat/route.ts` needs to hold in their head —
  mitigated by keeping the negotiation logic to a single boolean check
  and two small, separately named handler functions, each only
  responsible for its own representation.

### Future

Revisit if a second `AIProvider` implementation is ever added whose
SDK does not support incremental streaming — its `generateReplyStream`
would need to yield the full text as a single fragment, which the
contract already permits.

## Related

- ADR-0003 AI Provider Abstraction
- ADR-0016 AIProvider Structured Output
- `docs/engineering/ALPHA_BACKLOG.md` (P2-1)
- `ai/provider.ts`, `ai/providers/openai-provider.ts`,
  `features/chat/services/send-message.ts`, `app/api/chat/route.ts`,
  `app/chat/page.tsx`
