# stub: task-author-expands-webhook-and-reference

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

Under the reference proposal, with `{settled handling}` read from that task's Solution as the walk left it:

**Do**: In `src/checkout/payment-intent.js`, check `order.id` for a leading `~` before `gateway.intents.create` is called and take `{settled handling}`; every other reference keeps today's path. Extend `tests/checkout/payment-intent.test.js` to cover the `~`-prefixed path.

**Acceptance Criteria**: A `~`-prefixed reference takes `{settled handling}` and never reaches the SDK unescaped; the empty and over-long refusals are unchanged; every other reference creates its intent exactly as before and the existing checkout test stays green.

**Tests**: `a ~-prefixed reference never reaches the gateway unescaped` — the path behaves exactly as the settled handling states.

The status block:

```
STATUS: complete
TASKS_AUTHORED: 2
SUMMARY: Expanded both approved proposals into executor-ready bodies.
```
