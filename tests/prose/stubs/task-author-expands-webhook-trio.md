# stub: task-author-expands-webhook-trio

A task author's expansion of the three approved analysis proposals. Edit
the staging file in place, under each approved task's existing
`## Task {n}` heading: leave its title, its `severity:` and `sources:`
lines, and its Problem and Solution exactly as the walk left them, and
add that task's three blocks beneath them. Nothing else in the file
moves, no other file is written, and no git runs. Then return the
status block.

---

Under the guard proposal:

**Do**: In `src/webhooks/capture.js`, resolve `event.intentId` against the order store before marking paid; when no order matches, log the intent id and return an acknowledgement without calling `orders.markPaid`. Known intents keep today's path untouched.

**Acceptance Criteria**: A capture for an unknown intent changes no order and is acknowledged; the miss is logged with the capture's intent id; captures for known intents mark the order paid exactly as before and the existing webhook test stays green.

**Tests**: `an unknown intent capture changes no order` — the miss is logged and acknowledged; the known-intent path is unchanged.

Under the surfacing proposal:

**Do**: Create `src/webhooks/unmatched.js` — a store recording each capture the guard could not match (intent id, amount, received at) — and have the guard's miss path write one entry after logging. Expose a read for operator review.

**Acceptance Criteria**: Every unmatched capture lands exactly one entry in the store; matched captures land none; each entry carries enough to resolve the capture by hand.

**Tests**: `an unmatched capture is recorded for follow-up` — one entry per miss, none on a match.

Under the test proposal, with `{settled double}` read from that task's Solution as the walk left it:

**Do**: In `tests/checkout/payment-intent.test.js` and `tests/webhooks/capture.test.js`, replace each empty body with a test that drives its entry point through `{settled double}` for the collaborator it reaches — `gateway` for checkout, `orders` for the webhook — and asserts the guarantee the test names: a card-only intent created against the order's id on checkout start; the order marked paid on a capture for a known intent.

**Acceptance Criteria**: Neither test body is empty; each fails when the guarantee it names is broken; both suites run with no ambient collaborator in scope.

**Tests**: `creates a card-only intent on checkout start` and `marks the order paid on capture webhook` — filled, each driving its entry point through `{settled double}`.

The status block:

```
STATUS: complete
TASKS_AUTHORED: 3
SUMMARY: Expanded all three approved proposals into executor-ready bodies.
```
