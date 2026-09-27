The prose should have taken this path:

1. the scoped path (epic, no topic) renders the spec-entry snapshot:
   both discussions concluded, the proposed `expansion` grouping and
   the in-progress `behavioural-ranking` specification — the scenario
   is groupings, and prerequisites pass
2. the groupings menu is fetched where it is shown, offering both rows
   with the unify and the re-analyze beneath them; the user picks the
   unify
3. `unified` is not yet a key, so the reconcile runs: the proposed
   `expansion` item is deleted, `unified` is upserted as proposed with
   both completed discussions as pending sources, the build order is
   assigned over `unified` and the `behavioural-ranking` anchor, and
   all of it lands through one `manifest apply`
4. the analysis doc is rewritten to a single Unified grouping over both
   discussions, and the reconcile commits
5. the confirmation is the unify confirm — rendered for the `unified`
   item with the unify variant, never the create confirm — and the user
   answers yes
6. a started specification exists, so the handoff is the incorporation
   form: `workflow-specification-process` invoked with both discussions
   as source discussions, `behavioural-ranking`'s specification listed
   to incorporate, output at
   `.workflows/search-relevance/specification/unified/specification.md`,
   and the supersede call for `behavioural-ranking` left for after
   completion

Further claims about the end state:

- the specification items are exactly `behavioural-ranking` —
  in-progress, its source row still incorporated — and `unified` —
  proposed, `behavioural-ranking` and `synonym-handling` both pending;
  `expansion` is gone
- both items carry an integer `order`, and the two orders are 1 and 2
- the analysis doc at
  `.workflows/search-relevance/.state/discussion-consolidation-analysis.md`
  holds one Unified grouping naming both discussions and the note
  `Custom groupings confirmed by user (unified).`
- no discussion or map item moved; `relevance-measurement` has no
  specification item
- nothing started, completed, or superseded a specification — the
  supersession is the processing skill's, after the unified
  specification completes
