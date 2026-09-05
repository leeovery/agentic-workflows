The prose should have taken this path:

1. loads the shared framework — instructions, casing conventions, voice —
   before any state is read
2. runs the boot pipeline, and since no migrations applied and the
   knowledge base is ready, raises neither the migrations confirmation
   nor the knowledge gate
3. reads `baseline: none` on the boot response and reads its
   `baseline_signal` as evidence: the commits before the workflows arrived
   are the world's opening commit, a config-driven setup and a fix to it,
   and the tree they arrived into is a README, a workspace config and the
   setup script — scaffolding, no application code — so the project grew
   up on the workflows and is native
4. records the verdict through the engine's one verb (`baseline record
   native`), which writes and commits in the same call — without
   rendering the baseline offer, without a manifest write of its own, and
   without asking the user anything about it
5. gets the workflow state from the discovery gateway script rather than
   listing directories or reading files itself
6. shows `pay` as the only active work, with a menu whose continue action
   leads into the per-type navigation for a feature

Further claims:

- the offer menu (`Run a baseline assessment?`) never appears, and the
  judgment is made from the boot response's signal — not from git
  commands of the walker's own, not from listing the tree, and never by
  putting the question to the user
- the project manifest's baseline reads `native` afterwards; nothing else
  about the project or the feature changes
- the verdict is the only write, and it goes through the engine
