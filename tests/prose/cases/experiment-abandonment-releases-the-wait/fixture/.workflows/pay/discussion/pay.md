# Discussion: Pay

## Context

Accept card payments at checkout using the existing gateway
account. This discussion settles the capture flow.

---

## Retry Policy

### Context
A failed capture attempt has to retry without double-charging.

### Decision
Our own retry schedule with idempotency keys on every capture
attempt. Bounded at three attempts before surfacing to the
operator.

---

## Webhook Timing

### Context
How long the checkout waits on the capture webhook before falling
back to polling. The window leans on how fast the gateway really
delivers, which nobody has measured.

2026-01-01 — Waiting on experiment evidence — whether the
gateway's p95 webhook delivery time fits inside a two-second
checkout wait window.

---

## Summary

### Key Insights
1. Visibility beats convenience anywhere money moves twice.

### Open Threads
- Webhook timing — waiting on experiment evidence (E1, p95
  delivery against the sandbox).

### Current State
- Retry policy resolved.
- Webhook timing blocked pending evidence.
