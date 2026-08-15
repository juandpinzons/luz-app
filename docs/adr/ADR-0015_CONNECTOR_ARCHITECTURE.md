# ADR-0015 Connector Architecture

Status: Superseded — never implemented, real integrations shipped without it (see Correction, 2026-08-15)\
Date: July 2026\
Owner: Founder

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

## Correction — 2026-08-15

This ADR was never formally accepted (`Status: Proposed`, unchanged
since July), and `core/connectors/`'s two files
(`Connector`/`ConnectorCredentials`) have zero real consumers today —
confirmed by repo-wide import resolution, not grep pattern-matching.
Gmail (`core/email-connections`), Calendar
(`features/reality/providers/calendar-provider.ts`), and Garmin
(`core/wearable-metrics`) were all built and shipped as real, working,
production integrations without implementing this interface — two of
them only reference it in docblock comments ("mirrors the shape of
`core/connectors/Connector`"), never as an actual `implements`. Each
integration ended up owning its own credential/fetch shape instead.

Three independent real integrations shipping without this contract is
itself the evidence needed to resolve the ADR's own open question — the
shared interface wasn't load-bearing to ship any of them. Recommending
this ADR be formally closed as superseded and `core/connectors/`
deleted as dead code, rather than retrofitting three already-working,
real-user-facing integrations for interface conformance with no
functional benefit (the kind of over-architecture ADR-0018 later warned
against). Left the two files in place pending explicit confirmation —
deleting is a one-line follow-up once agreed.
