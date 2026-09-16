The prose should have taken this path:

1. the entry asks the engine whether research is outstanding on the
   topic (it is not), then reads the discussion status, finds it in
   progress (the triage reopen left it so), emits the resuming phase
   note, checks the reconcile flag (absent — silent), finds the carrier
   usable without asking the user anything, and hands off with source:
   existing discussion
2. the process reads the status again, finds the file, renders resume
   detection — the current map shown, the triage queue read (one
   entry), then the resume gate with the triage warning directly above
   its menu — and the user continues
3. initialisation is skipped: the walk lands at the guidelines,
   addresses the knowledge base once as a contextual query (empty
   store — the session proceeds silently), and enters the session step
4. the session loop's first triage check finds a resumed sitting with
   a queued concern: the one-entry agenda and the offer menu render
   before any session output — no opening question, no thread of the
   topic's own first — and the user opts in
5. the concern's queue file is read as the session's own brief. Its
   ask is a decision owed here, so no move to the other phase-side is
   offered. Its title names a decided subtopic, so the ground re-arms
   at the raise: the map's subtopics are read and
   `failed-payment-retries` is set `exploring` before the raise —
   composed as an opener in the walk's own voice, never the entry
   verbatim, never from the title alone — and the map is no longer
   all decided
6. the concern is discussed as real material and the user lands the
   changed decision: soft declines retry as before, a hard decline
   ends the attempt at once with the order left open. The fold lands
   it into the existing `## Failed Payment Retries` section — the
   provenance line and the concern's body appended to its Context,
   and the re-decision as a dated timeline entry on its Decision per
   the template's revision convention: the original prose wrapped
   verbatim as `#### Initial`, the new decision above it with a
   trigger line carrying the substance of the routed gap, not a bare
   id. The outcome re-decides settled ground, so the sibling consult
   runs before it is recorded — a feature has no sibling topic, so
   the line reads `Sibling check: no overlap found.` (a knowledge
   query on the way is legal, not owed)
7. the map is set back to `decided` — `discussion-map set pay pay
   failed-payment-retries decided` answers `all_decided: true` — and
   the concern is absorbed in one engine transaction naming its
   ground (`--subtopic failed-payment-retries`): the queue file
   deleted, the fold committed under the absorb's own message, the
   subtopic settled into the review-arming anchor. `remaining` is 0,
   so the clear line renders, and nothing recaps the walk
8. in the same turn, with no question put to the user, the settled
   map is the trigger: the concluding flow renders the wait gate
   (`render wait-gate pay.discussion.pay`), which comes back empty —
   nothing owed — then reads the map through the gateway, finds it
   all decided, emits the settled line, and loads the closing gates
9. the closing gates read the triage queue (empty now) and the agent
   store. The highest-numbered review row is incorporated, so the
   movement filter runs, anchored on review-002 — the highest-numbered
   review whose report is on disk: git log since its `created`
   timestamp over the discussion file, drain-tagged commits dropped.
   The file's layered commit carries the review-001 drain marker and
   goes; the residue is the absorb commit — a decision re-made and
   documented, meaningful — and the classification is `re-review`
10. the optional review gate renders (`--variant re-review`) and the
    user declines (`n`); the conclude gate renders
    (`--variant wrap-up`) and the user says yes; the in-flight check
    scans the store, finds no agent running, and routes to the final
    gap review step — and the walk stops there, before that step runs

Further claims:

- the user never signalled conclusion — no "that covers it", no
  wrap-up ask, no "what's next" — and the prose put no free-text
  question about concluding to them before the closing gates rendered:
  the map settling under the fold alone opened the ceremony
- the closing gates rendered in the same turn as the absorb — no
  session-loop iteration, no natural-break check, no "anything else?"
  sat between the clear line and the wait gate; the close's own
  landed-input read (no flag) is the one engine call between them
- the defer gate never renders and nothing is written `deferred`; no
  `(deferral)` commit exists
- no review is dispatched at any point: while the concern was queued
  the dispatch check's triage box held it shut, and after the absorb
  arming reads no map movement since review-002 against the two moves
  two completed cycles need. No ack, no surface, no incorporate — the
  store's two review rows stay incorporated; the anchor's snapshot
  entry for the subtopic is the one thing the absorb settled, and it
  reads `decided` as before
- the mandatory-review variants (`final-review`, `findings-owed`,
  `review-running`) never render — the store held drained,
  report-backed reviews, so the offer was optional and the user's `n`
  is what routed to the conclude gate
- no second subtopic was created for the concern — the fold reused
  the existing subtopic; the requeue offer never rendered — the ask
  was a decision, owed here
- the specification item was not touched by the walk: still in
  progress, its source row for the discussion still `stale`, its
  document unchanged

EXPECTED WORLD — from the fixture:

- the discussion file at `.workflows/pay/discussion/pay.md` holds the
  `## Failed Payment Retries` section with a Context that now ends in
  the provenance line (`*From: pay · specification · 2026-01-01*`) and
  the concern's body, and a Decision block of two entries, latest
  first: a dated `#### {date} — revised` entry directly beneath the
  heading recording soft-decline-only retries with a hard decline
  ending the attempt at once and the order left open, then
  `#### Initial` holding the original three-attempts prose unedited —
  wrapped, not rewritten, not annotated; the other three sections are
  unchanged
- the topic's triage queue is empty — the concern file deleted by the
  absorb, its deletion staged in the absorb commit alongside the fold
- the manifest holds the discussion in progress with all four
  subtopics `decided` — none pending, exploring, or deferred; the
  discussion is NOT completed; the specification item is unchanged
- the agent store's two review rows are unchanged in status —
  `review-001` and `review-002` both `incorporated`, their reports
  still on disk, no third row; the only store write is the absorb's
  settle of the anchor's snapshot entry, which leaves it reading
  `decided`
- git history holds the absorb commit on the discussion file after
  the layered drain commit, naming the concern file and its origin,
  carrying no drain or deferral marker
- no research, planning, implementation, or review artifacts anywhere;
  the work-unit description unchanged; no second work unit; per-turn
  cache heartbeats under `.workflows/.cache/` are expected, not writes
