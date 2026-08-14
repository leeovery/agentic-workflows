# stub: fix-applied

The applier's status for the batch: both actions applied as instructed,
nothing skipped or reverted. Make the edits the actions describe, then
return the block below. The applier compiles its work but never runs the
suite and never touches git — the verifier that follows owns both.

---

APPLIED: 2
SKIPPED: 0
REVERTED: 0
SUMMARY: Repointed the intent assertion through createPaymentIntent and removed the false polling-recovery claim.
