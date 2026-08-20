# Research: Payment Telemetry Placement

Where payment telemetry should land in the checkout flow, and
what the gateway integration already gives us for free.

## Starting Point

What we know so far:
- Card payments at checkout use the existing gateway account
- Capture is webhook-confirmed; the checkout never polls
- Telemetry today is a single funnel event at order completion

---

## Instrumentation Surface

We counted the flow before weighing placement options: the
checkout spans four modules (`ls src/checkout/*.js | wc -l` → 4).
Per-module boundaries beat a single funnel event — failures
localise to the module that dropped the order, and the per-module
shape holds at any module count.

Conclusion: instrument at module boundaries — the rule is
per-module, whatever the count.

## Gateway Signals

The gateway webhook already carries capture timing and failure
codes; boundary telemetry can join against it without new gateway
calls.

Conclusion: reuse the webhook payload for capture-side fields.
