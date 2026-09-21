# stub: executor-failed-on-tests

A task executor that could not finish: it wrote the capture consumer
and its tests, and one test will not pass. The report names the failing
test, what it tried in the order it tried it, and the keying it used —
and diagnoses nothing and decides nothing; the read of the cause is the
orchestrator's. Write nothing — no source, no tests, no reports, no git
activity — and return the block below.

---

```
STATUS: failed
TASK: Handle Capture Webhooks
SUMMARY: Wrote the capture consumer and its tests. It marks the order
paid and ignores a capture naming an intent no order carries. The
idempotency test will not pass and I have run out of ways to make it.
TEST_RESULTS: failures — `a repeated delivery of the same capture changes nothing` fails: the order is marked paid a second time.
ISSUES: I keyed the seen-delivery set on the delivery id the webhook
envelope carries, and a redelivery of the same capture arrives with a
fresh one, so the guard never matches and the second delivery applies.
I then tried the delivery id together with the received timestamp,
which made the test fail intermittently instead of every run, and then
clearing the set per request, which made every delivery look new. Three
attempts, the same failure. I have not touched the test.
```
