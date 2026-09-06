# Discussion — pay

## Context

Accept card payments at checkout using the existing gateway account.

## Decisions

- Use the existing gateway account; no new provider onboarding.
- Card-only for v1 — wallet support is deferred.
- Webhooks confirm capture; the checkout never polls.

## Deferred

- Wallet support (Apple/Google Pay) — revisit after v1.
