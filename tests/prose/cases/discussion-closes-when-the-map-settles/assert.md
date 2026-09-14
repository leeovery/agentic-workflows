The prose should have taken this path:

1. the entry asks the engine whether research is outstanding on the
   topic (it is not), then reads the discussion status, finds it in
   progress, emits the resuming phase note, checks the reconcile flag
   (absent — silent), finds the carrier usable without asking the user
   anything, and hands off with source: existing discussion
2. the process reads the status again, finds the file, renders resume
   detection — the current map shown, the triage queue read (empty, so
   no triage warning), then the continue-or-restart gate — and the user
   continues
3. initialisation is skipped: the walk lands at the guidelines,
   addresses the knowledge base once as a contextual query (empty
   store — the session proceeds silently), and enters the session step
4. the session loop's triage check no-ops on an empty queue; its
   check-for-results runs the agent scan and finds two review rows,
   both incorporated — nothing pending, nothing acknowledged, nothing
   to surface, no announce; no calls queue exists, nothing flushes
5. the session takes up the one live subtopic — declined-card
   messaging, the map's only `exploring` entry — whether the prose
   suggests it or the user goes there, and the user decides it with
   reasons: category messaging keyed to the gateway's decline class,
   never the raw code, the order left open for another card
6. the decision is recorded through the engine —
   `discussion-map set pay pay declined-card-messaging decided` — and
   the response answers `all_decided: true`; the subtopic's section is
   written (Context → Options → Journey → Decision), the Summary
   brought current, and the write committed through the engine's
   topic-scoped commit. The dispatch check after that commit stays
   quiet: both prior reviews are drained, but arming reads one map
   move since review-002 against the two that two completed cycles
   need — no review is dispatched
7. in the same turn, with no question put to the user, the settled map
   is the trigger: the concluding flow renders the wait gate
   (`render wait-gate pay.discussion.pay`), which comes back empty —
   nothing owed — then reads the map through the gateway, finds it
   all decided, emits the settled line, and loads the closing gates
8. the closing gates read the triage queue (empty) and the agent
   store. The highest-numbered review row is incorporated, so the
   movement filter runs, anchored on review-002 — the highest-numbered
   review whose report is on disk: git log since its `created`
   timestamp over the discussion file, drain-tagged commits dropped.
   The file's layered commit carries the review-001 drain marker and
   goes; the residue is the deciding write's own commit — a decision
   documented, meaningful — and the classification is `re-review`
9. the optional review gate renders (`--variant re-review`) and the
   user declines (`n`); the conclude gate renders
   (`--variant wrap-up`) and the user says yes; the in-flight check
   scans the store, finds no agent running, and routes to the final
   gap review step — and the walk stops there, before that step runs

Further claims:

- the user never signalled conclusion — no "that covers it", no
  wrap-up ask, no "what's next" — and the prose put no free-text
  question about concluding to them before the closing gates rendered:
  the settled map alone opened the ceremony
- the closing gates rendered in the same turn as the deciding write's
  commit — no session-loop iteration, no natural-break check, no
  "anything else?" sat between the commit and the wait gate
- the defer gate never renders and nothing is written `deferred` —
  the map settled by decision, so `all_decided` was already true when
  the map gate read it; no `(deferral)` commit exists
- no agent lifecycle call beyond scans: no dispatch, no ack, no
  surface, no incorporate — the store's two review rows stay
  incorporated and otherwise untouched, and the arming anchor's
  snapshot is unchanged
- the only mandatory-review variants (`final-review`,
  `findings-owed`, `review-running`) never render — the store held a
  drained, report-backed review, so the offer was optional and the
  user's `n` is what routed to the conclude gate
- the write-up and the commit landed before the wait gate, not after
  it — the deciding write is documented and committed first, and the
  ceremony runs on the committed state

EXPECTED WORLD — from the fixture:

- the discussion file at `.workflows/pay/discussion/pay.md` carries a
  new `## Declined Card Messaging` section whose decision matches what
  the user said — a category message keyed to the gateway's decline
  class, never the raw code, the order kept open for another card —
  and a Summary whose Current State no longer lists the thread as open;
  the four earlier sections are unchanged
- the manifest holds the discussion in progress with all five
  subtopics `decided` — none pending, exploring, or deferred; the
  discussion is NOT completed
- the agent store's two review rows are unchanged — `review-001` and
  `review-002` both `incorporated`, their reports still on disk, no
  third row
- git history holds the walk's own commit(s) on the discussion file
  after the layered drain commit, none carrying a drain or deferral
  marker; the topic's triage queue is empty
- no research, specification, planning, implementation, or review
  artifacts anywhere; the work-unit description unchanged; no second
  work unit; per-turn cache heartbeats under `.workflows/.cache/` are
  expected, not writes
