# stub: synthesizer-stages-a-preference-decision

A synthesis over the cycle's three findings files that stages two
proposals — a plain webhook guard, and a proposal carrying a staged
**Decision** with its **Stakes** line over whether checkout supports or
refuses a `~`-prefixed order reference: a fork at product level whose
every side leaves the user well served, argued past the bar by a cost
the tree does not bear out. Write both files to the paths the agent's
conventions name
(`.workflows/{work_unit}/implementation/{topic}/analysis-report-c{N}.md`
and `.workflows/{work_unit}/implementation/{topic}/analysis-tasks-c{N}.md`)
via the `.txt`-then-rename mechanism, with the content below, then
return the status block. Nothing else: no code writes, no git activity,
no manifest writes, no other files.

---

The report file:

```markdown
# Analysis Report: Pay (Cycle 1)

## Stats

- Total findings: 2
- Deduplicated findings: 2
- Proposed tasks: 2

## Summary

The capture webhook trusts every intent id it is handed — an unknown
intent is marked paid like any other. Checkout refuses an empty or
over-long order reference itself but hands a `~`-prefixed one to the
gateway, whose grammar reads it as a lookup. Nothing is duplicated and
nothing indicts the specification.

## Discarded Findings
- none
```

The staging file:

```markdown
# Analysis Tasks: Pay (Cycle 1)

## Task 1: Guard the capture webhook against unknown intents
severity: medium
sources: standards

**Problem**: `handleCaptureWebhook` calls `orders.markPaid(event.intentId)` without looking the intent up, so a capture naming an intent the order store does not know is treated exactly like a match.
**Solution**: Resolve the intent against the order store before marking paid. On a miss, log the capture's intent id and acknowledge the delivery without changing any order; known intents behave exactly as today.

## Task 2: Settle the `~`-prefixed order reference
severity: medium
sources: standards

**Problem**: `createPaymentIntent` hands `order.id` to the gateway SDK unchanged, and the SDK reads a reference beginning with `~` as a lookup expression rather than a literal. An order whose reference starts with `~` never gets checkout's own refusal — the one an empty or over-long reference gets at `src/checkout/payment-intent.js:5` — but the gateway's `unknown lookup` error, surfaced as the checkout error.
**Solution**: The reference is checked before the SDK sees it; what checkout does with a `~`-prefixed one is the open question.
**Decision**: Does checkout support an order reference beginning with `~`, or refuse it?
**Stakes**: Supporting it escapes the reference for the SDK's grammar (`=~foo` addresses literally) so every reference a merchant assigns can pay, at the cost of a second spelling of the reference in the gateway's dashboard. Refusing it keeps one spelling everywhere, at the cost of requiring the reference minting to stop producing `~`-prefixed ids — a visible change to generated references — and of refusing any merchant-imported id that carries one. Neither the specification nor the discussion addresses reference grammar, and the existing refusals do not decide it: an empty or over-long reference is genuinely unaddressable, whereas `~foo` addresses fine as `=~foo`. Support is recommended because a reference that can be addressed should be.
1. Every order reference a merchant assigns can pay — a `~`-prefixed one is escaped for the gateway and appears escaped in its dashboard (recommended)
2. Checkout refuses a `~`-prefixed reference with its own message, exactly as it refuses an empty or over-long one — one spelling of every reference everywhere
```

The status block:

```
STATUS: tasks_proposed
TASKS_PROPOSED: 2
SUMMARY: Two proposals — a webhook guard, and the `~`-prefixed order reference question.
```
