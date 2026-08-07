The prose should have taken this path:

1. the entry reads the discussion status, finds it in progress, emits
   the resuming phase note, checks the reconcile flag (absent —
   silent), finds the carrier usable without asking the user anything,
   and hands off with source: existing discussion
2. the process reads the status again, finds the file, renders resume
   detection — the current map shown, then the continue-or-restart gate
   — and the user continues
3. initialisation is skipped: the walk lands at the guidelines,
   addresses the knowledge base once as a contextual query (empty store
   — the session proceeds silently), and enters the session step
4. the session loop's triage check no-ops on an empty queue — no
   commit, nothing surfaced
5. the session loop's check-for-results runs the agent scan and finds
   the acknowledged review row: nothing surfaced, three findings
   remaining. The announce menu is rendered — a count and the lane
   shape, no finding content — and the user opts in
6. every remaining finding is in the apply lane, so the batch screen is
   built: a payload written to the topic's cache, rendered through the
   engine's finding-batch surface, and its DISPLAY and MENU sections
   emitted
7. the user says yes. The corrections are taken one at a time — each
   applied, then committed under its own subject marker, before the next
   begins — so three commits land, not one sweeping all three. The batch
   is then recorded in ONE surface call carrying all three ids, which
   drains the row so it incorporates automatically

Presentation claims — deliberate display claims; the batch's shape is
the behaviour under test:

- the announce names a count and what the lanes ask of the user, and
  describes no individual finding
- the batch screen renders from the engine, not from a template in the
  prose, and the user sees all three items — numbered, two lines each —
  before anything is written
- no finding in the batch is raised individually: there is no scene,
  no worked example, no per-finding question, and no per-finding stop
- exactly one stop gate stands between the announce and the applied
  batch: the batch menu itself
- after the commits the confirmation is one line total, not a
  per-finding recap, and the turn does not end silently on it: the row
  is drained, so the same turn closes the review out loud — a line that
  the findings are worked through — and hands the conversation back

Further claims:

- the two Observations entries are never surfaced, never given ids, and
  never mentioned to the user — the announce count is three, not five
- no fresh review dispatch, no ack, no incorporate call: surfacing the
  batch is what closes the row
- the discussion file's edits are confined to the three corrections
  named in the report — the polling-fallback sentence, the retired
  gateway name in Capture Confirmation's Context, and the currency rule
  for refunds — three distinct sites, each landing as a dated in-place
  amendment rather than a revision block preserving the original under
  an `#### Initial` heading. No subtopic is added, no map state changes,
  and the Options blocks are untouched
- the walk stops after the drained close; no new subtopic is opened and
  no conclusion gate is entered

EXPECTED WORLD — the fixture plus: the agent store row `review-001`
holds all three findings surfaced and stands `incorporated`; the
discussion file carries the three corrections as dated in-place
amendments; and each correction is committed under its own
`(review-001 F…)` subject, one commit per finding.
