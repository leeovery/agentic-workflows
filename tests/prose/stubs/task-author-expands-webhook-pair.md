# stub: task-author-expands-webhook-pair

A task author's expansion of the two approved analysis proposals. Edit
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

The status block:

```
STATUS: complete
TASKS_AUTHORED: 2
SUMMARY: Expanded both approved proposals into executor-ready bodies.
```
