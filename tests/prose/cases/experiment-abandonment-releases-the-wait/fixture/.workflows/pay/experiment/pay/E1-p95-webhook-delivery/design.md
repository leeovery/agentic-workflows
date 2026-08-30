# E1: P95 Webhook Delivery

## Question

Does the gateway's p95 webhook delivery time fit inside a
two-second checkout wait window? Feeds the webhook-timing decision.

## Prediction

We expect yes — the vendor claims sub-second delivery — but the
claim is unmeasured.

## Decision rule

If p95 is under two seconds, the checkout waits on the webhook;
otherwise it polls from the start.

## Setup

Timestamp deltas over the sandbox webhook export at
logs/webhooks.log, capture-request time to delivery time.
