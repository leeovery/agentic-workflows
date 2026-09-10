# stub: fix-applied-blocking-and-remedy

The applier's status for the batch: both actions applied as instructed —
the blocking one among them — nothing skipped or reverted. Make the edits
the actions describe, then return the block below. The applier compiles its
work but never runs the suite and never touches git — the verifier that
follows owns both.

---

APPLIED: 2
SKIPPED: 0
REVERTED: 0
SUMMARY: Fixed the intent's methods to ['card'] and guarded the capture write against an unknown intent, with the case that observes it.
