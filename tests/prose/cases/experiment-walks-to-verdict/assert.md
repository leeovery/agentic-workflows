The prose should have taken this path:

1. the entry parses its four arguments, reads the experiment item's
   status, finds the series live, reads the series, and resolves E1
   directly — the picker is never rendered, and a `conceived` record
   validates silently: nothing is emitted before the handoff
2. the handoff carries the record's directory; the process refreshes
   the session label, re-reads the series, and takes `conceived` from
   the manifest as authoritative
3. initialisation reads from disk, in full: the problem statement
   first (holding its provenance), then — because the record is
   conceived — the spawning research document, the seed check (an
   epic: nothing to read), and the topic's discovery brief, tracked as
   incorporated. The inputs are inherited ground; the laboratory asks
   the user its own design questions rather than re-eliciting them
4. the design leg authors `design.md` with the user to the template's
   skeleton — question plus the decision it feeds, prediction with the
   expected value, the decision rule concrete enough for a third party
   (fifteen percent or better and behaviour-driven expansion leads;
   less and the research goes to a curated source), and the setup
   naming the log, the deterministic pass, and the sample — then
   records the step (`advance`, conceived → designed) and commits the
   design with the manifest
5. the briefing presents the design conversationally in plain terms —
   what will be done, what is expected and why, what each outcome
   triggers, and what the freeze means — then fetches the approval
   gate and emits its menu verbatim; the user approves, and the freeze
   is recorded by the approve verb, never by advance, and committed
6. the run leg re-reads the record, finds it approved, records that
   measurement begins (advance, approved → running), and measures as
   designed: a deterministic count over `logs/search-sessions.log`,
   never a re-scored or re-designed measure. The report grows as the
   run goes — results traceable to the log, deviations logged (none is
   a fine entry) — and commits land as it is written
7. the measured share is twelve of forty — thirty percent — and the
   conclusion executes the pre-registered rule: the fifteen-percent
   branch fires, behaviour-driven expansion leads. The report's
   reading stays separate from its results, reproduce notes land, and
   the verdict is recorded as the rule's one-line outcome via the
   conclude verb, then committed
8. the conclude response carries the released wait; the session says
   where the ball sits — the research's wait on E1 is released, the
   evidence surfaces at its next entry — re-renders the register
   showing E1 concluded with its verdict, and reaches Step 6
9. the walk stops at the bridge invocation, the record terminal and
   the menu the router

Further claims:

- the design was frozen before anything was measured: no number from
  the log appears in `design.md`, and the design commit precedes every
  report write
- `approve` is the only transition between designed and running —
  advance never crossed the freeze
- the record ends `concluded` with a one-line verdict on the register
  row; the item's derived status is `completed` (its only record is
  terminal), and nothing above the record was completed by hand
- the research item's `awaiting_experiments` is gone and it carries
  `reconcile_needed: "experiment"` — flagged for its re-entry, its
  status still `in-progress`
- the discovery item's brief is tracked as incorporated
- no split was created, nothing was abandoned, no agent was
  dispatched, and the knowledge base was never touched
- git history holds the designed, approved/frozen, run, and concluded
  commits for the record, in that order

EXPECTED WORLD — the fixture plus: E1 `concluded` with its verdict
recorded on the series row and the experiment item `completed`;
`design.md` (question, prediction, decision rule, setup) and
`report.md` (results, deviations, reading, conclusion, reproduce)
under `experiment/synonym-handling/E1-reformulation-recovery/`; the
research item still `in-progress`, its wait removed and
`reconcile_needed: "experiment"` set; `brief_incorporated: true` on
the discovery item; the research document itself unchanged.
