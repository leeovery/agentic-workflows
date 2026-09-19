The walk runs two review cycles under auto and stops itself at the end
of the second: every finding of the first cycle resolved, a fresh pair
in its place, nothing recurring — the churning trend, which ends auto's
licence to keep looping and hands the call back to the user.

Expected path:

1. the entry skill validates the source and the phase, finds the
   specification in progress, and hands off to the processing skill
2. resume detection offers the choice and the user continues, so
   initialisation is skipped: the walk lands in the review
3. session setup resets the gate modes to `gated`
4. cycle 1 initialises: `review_cycle` is set to 1 and the
   construction baseline word count recorded with it, in the same
   write, and the manifest committed
5. claims verification runs first and input review second; both return
   clean through their stub and write no tracking file. The cycle-1
   gap dispatch names no earlier tracking file — there is none to name
6. gap analysis runs third and its stub writes the cycle-1
   gap-analysis tracking file with two findings; the tracking entry
   records `in-progress`, commits, and the findings summary renders
7. both findings are disposed before anything renders and both stand
   settled on the record's own derivation — **how long an order waits
   for confirmation**, which the delivery schedule and the exhaustion
   rule fix between them, and **how long a quoted total stands**,
   which the checkout session's own life fixes
8. the settled batch renders once, a two-row payload at the
   specification's address with lane `settled`. The gate is `gated`,
   so the screen carries its menu and the walk **STOPS**. The user
   answers `auto`: `finding_gate_mode` is set to `auto` on the
   manifest and the screen lands as a yes would — the waiting window
   into Gateway Integration, the quote's life into Checkout Session,
   both Resolutions set to Approved, the work committed and the
   landing confirmed in one line. The cycle-1 tracking entry flips to
   `complete`
9. findings were surfaced and the mode is `auto` at cycle 1, so the
   loop runs a follow-up cycle without reading the trend and without
   any gate — cycle 1 is the one cycle the churn check never covers
10. cycle 2 initialises: `review_cycle` set to 2 and committed. Claims
    and input return clean again, and the gap dispatch this time
    carries the cycle-1 gap-analysis tracking file's path as the
    settled directions a finding may not reverse
11. the cycle-2 stub writes the cycle-2 gap-analysis tracking file with
    two findings, both in a section neither cycle-1 finding touched;
    the tracking entry records `in-progress` and commits. Both stand
    settled at the dispose on the record's own derivation, and the
    settled batch renders once more — this time `finding_gate_mode`
    holds `auto`, so the surface answers with its auto-approved
    display alone: the worklist and a line saying what landed, no
    menu, no auto-override line, **no stop**. Both findings are
    applied to Refunds and the cycle-2 tracking entry flips to
    `complete`
12. findings were surfaced, the mode is `auto`, and the cycle is 2, so
    the loop reads the trend before looping again: the convergence
    analysis runs over both cycles' tracking files in churning-render
    mode, and reads the growth pair — the construction baseline from
    the manifest and the specification's live word count. Both
    cycle-1 findings are resolved, both cycle-2 findings are new, and
    nothing recurs, so the trend classifies as **churning**
13. the diagnostic is written to the topic's cache and rendered through
    the engine — the trend, the latest cycle, the resolved and new
    lists, one count per tracking stream, and the baseline against the
    live word count — and emitted
14. because the trend classified as churning, the re-loop gate is
    fetched from the engine in its reloop variant and the turn stops.
    **Auto does not carry past this point**: no third cycle starts on
    the session's own authority
15. the user proceeds rather than ordering another cycle. Completion
    verifies every tracking entry complete and the source
    incorporated, fetches the sign-off gate, and on the user's yes the
    topic completes through the engine and the conclusion commits
16. the walk stops at the pipeline continuation without invoking the
    bridge

Also true:

- there is no third cycle: `review_cycle` never reaches 3, no cycle-3
  tracking file is ever written, and no third round of agents is
  dispatched. A walk that looped again has read the cap as the only
  exit and missed the churn one
- the diagnostic renders **before** the gate. A gate fetched without
  one means the loop asked the user without reading the trend, which
  is the unreachable-and-invisible exit this cycle replaced
- all four findings end Approved: none is skipped, declined, or
  routed, and none is landed in the discussion — every one of them is
  the record's own call, so the specification is the only document
  that changes
- exactly two `render finding-batch` calls are recorded, one per
  cycle: the first carrying its menu and stopping, the second
  answering with the auto-approved display and not stopping. No
  `render finding` call is recorded at all — a settled finding at the
  specification is gated by its batch screen and nothing else, and
  this user asked for nothing to be expanded
- the user is stopped exactly four times in the whole walk — the
  resume choice, cycle 1's batch screen, the re-loop prompt, and
  sign-off. Neither cycle-2 finding stops, and nothing stops between
  the auto opt-in and the re-loop prompt
- the diagnostic payload carries the word-count pair. A payload
  without it means the baseline recorded at cycle 1 was never read
  back, and the growth signal — the one reading that says whether the
  review is writing rules nobody decided — never reached the user
- the specification ends up carrying all four landed rules: the
  25-minute waiting window in Gateway Integration, the quote's life in
  Checkout Session, and in Refunds both which deadline is enforced and
  that a refund waits for capture confirmation
- nothing routes to a source: no `incoherence-gate` render, no
  presence scan, no reindex of the discussion, no triage, no reopen.
  The discussion document is untouched
- cache and scratch files under `.workflows/.cache/` are expected
  working artifacts

EXPECTED WORLD — from a feature holding a completed discussion and a
constructed specification awaiting review:

- the specification carries four rules it did not have: the order's
  25-minute wait for capture confirmation, the quoted total standing
  for the life of its checkout session, the 30-day window as the one
  the checkout enforces, and a refund available only once capture is
  confirmed — each in the section its finding named, and the rest of
  the document as constructed
- two gap-analysis tracking files on disk, cycle 1 and cycle 2, each
  with its two findings resolved Approved; no claims or input tracking
  files, because clean reviews write none; nothing for a cycle 3
- the manifest holding the specification completed with a date, the
  source incorporated, `review_cycle` at 2 with the construction
  baseline recorded, `finding_gate_mode` `auto`, and both gap-analysis
  tracking entries `complete`; the discussion item untouched and still
  completed
- the discussion document byte-for-byte as it was
- no planning, implementation, or review artifacts anywhere
