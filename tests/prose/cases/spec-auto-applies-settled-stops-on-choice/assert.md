The walk resumes a specification into its review and processes three
findings across both moves the gate presents.

Expected path:

1. the entry skill validates the source and the phase, finds the
   specification in progress, and hands off to the processing skill
2. resume detection offers the choice and the user continues, so
   initialisation is skipped: the walk lands in the review
3. session setup resets the gate modes to `gated` — the user's auto
   opt-in from any earlier sitting never carries across sessions
4. claims verification runs first and returns clean through its stub,
   writing no tracking file
5. input review runs second and its stub writes the cycle-1 tracking
   file with three findings; the orchestrator records the tracking
   entry `in-progress` and renders the findings summary
6. **Finding 1 (settled — the 30-day refund window)** is presented at
   the gate. Its presentation leads with what is wrong for the product
   and the call the discussion determines; the exact wording is not
   read aloud as specification source. The user answers `auto`: the
   finding is applied to the Refunds section, its Resolution set to
   Approved, `finding_gate_mode` set to `auto` on the manifest, and
   the work committed
7. **Finding 2 (settled — partial refunds)** rides auto: it is
   rendered, applied, and announced in a line, with no stop and no
   menu. This is the behaviour the auto gate exists to give
8. **Finding 3 (choice — the failed-webhook retry ceiling)** stops
   anyway, `auto` notwithstanding, because only the user can pick. It
   is presented as numbered options with the recommendation first and
   no `a/auto` row. The user picks the 24-hour reconciliation option —
   the one **not** recommended — and that is what lands in Gateway
   Integration, with the Resolution set to Approved and a note naming
   the option chosen
9. gap analysis runs third and returns clean through its stub; the
   tracking entry flips to `complete`
10. the re-loop gate offers another cycle and the user proceeds to
    completion; sign-off confirms and the topic completes

Also true:

- the specification's Refunds section ends up carrying both the 30-day
  window and per-line-item partial support — the two settled findings
  both landed, one gated and one not
- Gateway Integration carries the 24-hour reconciliation ceiling, never
  the three-attempt one. A walk that landed the recommendation instead
  has rubber-stamped a choice rather than presented it
- no finding is skipped: every row in the tracking file ends Approved.
  There is no skip route out of a finding
- nothing routes to a source: no `incoherence-gate` render, no triage,
  no reopen. All three findings belong to the specification
- the discussion document is untouched — no finding here indicts it
- the user is never asked to approve the same finding twice, and the
  gate never renders a second copy of a finding's heading beneath its
  own content
