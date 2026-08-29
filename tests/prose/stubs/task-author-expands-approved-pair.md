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

Under the naming proposal, with `{settled name}` read from that task's Solution as the walk left it:

**Do**: Rename the gateway identifier to `{settled name}` at both entry points — `src/checkout/payment-intent.js` and `src/webhooks/capture.js` — and in `tests/checkout/payment-intent.test.js` and `tests/webhooks/capture.test.js`, leaving no occurrence of the other spelling.

**Acceptance Criteria**: One spelling — `{settled name}` — at both entry points and in both tests; behaviour unchanged and the existing tests stay green.

**Tests**: `the gateway identifier reads the same at both entry points` — the rename leaves nothing on the old spelling.

The status block:

```
STATUS: complete
TASKS_AUTHORED: 2
SUMMARY: Expanded both approved proposals into executor-ready bodies.
```
