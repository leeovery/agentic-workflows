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

### F2: The retry ceiling is deferred to but never numbered

**Lane:** apply

Failed-Payment Retries decides that retries stop at the gateway's own
ceiling and never says what that ceiling is. The provider documents it
as three attempts, so the Decision can carry the number it already
defers to: retries stop at three.

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
