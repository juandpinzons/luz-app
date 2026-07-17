# ADR-0015 Connector Architecture

Status: Proposed — awaiting CTO confirmation\
Date: July 2026\
Owner: CTO

## Context

Sprint B and beyond will integrate multiple external data sources into
LUZ — Gmail first, then plausibly Calendar, Garmin, WhatsApp, Photos,
and others. ADR-0013 already anticipated this at the `RealitySnapshot`
level: `ExternalSignalSnapshot`/`ExternalSignal` (`core/reality`) is a
neutral, source-agnostic shape reserved for exactly this. What's
missing is the piece ADR-0013 explicitly deferred — *how* a concrete
integration turns real API data into that neutral shape, and how it
authenticates, without becoming a bespoke pipeline hardcoded into
Knowledge, Memory, or any other engine.

`auth/schema.ts`'s `accounts` table is already multi-provider by
design (primary key `(provider, providerAccountId)`, `access_token`/
`refresh_token`/`scope` columns) — the credential storage shape this
ADR needs already exists, unmodified.

## Decision

Introduce `core/connectors/`, a new shared-kernel module living beside
`core/reality` (not inside any engine, same tier ADR-0013 established
for `RealitySnapshot`). It exports one contract:

```ts
interface Connector {
  readonly source: ExternalSignalSource; // reused from core/reality, no new vocabulary
  fetchSignals(
    credentials: ConnectorCredentials,
    context: LifeGraphContext,
    since?: Date,
  ): Promise<ExternalSignal[]>;
}

interface ConnectorCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
}
```

`ConnectorCredentials` is a neutral projection of an `accounts` row —
`core/connectors` never imports from `auth/`, same anti-corruption
boundary ADR-0013 drew for `core/reality` and `core/life`/
`core/memory-engine`. A future assembler (still unowned, same gap
ADR-0013 already named) translates a real `accounts` row into this
shape before calling a connector.

Each future integration (`GmailConnector`, `CalendarConnector`...) is
one class implementing `Connector` — same swap-ability discipline as
`AIProvider` (ADR-0003): no engine imports a third-party SDK directly,
only this interface.

This ADR authorizes the contract only — it does not authorize
implementing any connector, including Gmail.

## Consequences

### Positive

- Gmail (Sprint B) becomes "write one class," never touches
  `core/knowledge-engine`, `core/memory-engine`, or any other engine
  directly — closes the exact risk the Founder named ("no acoples
  Gmail directamente al engine")
- Reuses `ExternalSignal`/`ExternalSignalSource` verbatim — zero new
  vocabulary, zero schema change
- Credential storage needs no new table — `accounts` already fits

### Trade-offs

- Who calls `fetchSignals()` and merges results into
  `ExternalSignalSnapshot.signals` is still unowned — this ADR gives
  that future orchestrator a typed input, it doesn't build it
- `ExternalSignalSource` (`"calendar" | "document" | "email" | "sensor"`)
  has no slot for WhatsApp (messaging) or Photos (media) as named by
  the Founder — extending it is a `core/reality` value-object change,
  deliberately not made here since no connector needing it is being
  built yet (same "extend when the engine is built, not before"
  discipline ADR-0013 already set for this exact enum)
- No registry (`Connector[]`) is introduced yet — premature with zero
  real connectors; the natural addition once `GmailConnector` exists,
  not before

### Future

Sprint B implements `GmailConnector` against this contract, under its
own authorization. Extending `ExternalSignalSource` for non-email/
calendar sources is a separate future decision, when a connector
actually needs it.

## Related

- ADR-0003 AI Provider Abstraction
- ADR-0013 Reality Snapshot Contract
- `core/reality/external-signal-snapshot.ts`
- `auth/schema.ts` (`accounts`)
