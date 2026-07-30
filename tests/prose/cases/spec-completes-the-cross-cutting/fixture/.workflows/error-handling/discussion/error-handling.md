# Discussion — error-handling

## Context

Define one error contract for every service: envelope, retry
classification, and boundary logging.

## Decisions

- Every service returns one error envelope: code, message,
  correlation_id. No service-specific shapes.
- Retryable versus terminal is carried by the code range —
  callers classify from the code alone, never from message text.
- Errors are logged once, at the service boundary, with the
  correlation id — inner layers rethrow without logging.

## Deferred

- Client SDK helper library — revisit once the contract has
  landed in two services.
