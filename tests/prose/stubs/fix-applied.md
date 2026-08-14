# stub: fix-applied

The applier's status for a batch: both actions applied as instructed,
nothing skipped or reverted. Make the edits the actions describe, then
return the block below. The applier compiles its work but never runs the
suite and never touches git — the verifier that follows owns both.

---

APPLIED: 2
SKIPPED: 0
REVERTED: 0
SUMMARY: Removed the stale polling claim and repointed the intent assertion at the gateway payload.
