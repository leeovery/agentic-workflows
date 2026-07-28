# Discussion Review

## Summary

The decided ground is well documented, but the decision it rests
on carries an unexamined failure path, and an asserted bound is
never pinned.

## Gaps Identified

### F1: Retry cap asserted but never pinned

The Summary holds failed-payment retries as open while the
conversation leans on "a small bounded number of attempts" — but
no bound, backoff, or reset condition is recorded anywhere. If
the discussion closes without pinning the number, planning will
have to invent one.

### F2: Webhook capture has no missed-webhook path

The Capture Confirmation decision rests on the gateway webhook
being guaranteed, and polling is explicitly ruled out. Nothing
records what happens when the webhook never arrives — a gateway
outage or a rejected delivery leaves the order pending forever,
and with polling off the table there is no documented
reconciliation path.

STATUS: gaps_found
FINDINGS: F1,F2
GAPS_COUNT: 2
QUESTIONS_COUNT: 0
SUMMARY: Two gaps — an unpinned retry bound, and no path for a webhook that never arrives.
