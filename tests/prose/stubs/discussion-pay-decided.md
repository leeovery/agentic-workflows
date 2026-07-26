# stub: discussion-pay-decided

The outcome of a discussion session that this framework does not
simulate — the organic conversation between user and assistant. Stands in
for the whole session loop:

1. Write the content below over the discussion file the prose created at
   `.workflows/pay/discussion/pay.md`, replacing the working sections
   while leaving the file's structure as the template made it.
2. Move every subtopic the map holds to a settled state through the
   engine, so the map reflects a finished conversation:
   `discussion-map set pay pay {subtopic} decided` for each, except any
   named for wallets or deferral, which take `deferred`.
3. Resume the prose at the step that follows the session loop.

---

# Discussion — pay

## Context

Accept card payments at checkout using the existing gateway account.
Shaped in discovery as a single feature; card-only for v1.

## Decisions

- Use the existing gateway account — no new provider onboarding, and no
  second set of credentials to hold.
- Card-only for v1. The checkout collects card details directly; wallet
  flows are a separate surface.
- Capture is confirmed by gateway webhook. The checkout never polls: a
  poll would either be slow or hammer the gateway, and the webhook is
  already guaranteed.
- An order with no shippable items still needs a tax context. Billing
  address stands in where there is no shipping address.

## Deferred

- Wallet support (Apple and Google Pay) — revisit after v1 ships and we
  know the card flow holds.

## Triage

(none)
