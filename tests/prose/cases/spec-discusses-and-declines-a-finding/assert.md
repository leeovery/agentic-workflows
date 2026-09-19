The walk resumes a specification into its review and processes two
settled findings on the gated path — one documented with the screen,
one pulled out of it and declined — then asks before running a
follow-up cycle.

Expected path:

1. the entry skill validates the source and the phase, finds the
   specification in progress, and hands off to the processing skill
2. resume detection offers the choice and the user continues; session
   setup resets the gate modes to `gated`
3. claims verification runs first and returns clean through its stub;
   input review's stub writes the cycle-1 tracking file with two
   findings; the tracking entry is recorded `in-progress` and the
   findings summary renders
4. both findings are disposed before anything renders and both stand
   settled — **the 30-day refund window**, which the discussion's
   Refunds decision states outright, and **the rounding rule for
   partial refund amounts**, a call over ground no source addresses.
   Neither is a route: no measurement is run against the tree, and
   neither indicts a source document
5. the settled batch renders once — a two-row payload at the
   specification's address with lane `settled`, each row the call and
   what it rests on. The gate is `gated`, so the screen carries its
   menu — `y/yes`, `a/auto`, Discuss, Ask, and no skip row anywhere —
   and the walk **STOPS**. Neither finding's wording is on screen:
   the screen is the rows and the question, and the user asked for
   nothing to be expanded
6. the user pulls the rounding rule out with Discuss. Every other
   finding on the screen lands first as a yes would: the windowed
   line replaces the bare one in the specification's Refunds section,
   its Resolution becomes Approved, and the work commits
7. the rounding rule is then raised in conversation. The user pushes
   back: the gateway API only accepts integer minor units, so the
   rule specifies a case the system cannot produce. The exchange
   concludes the finding should not land — the Resolution becomes
   **Declined** with that reason in Notes, a one-line announcement is
   made, the work commits, and the rounding sentence is **not**
   written into the specification
8. with both rows resolved the lane is empty, no choice and no route
   remains, and the cycle-1 tracking entry flips to `complete`; gap
   analysis runs clean through its stub
9. gated with findings surfaced, the convergence analysis is reached
   and returns without a diagnostic — one cycle of tracking data is
   below its threshold — and the re-loop gate renders. The user
   proceeds to completion, sign-off confirms, and the topic
   completes; the walk stops at the pipeline continuation without
   invoking the bridge

Also true:

- the Refunds section carries the 30-day window and does NOT carry the
  rounding sentence — anywhere in the document
- the tracking file ends with exactly one Approved row and one
  **Declined** row whose Notes carry the user's reason; no row reads
  Pending or Skipped
- exactly one `render finding-batch` call is recorded and no
  `render finding` call at all: a settled finding at the
  specification is gated by its batch screen, and the expansion this
  user never asked for is the only thing that would have rendered one
- `finding_gate_mode` is never set to auto, and no auto-override
  announcement appears — the walk is gated throughout, and the
  screen's `a/auto` row is offered and declined
- finding 2 is never re-presented after the decline, and the review
  concludes over the Declined row without objection — a declined
  finding is settled, not pending
- nothing routes to a source: no incoherence gate, no presence scan,
  no reindex, no triage, no reopen; the discussion document is
  untouched
