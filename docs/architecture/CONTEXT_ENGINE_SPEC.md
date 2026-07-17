# CONTEXT ENGINE SPEC

Responsibility:
Represent current reality.

Input:
RealitySnapshot (core/reality, ADR-0013) — life state, memory context
and external signals, already assembled. Context Engine never reads
Memory, the Life Graph, or any other engine directly.

Output:
Context — what is most relevant right now (core/context-engine,
Engineering Package 05).
