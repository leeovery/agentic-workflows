The prose should have taken this path:

1. the entry reads the discussion status, finds it in progress, emits
   the resuming phase note, checks the reconcile flag (absent — silent),
   re-reads the carrier without asking the user anything, and hands off
   with source: existing discussion
2. the process reads the status again, finds the file, renders resume
   detection — the current map shown, then the continue-or-restart
   gate — and the user continues
3. initialisation is skipped: the walk lands at the guidelines,
   addresses the knowledge base once as a contextual query (empty
   store — the session proceeds silently), and enters the session step
4. the session loop's triage check no-ops on an empty queue — no commit, nothing
   surfaced
5. the session loop's check-for-results runs the agent scan and finds
   only the incorporated review row — nothing pending, nothing
   acknowledged, nothing to surface, no announce, no parenthetical
6. the user signals the discussion covers it; the map is read through
   the gateway and comes back fully decided, and the closing gates
   load
7. the classification is mechanical: the store's highest-numbered
   review row is incorporated, so the movement filter runs — git log
   since the row's `created` timestamp over the discussion file,
   drain-tagged commits dropped. The file's only commit carries the
   review-001 drain marker, so the residue is empty and the
   classification is satisfied — deterministically, with no
   meaningfulness judgment
8. no fresh review is offered: the close goes straight to the conclude
   gate — the "discussion has moved" menu never renders. (Had it been
   offered, this user would have accepted — the absence of any
   dispatch is the classification holding, not the user declining)
9. the user confirms conclusion; the in-flight check finds no running
   agents and routes to the final gap review step — and the walk stops
   there, before that step runs

Further claims:

- the review gates (optional and mandatory) never render — the only
  gate the user answers inside the closing gates is the conclude gate
- every commit touching the discussion file postdates the review's
  dispatch by timestamp — a classifier reasoning from timestamps alone
  would have offered a re-review; only honouring the drain marker
  reaches satisfied
- no agent lifecycle call beyond scans: no dispatch, no ack, no
  surface, no incorporate — the store already held the row
  incorporated and it stays untouched
- nothing is written: no discussion-file edit, no map change, no
  commit — the walk reads, classifies, and stops (per-turn cache
  heartbeats under `.workflows/.cache/` are expected, not writes)

EXPECTED WORLD — the fixture, unchanged.
