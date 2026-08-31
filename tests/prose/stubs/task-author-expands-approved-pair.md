# stub: task-author-expands-approved-pair

A task author's expansion of the two approved consolidation proposals.
Edit the staging file in place, under each approved task's existing
`## Task {n}` heading: leave its title, its `placement:` and
`severity:` lines, and its Problem and Solution exactly as staged, and
add that task's three blocks beneath them. Nothing else in the file
moves, no other file is written, and no git runs. Then return the
status block.

---

Under the extraction proposal:

**Do**: Create `src/gateway/result.js` exporting `gatewayResult(response)` carrying the unwrap both entry points hand-roll; replace the inline unwrap in `src/checkout/payment-intent.js` and in `src/webhooks/capture.js` with calls through it.

**Acceptance Criteria**: Both entry points unwrap gateway results through `gatewayResult`; no inline unwrap remains at either site; the existing checkout and webhook tests stay green untouched.

**Tests**: `gateway results unwrap through the shared helper` — behaviour identical at both call sites.

Under the short-capture proposal, with `{settled handling}` read from that task's Solution as the walk left it:

**Do**: In `src/webhooks/capture.js`, read the captured amount from the capture event and compare it against the order total before marking anything; a capture covering the total marks the order paid as today, and a shortfall takes `{settled handling}`. Extend `tests/webhooks/capture.test.js` to cover the shortfall path.

**Acceptance Criteria**: A capture covering the order total marks it paid exactly as before; a short capture takes `{settled handling}` and nothing else; duplicate deliveries stay idempotent and the existing webhook test stays green.

**Tests**: `a short capture never silently fulfils the order` — the shortfall path behaves exactly as the settled handling states.

The status block:

```
STATUS: complete
TASKS_AUTHORED: 2
SUMMARY: Expanded both approved proposals into executor-ready bodies.
```
