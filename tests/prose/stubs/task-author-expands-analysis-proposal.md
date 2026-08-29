# stub: task-author-expands-analysis-proposal

A task author's expansion of the one approved analysis proposal. Edit
the staging file in place, under that task's existing `## Task {n}`
heading: leave its title, its `severity:` and `sources:` lines, and its
Problem and Solution exactly as staged, and add the three blocks below
beneath them. The declined proposal is not touched. Nothing else in the
file moves, no other file is written, and no git runs. Then return the
status block.

---

Under the approved proposal:

**Do**: Add an explicit import for `gateway` at the top of `src/checkout/payment-intent.js` and for `orders` at the top of `src/webhooks/capture.js`, leaving both call expressions and both function signatures exactly as they are.

**Acceptance Criteria**: Neither module references an undeclared identifier; both collaborators are imported at the file that uses them; behaviour is unchanged and the existing checkout and webhook tests stay green untouched.

**Tests**: `each module declares the collaborator it calls` — the imports resolve and both entry points behave as before.

The status block:

```
STATUS: complete
TASKS_AUTHORED: 1
SUMMARY: Expanded the approved proposal into an executor-ready body.
```
