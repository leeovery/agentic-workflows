# Discussion Review — review-001

## Summary

Three corrections, each determined by a decision the document
already carries.

## Gaps Identified

### F1: The Decision keeps a polling fallback the Journey retired

**Lane:** apply

Capture Confirmation § Journey records that the polling fallback was
dropped once delivery guarantees were confirmed. The Decision beneath
it still ends "A polling fallback remains available if delivery
proves unreliable." Strike it.

### F2: The missed-webhook path is decided but never written down

**Lane:** apply

The Journey records that reconciling a webhook that never arrives was
raised. Since polling is ruled out, the reconciliation path follows:
the checkout reconciles pending orders against the gateway on a
schedule. State it in the Decision.

### F3: The currency rule is stated for amounts but left implied for refunds

**Lane:** apply

Currency Handling decides integer minor units, never floats, and
names the store currency. Refunds are an amount by the same rule and
the section never says so.

STATUS: gaps_found
FINDINGS: F1,F2,F3
GAPS_COUNT: 3
QUESTIONS_COUNT: 0
SUMMARY: Three corrections determined by decisions already recorded.
