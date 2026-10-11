The prose should have taken this path:

1. the roadmap skill opens in its open mode, and the home snapshot shows
   the map with the two quick-fixes marked as quick-fixes; the first
   answer takes the pull row
2. the pull renders the working set of the three waiting items, and the
   second answer's numbers resolve through its table to the two
   quick-fixes, each held with its kind
3. the shape is set by the rule, not judged: the pulled set holds
   quick-fixes and nothing else, so it is a quick-fix. The read stated
   above the gate says so and names what stays behind — `loyalty` still
   waiting under `later`. No bugfix, feature or epic is weighed. The
   engine's shape gate renders and the walk **STOPS**
4. the third answer confirms and names the unit. The name it gave is
   carried straight into the creation: nothing is suggested back, and
   no collision check runs ahead of the engine
5. the record is read before the backfill is authored: each
   quick-fix's one source is its roadmap note, and both notes are read
   in full
6. the backfill is staged at
   `.workflows/.cache/storefront-polish/discovery/session-001.md`: Seed
   and Imports `(none)`, Map State at Start `(n/a — single-topic
   work)`, and Exploration carrying both notes whole — every sentence
   of each, not a summary of them; Edits, Topics Identified and
   Conclusion `(none)`
7. one creation then the joins: `workunit create storefront-polish
   quick-fix` with the staged log, then one `roadmap pull` of both
   quick-fixes into `storefront-polish`, then the post-pull roadmap
   rendered so the remainder is visible
8. the route for a quick-fix: the one-line signpost that the quick-fix
   was created from the roadmap and is going to its scoping, then the
   pipeline bridge invoked as `/workflow-bridge storefront-polish
   discovery scoping`
9. the bridge reads the work type from the manifest; discovery is the
   completed phase, so its discovery script is skipped and the given
   destination is taken: the discovery continuation hands off through
   the engine as `/workflow-scoping-process quick-fix
   storefront-polish`. The handoff is taken and the walk stops there —
   scoping never starts

Further claims:

- the shape gate renders once: the rule leaves nothing to adjust, and
  no bugfix, feature or epic is ever proposed
- the pull never opens a roadmap session and never runs the
  pull-forward
- discovery is never entered: the quick-fix's first session log is the
  backfill

EXPECTED WORLD — the walk should have produced, from the fixture:

- a quick-fix work unit named `storefront-polish`, in progress,
  registered in the project manifest, with a one-line description of
  the two storefront fixes, no phase items, and
  `.workflows/storefront-polish/discovery/sessions/session-001.md` on
  disk: its Exploration holds the text of both notes — the email
  subject naming the restaurant, and the footer's hard-coded year — in
  full
- the roadmap's `order-email-subject-names-the-restaurant` and
  `footer-shows-last-year` items joined to `storefront-polish`
  (`pulled_to` naming it), each keeping its `kind: quick-fix`, summary,
  origin and source; `loyalty` still waiting under `later`, untouched
- both notes still at `.workflows/.roadmap/notes/quickfixes/`,
  byte-identical: the pull reads a note, it never moves one into the
  unit — no `seeds/` directory, no inbox or archive file anywhere
- the git history carries the engine's creation commit and its pull
  commit, and nothing else new; nothing is left dirty
