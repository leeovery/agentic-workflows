The prose should have taken this path:

1. the roadmap skill opens in its open mode, and the home snapshot shows
   the map with the two bugs marked as bugs; the first answer takes the
   pull row
2. the pull renders the working set of the three waiting items, and the
   second answer's numbers resolve through its table to the two bugs,
   each held with its kind
3. the shape is set by the rule, not judged: the pulled set holds bugs
   and no idea, so it is a bugfix. The read stated above the gate says
   so, names what stays behind — `loyalty` still waiting under `later`
   — and folds no bug into a feature or an epic, so nothing is said
   about an investigation being skipped. The engine's shape gate renders
   and the walk **STOPS**
4. the third answer confirms and names the unit. The name it gave is
   carried straight into the creation: nothing is suggested back, and
   no collision check runs ahead of the engine
5. the record is read before the backfill is authored: each bug's one
   source is its roadmap note, and both notes are read in full
6. the backfill is staged at
   `.workflows/.cache/tip-charges/discovery/session-001.md`: Seed and
   Imports `(none)`, Map State at Start `(n/a — single-topic work)`,
   and Exploration carrying both notes whole — every sentence of each,
   not a summary of them; Edits, Topics Identified and Conclusion
   `(none)`
7. one creation then the joins: `workunit create tip-charges bugfix`
   with the staged log, then one `roadmap pull` of both bugs into
   `tip-charges`, then the post-pull roadmap rendered so the remainder
   is visible
8. the route for a bugfix: the one-line signpost that the bugfix was
   created from the roadmap and is going to its investigation, then the
   pipeline bridge invoked as `/workflow-bridge tip-charges discovery
   investigation`. The walk stops at that hand-off; the bridge's own
   script never runs

Further claims:

- no feature or epic is ever proposed, and the shape gate renders once:
  the rule leaves nothing to adjust
- the pull never opens a roadmap session and never runs the
  pull-forward
- discovery is never entered: the bugfix's first session log is the
  backfill, and the unit goes to its investigation through the bridge

EXPECTED WORLD — the walk should have produced, from the fixture:

- a bugfix work unit named `tip-charges`, in progress, registered in the
  project manifest, with a one-line description of fixing the tip
  charges, no phase items, and
  `.workflows/tip-charges/discovery/sessions/session-001.md` on disk:
  its Exploration holds the text of both notes — the double charge
  after a basket edit, and the receipt total leaving the tip out — in
  full
- the roadmap's `tip-charged-twice` and `receipt-omits-the-tip` items
  joined to `tip-charges` (`pulled_to` naming it), each keeping its
  `kind: bug`, summary, origin and source; `loyalty` still waiting under
  `later`, untouched
- both notes still at `.workflows/.roadmap/notes/bugs/`, byte-identical:
  the pull reads a note, it never moves one into the unit — no `seeds/`
  directory, no inbox or archive file anywhere
- the git history carries the engine's creation commit and its pull
  commit, and nothing else new; nothing is left dirty
