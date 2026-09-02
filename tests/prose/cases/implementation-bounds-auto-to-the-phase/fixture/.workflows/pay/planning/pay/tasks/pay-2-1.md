---
id: pay-2-1
phase: 2
status: pending
created: 2026-01-01
---

# Reconcile Settlement Reports

Reconcile the gateway's daily settlement report against paid orders and list every mismatch.

**Acceptance Criteria**: Every settled intent matches a paid order or is listed; a fully matched report reconciles to an empty list; nothing is dropped silently.

**Tests**: `lists settled intents with no paid order` — a fully matched report reconciles to an empty list.
