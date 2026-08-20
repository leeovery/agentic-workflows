The prose should have taken this path:

1. the entry's source gate renders empty — the discussion is completed,
   nothing blocks; the phase status reads empty so the verb is a
   creation, and the handoff names the discussion as source material —
   the entry asks the user nothing
2. the process finds no specification file — a fresh start, no resume
   choice is put to the user; initialisation registers the item, the
   pending source row, review state, and both gate modes, and commits
3. construction runs gated, one topic at a time — each piece presented
   in the form it will take in the specification and explicitly
   approved before any write; auto mode is never engaged
4. at the failure-handling ground, the discussion's load-bearing claim
   — every webhook handler wraps its work in withRetry — is verified
   against the tree before extraction: the walk re-runs the recorded
   command (or an equivalent measurement) and finds it false —
   src/webhooks/refund.js does not retry
5. because the no-reconciliation decision leans on the falsified claim,
   the session STOPS conversationally: it puts the document's
   assertion, the command and its measured result, and the leaning
   decision to the user, and takes a stance on whether the decision
   survives. It never extracts the claim as-is, never patches the
   mismatch in the spec alone, and never renders the incoherence
   conflict gate — no sides are documented; this is an exchange, not a
   gate
6. on the user's settlement (require the refund handler to wrap in
   withRetry as part of this work; with that, no reconciliation job
   stands), the walk checks presence, then lands the resolution in the
   discussion's own document: a dated timeline entry above the prior
   Decision prose (wrapped under an Initial heading), the Trigger line
   citing the failed measurement — never specification or this
   session — and the Key Insight resting on the claim repaired in place
7. the edited discussion is reindexed through the knowledge CLI; the
   sources-stale safety valve is skipped — single-topic work has no
   sibling specs — and the resolution commits scoped to the discussion
8. construction continues against the corrected record: the
   specification's failure-handling content carries the corrected claim
   with its command and result, and the refund-handler retry
   requirement
9. the source row flips to incorporated when extraction exhausts;
   review cycle 1 runs claims verification, input review, and gap
   analysis sequentially, each clean through the stubs, never in
   parallel; completion verifies tracking and sources and puts the
   sign-off to the user; on their yes the topic completes through the
   engine and the conclusion commits
10. the walk stops at the pipeline continuation without invoking the
    bridge

Further claims:

- the discussion item never leaves completed — no reopen, no triage
  landing, no new topic
- nothing outside .workflows changes: the webhook sources are read and
  measured, never edited
- cache and scratch files under `.workflows/.cache/` are expected
  working artifacts

EXPECTED WORLD — from a feature holding a completed discussion, three
webhook handler files, and nothing later:

- the discussion's Failure Handling decision reads as a dated timeline:
  the top entry requires the refund handler to wrap in withRetry and
  keeps no-reconciliation on that corrected basis, its trigger citing
  the failed measurement; the original decision survives wrapped
  beneath it; the Key Insight no longer asserts uniform retry wrapping
  as a standing fact; nothing in the document narrates that the change
  came from specification
- a standalone specification at
  `.workflows/pay/specification/pay/specification.md` whose
  failure-handling content matches the corrected record — the measured
  claim carried with its command and result, the refund-handler retry
  requirement present, no reconciliation job required
- the manifest holding the specification completed with a date, the
  discussion source incorporated, review_cycle at 1 with the construction baseline recorded (review_baseline_words), both gate modes
  gated, and no tracking entries; the discussion item untouched and
  still completed
- src/lib/retry.js and the three files under src/webhooks/
  byte-identical to the fixture
- no review tracking files on disk — clean reviews write none; no
  planning, implementation, or review artifacts anywhere
