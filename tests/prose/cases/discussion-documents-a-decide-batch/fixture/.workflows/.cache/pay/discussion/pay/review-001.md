# Discussion Review — review-001

## Summary

The decided ground is sound. Two calls the document never makes are
already determined by it — each has exactly one defensible answer.

## Gaps Identified

### F1: Webhook payloads are verified with the gateway signing secret

**Lane:** decide

The call: the webhook endpoint verifies every payload against the
gateway's signing secret before acting on it. Determined by the
Capture Confirmation decision — webhooks are the sole confirmation
channel, so an unverified endpoint would accept a forged capture —
and by gateway convention: the Journey already records that every
event arrives signed. No other answer is defensible.

### F2: A refund is issued in the currency of its original capture

**Lane:** decide

The call: refunds are issued in the currency the capture was taken
in, never re-quoted. Determined by the Currency Handling decision —
each capture records the currency it was taken in, and integer
minor units carry no conversion path — and by gateway convention:
a refund is made against its capture. No other answer is
defensible.

## Observations

- The Options blocks would read faster as a table. Style only.
- No retry ceiling is named yet, but the subtopic is open and the
  Summary says so — not a gap in what is decided.

STATUS: gaps_found
FINDINGS: F1,F2
GAPS_COUNT: 2
QUESTIONS_COUNT: 0
SUMMARY: Two settled calls the document has not made, each carrying its derivation.
