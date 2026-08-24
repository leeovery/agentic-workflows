The walk resumes a specification into its review and processes two
settled findings on the gated path — one applied at the gate, one
talked through and declined.

Expected path:

1. the entry skill validates the source and the phase, finds the
   specification in progress, and hands off to the processing skill
2. resume detection offers the choice and the user continues; session
   setup resets the gate modes to `gated`
3. claims verification runs first and returns clean through its stub;
   input review's stub writes the cycle-1 tracking file with two
   findings; the tracking entry is recorded `in-progress` and the
   findings summary renders
4. **Finding 1 (settled — the 30-day refund window)** presents with
   its diff and the gate — `y/yes`, `a/auto`, **Discuss**, no skip row
   anywhere. The user answers yes: the Refunds line is replaced with
   the windowed version, the Resolution becomes Approved, the work
   commits
5. **Finding 2 (settled — the rounding rule)** has no Current and a
   one-sentence Proposed Text, so its wording renders **visible at the
   gate as an additions-only diff** (all added lines) — not held
   behind a view option, and not dumped as a raw content block
6. the user pushes back through Discuss: the gateway API only accepts
   integer minor units, so the rule specifies a case the system cannot
   produce. The exchange concludes the finding should not land: the
   Resolution becomes **Declined** with the reason in Notes, a
   one-line announcement is made, the work commits — and the rounding
   sentence is **not** written into the specification
7. with both rows settled the tracking entry flips to `complete`; gap
   analysis runs clean through its stub
8. gated with findings surfaced, the re-loop gate renders; the user
   proceeds to completion, sign-off confirms, and the topic completes;
   the walk stops at the pipeline continuation without invoking the
   bridge

Also true:

- the Refunds section carries the 30-day window and does NOT carry the
  rounding sentence — anywhere in the document
- the tracking file ends with exactly one Approved row and one
  **Declined** row whose Notes carry the user's reason; no row reads
  Pending or Skipped
- `finding_gate_mode` is never set to auto, and no auto-override
  announcement appears — the walk is gated throughout
- finding 2 is never re-presented after the decline, and the review
  concludes over the Declined row without objection — a declined
  finding is settled, not pending
- nothing routes to a source: no incoherence gate, no triage, no
  reopen; the discussion document is untouched
