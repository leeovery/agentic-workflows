# Discussion — webhook-intake

## Context

One intake standard for every inbound provider webhook: verification,
deduplication, and acknowledgement.

## Decisions

- Every webhook is verified against the provider's signature before
  its body is read; a failed verification is rejected with no side
  effects.
- Deliveries are deduplicated on the provider's event id — a repeat is
  acknowledged and dropped.
- Every webhook is acknowledged within two seconds; the work it
  triggers runs after the acknowledgement.

## Deferred

- A shared intake library — revisit once two consumers follow the
  standard.
