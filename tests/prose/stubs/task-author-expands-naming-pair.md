# stub: task-author-expands-naming-pair

A task author's expansion of the two approved analysis proposals. Edit
the staging file in place, under each approved task's existing
`## Task {n}` heading: leave its title, its `severity:` and `sources:`
lines, and its Problem and Solution exactly as the walk left them, and
add that task's three blocks beneath them. Nothing else in the file
moves, no other file is written, and no git runs. Then return the
status block.

---

Under the import-declaration proposal:

**Do**: Add an explicit import for `gateway` at the top of `src/checkout/payment-intent.js` and for `orders` at the top of `src/webhooks/capture.js`, leaving both call expressions and both function signatures exactly as they are.

**Acceptance Criteria**: Neither module references an undeclared identifier; both collaborators are imported at the file that uses them; behaviour is unchanged and the existing checkout and webhook tests stay green untouched.

**Tests**: `each module declares the collaborator it calls` — the imports resolve and both entry points behave as before.

Under the spelling proposal, with `{settled spelling}` read from that task's Solution as the walk left it:

**Do**: Rename the gateway identifier to `{settled spelling}` at both entry points — `src/checkout/payment-intent.js` and `src/webhooks/capture.js` — and in `tests/checkout/payment-intent.test.js` and `tests/webhooks/capture.test.js`, leaving no occurrence of the other spelling.

**Acceptance Criteria**: One spelling — `{settled spelling}` — at both entry points and in both tests; behaviour unchanged and the existing tests stay green.

**Tests**: `the gateway identifier reads the same at both entry points` — the rename leaves nothing on the old spelling.

The status block:

```
STATUS: complete
TASKS_AUTHORED: 2
SUMMARY: Expanded both approved proposals into executor-ready bodies.
```
