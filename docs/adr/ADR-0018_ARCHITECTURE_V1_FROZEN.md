# ADR-0018 Architecture V1 Frozen

Status: Accepted\
Date: July 2026\
Owner: Founder

## Context

The response pipeline is complete:

```
Context → Conversation Strategy → Reasoning → Presence → Voice → render-context → LLM
```

Six layers, each with a single, clear responsibility, each a
deterministic and independently testable function except where an LLM
call is explicitly isolated behind `AIProvider` (Reasoning's inference
stage, Knowledge Engine's generation stage). Verified end-to-end:
typecheck, lint, build, smoke suite, and direct inspection of the
assembled prompt against real data. No engine in the response chain
imports the LLM provider directly — only `render-context.ts` does.

This is a real foundation, disciplined enough to grow on for years.
That is exactly the risk: it is now easy to keep answering "how does
LUZ think" with another engine (Emotion, Reflection, Empathy, ...)
before any real person has confirmed the current six layers are the
bottleneck. That would be over-architecture — technical depth nobody
asked for, in place of product validation nobody has done yet.

The open question stops being *"how does LUZ think"* and becomes
*"how useful does LUZ feel to a real person."* That question is not
answered by more layers.

## Decision

Freeze the engine architecture at its current shape (Context,
Conversation Strategy, Reasoning, Presence, Voice, Memory, Knowledge —
the engines that exist today). **No new engine is created unless a
validation with real users demonstrates it is necessary.** "New
engine" means a new `core/*-engine` module with its own domain
contract — not a new rule inside an existing engine (a new
`ConversationStrategyRule`, a new Voice constraint, a new Presence
mode derivation), which stays ordinary, ungated engineering work
inside the frozen shape.

Effort redirects to product, UX, and behavior, in this order:

1. **Problem validation** — ICP, problem, JTBD, value proposition.
   Founder-led; not an engineering task.
2. **Response quality** — the conversation itself has to feel
   different, not better-instrumented. No new infrastructure counts
   as progress here.
3. **Onboarding** — the first five minutes likely decide retention.
4. **Visible memory** — LUZ remembering is not enough; the person has
   to feel *"sí me conoce."*
5. **Insights surfaced proactively** — not just responding well, but
   occasionally surprising: *"He notado que durante las últimas
   semanas..."*

## Consequences

### Positive

- Forces the next improvements to be justified by real user signal,
  not internal engineering intuition
- Keeps the six-layer chain legible — a new engineer (or a future
  session) can still hold the whole response pipeline in their head
- Protects the LLM-replaceability property ADR-0003/this session's
  audit already confirmed: nothing about product/UX work threatens it

### Trade-offs

- A genuinely-needed future capability may sit inside an existing
  layer, awkwardly, for longer than it would have as its own engine —
  accepted deliberately, reversible by amending this ADR once
  validation shows the need
- Requires actual discipline: the failure mode is agreeing with this
  ADR in the abstract and then approving "just one more engine" the
  next time one sounds well-motivated

### Future

Revisit only when user validation — not architectural elegance —
shows a gap the current six layers cannot address. Amend this ADR
explicitly before starting a new `core/*-engine` module; do not treat
silence as authorization.

## Related

- ADR-0003 AIProvider Abstraction
- ADR-0005 Presence First
- ADR-0011 Identity Architecture
- ADR-0013 Reality Snapshot Contract
