# stub: task-author-expands-consolidation

A task author's expansion of the one approved consolidation proposal.
Edit the staging file in place, under the approved task's existing
`## Task 1` heading: leave its title, its `placement:` and `severity:`
lines, and its Problem and Solution exactly as staged, and add the
three blocks below beneath them. Nothing else in the file moves — no
other proposal — and no other file is written and no git runs. Then
return the status block.

---

The blocks to add under the approved task:

**Do**: Measure the complete set first — `grep -rln "gateway" src/checkout src/webhooks` → 2 files: `src/checkout/payment-intent.js`, `src/webhooks/capture.js`. Create `src/gateway/result.js` exporting `gatewayResult(response)` carrying the unwrap both sites hand-roll, and route every measured site through it.

**Acceptance Criteria**: Every site the measurement names unwraps gateway results through `gatewayResult` — re-running the quoted grep reaches no inline unwrap; the existing checkout and webhook tests stay green untouched.

**Tests**: `gateway results unwrap through the shared helper` — behaviour identical at both call sites.

The status block:

```
STATUS: complete
TASKS_AUTHORED: 1
SUMMARY: Expanded the approved consolidation proposal into an executor-ready body.
```
