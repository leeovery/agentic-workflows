# Discussion: Pay

## Context

Accept card payments at checkout using the existing gateway account.

---

## Gateway Integration

### Context
Which account and confirmation path the checkout uses.

### Decision
Use the existing gateway account — no new provider onboarding.
Capture is confirmed by gateway webhooks; the checkout never polls.

---

## Telemetry Coverage

### Context
Where payment telemetry lands in the checkout flow.

### Journey
We counted the flow before deciding placement: the checkout spans
four modules (`ls src/checkout/*.js | wc -l` → 4). Per-module
boundaries beat a single funnel event — failures localise to the
module that dropped the order.

### Decision
Every checkout module emits payment telemetry at its boundary —
the rule is per-module, whatever the module count.

---

## Summary

### Key Insights
1. Per-module telemetry localises checkout failures without a
   funnel rebuild.

### Open Threads
- (none)

### Current State
- Gateway integration and telemetry coverage are both resolved.
