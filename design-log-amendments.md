# Design-log amendments — concurrent phases

Scratch hand-off for `design/concurrent-phases.md`. Append the block below to
its **Decision log**, after the `Settled 2026-08-26:` list. Written in the
doc's own style; delete this file once landed.

---

Settled 2026-08-27, as the stack landed:

- The code gate lives at the two entry skills, not at every route
  (PR 7). `workflow-implementation-entry` and `workflow-review-entry`
  are the chokepoint every route into a code phase already passes
  through — discovery, the continues, the bridge, and a direct
  invocation alike — so one check in each covers the list the
  components section enumerated. The bridge and the continue skills
  gained nothing: a gate there would fire a second time for the same
  decision without covering a route the chokepoint misses.
- One stop per attempt (PR 7 review). An epic-menu code entry carries
  its own `(code session: {wu}/{topic}, last active {age} ago)`
  marker and routes straight through to the entry skill, which owns
  the stop; the menu's in-session gate stays document-only, since a
  doc entry has no other gate. The struck row and the recommendation
  skip remain — the menu still says who holds the slot, it just no
  longer asks about it, and the gateway refuses to render a gate for
  a code entry so the double stop cannot come back.
- `--plan` narrowed to the action scope (PR 5). Its work-unit
  component became the planning topic's directory plus the work-unit
  manifest — P1 applied to the one commit form that still swept a
  whole unit; the project manifest and the declared `storage_paths`
  still ride. Four sites depended on the sweep and now commit their
  own artifacts alongside the plan: scoping's spec-and-plan
  adjustment, the implementation consolidation pass's staging file,
  the review remediation loop's staging file, and the review
  restart's deletions. The territory-scoped alternative (the topic's
  paths across phases) was considered and rejected — it is the
  partition P1 says not to commit by.
- `--sweep` covers every foreign-topic commit instruction, not just
  the conclude sweep (PR 2 review). A transaction tail's pending note
  prescribes a retry the session runs verbatim, so the triage
  delivery's and the requeue's notes carry the flag; absorb's does
  not, because that verb beats.
- A review session's commits under the implementation topic carry
  `--sweep` (PR 6). Its synthesis report, its remediation staging and
  its restart cleanup all live in `implementation/{topic}/`, but the
  session is not running that phase item — under P8 it must not stamp
  its identity there. The hold would be swept at session end either
  way; the conservative reading costs nothing.
- Deferrals count source phases alone (PR 8). `presence scan` answers
  `live_sources` — research and discussion — because those are the
  corpora the epic-wide analyses read. The widened `PHASES` had made
  the dispatch's `live > 0` mean "any session anywhere", which would
  have deferred the gap analysis behind a live planning or code
  session that touches nothing it reads.
