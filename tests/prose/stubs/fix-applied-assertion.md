# stub: fix-applied-assertion

The applier's status for the batch: the one action applied as instructed,
nothing skipped or reverted. Make the edit the action describes, then
return the block below. The applier compiles its work but never runs the
suite and never touches git — the verifier that follows owns both.

---

APPLIED: 1
SKIPPED: 0
REVERTED: 0
SUMMARY: Repointed the intent assertion through createPaymentIntent so it reads the gateway payload rather than the literal the test built.
