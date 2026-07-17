# REQUEST FLOW

User Input
↓
Identity
↓
Memory Retrieval
↓
Knowledge
↓
Context (consumes RealitySnapshot, ADR-0013)
↓
Reasoning
↓
Life Orchestrator
↓
Tools (optional)
↓
Response
↓
Memory Update

Note: this corrects the original ordering, which placed Context before
Memory Retrieval and Knowledge. That predates ADR-0011's
Identity → Life Graph → Memory → Knowledge → Context → Presence →
Conversation chain and ADR-0013's RealitySnapshot, which requires
memory context to already exist before a snapshot can be assembled.
