---
id: pay-2-1
phase: 2
status: pending
created: 2026-01-01
depends_on:
  - pay-1-2
---

# Handle Capture Webhooks

Consume gateway capture webhooks and mark the order paid; no polling path.
**Do**: Mark the order paid through the shared retry helper — three attempts at 200 ms, 400 ms and 800 ms before giving up — and key the consumer's seen-delivery set on the gateway event id, evicting entries older than 24 hours.
