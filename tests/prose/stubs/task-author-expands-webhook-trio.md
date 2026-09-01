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

Under the spelling proposal:

**Do**: Rename the losing spelling of the payment identifier to the settled one across `src/checkout/payment-intent.js` and `src/webhooks/capture.js`, and touch nothing else.

**Acceptance Criteria**: One spelling for the gateway identifier at both entry points; behaviour unchanged; the existing tests stay green.

**Tests**: existing suites only — the rename is behaviour-neutral, and green tests are the check.

The status block:

```
STATUS: complete
TASKS_AUTHORED: 3
SUMMARY: Expanded all three approved proposals into executor-ready bodies.
```
