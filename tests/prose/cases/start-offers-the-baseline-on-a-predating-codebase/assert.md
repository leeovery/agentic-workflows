The prose should have taken this path:

1. loads the shared framework — instructions, casing conventions, voice —
   before any state is read
2. runs the boot pipeline, and since no migrations applied and the
   knowledge base is ready, raises neither the migrations confirmation
   nor the knowledge gate
3. reads `baseline: none` on the boot response and reads its
   `baseline_signal` as evidence: the commits before the workflows arrived
   are a run of feature and fix commits — user accounts, billing with
   invoices, a proration fix, webhook delivery — and the tree they arrived
   into is an application with models, routes, services and tests, so
   this is a codebase the workflows were installed into: it predates them
4. emits the one-line explanation of what a baseline assessment is, then
   fetches and emits the engine's offer menu (`Run a baseline
   assessment?`) and stops for the answer
5. on the decline, records it through the engine's one verb (`baseline
   record skipped`), which writes and commits in the same call — never
   `native`, never a manifest write of its own
6. gets the workflow state from the discovery gateway script rather than
   listing directories or reading files itself, and shows the empty-state
   menu — no active work — whose `a/baseline` row now offers to start the
   assessment later

Further claims:

- the offer is rendered exactly once, before any work is shown, and the
  judgment behind it is made from the boot response's signal — not from
  git commands of the walker's own, and not by asking the user whether
  the code predates the workflows
- the project manifest's baseline reads `skipped` afterwards; nothing
  else about the project changes
- the decline is the only write, and it goes through the engine
