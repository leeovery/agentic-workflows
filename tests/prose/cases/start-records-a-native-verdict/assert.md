The prose should have taken this path:

1. loads the shared framework — instructions, casing conventions, voice —
   before any state is read
2. runs the boot pipeline, and since no migrations applied and the
   knowledge base is ready, raises neither the migrations confirmation
   nor the knowledge gate
3. reads `baseline: none` on the boot response and judges from its
   `baseline_signal` — the repository's first commit already carried
   `.workflows/`, so no commits and no project files came before the
   workflows — that the project is native
4. records the verdict through the engine (`manifest set
   project.baseline.status native`) and commits it with `commit
   --workflows`, without rendering the baseline offer and without asking
   the user anything about it
5. gets the workflow state from the discovery gateway script rather than
   listing directories or reading files itself
6. shows `pay` as the only active work, with a menu whose continue action
   leads into the per-type navigation for a feature

Further claims:

- the offer menu (`Run a baseline assessment?`) never appears, and the
  judgment is made from the boot response's signal — not from listing
  the tree, not from git commands of the walker's own, and never by
  putting the question to the user
- the project manifest's baseline reads `native` afterwards; nothing else
  about the project or the feature changes
- the verdict is the only write, and it goes through the engine
