The prose should have taken this path:

1. the entry parses its three arguments, reads the experiment item's
   status, finds the series live, reads the series, and — exactly one
   live record — resolves E1 with nothing asked; the picker is never
   rendered, and the resolved record's announce is the engine note
   (`Resuming E1`), the one line the entry emits before the handoff
2. the handoff carries the record's directory; the process refreshes
   the session label, re-reads the series, and takes `running` from
   the manifest as authoritative
3. initialisation reads the record's own documents from disk — the
   problem statement and the frozen design; the record is past the
   freeze, so the spawning research document is not re-read and no
   brief is tracked
4. the run leg re-reads the record, finds it `running` with no live
   subs and no report on disk — nothing measured, nothing visible —
   and the user's pushed rule change routes to the amendment protocol
   on its near side: results are not yet visible, so the design can
   change as a recorded amendment, never a silent edit
5. the first amendment (threshold fifteen to ten) is appended as a
   dated entry under the design's `## Amendments` — the original text
   above it stays as written — and the amended design is re-presented
   in plain terms with an explicit ask; the user declines, the entry
   is struck (dated), the design holds as approved, and the strike is
   committed
6. the second amendment (the secondary listing of recovering session
   ids) is appended the same way, re-presented, and this time the user
   gives the go; the amendment stands and is committed — at no point
   does any engine verb re-freeze anything: no advance, no approve
7. measurement proceeds as designed — a deterministic count over
   `logs/search-sessions.log`, twelve of forty recovering — with the
   report growing as the run goes and the secondary listing recorded
   as explicitly secondary
8. the conclusion executes the pre-registered rule as registered: the
   fifteen-percent branch fires (the struck amendment never lowered
   it), behaviour-driven expansion leads; the verdict is recorded via
   the conclude verb and committed, the released wait is narrated, the
   register re-renders showing E1 concluded
9. the return leg reads the series, finds no live record, and takes
   the bridge exit — the next-or-menu gate never renders; the walk
   stops at the bridge invocation

Further claims:

- `design.md` carries an `## Amendments` section holding both dated
  entries: the threshold change struck (visibly voided, dated), the
  secondary-listing change standing; every section above it —
  question, prediction, decision rule, setup — is byte-for-byte what
  the fixture froze
- the decision rule executed is the original fifteen percent —
  nothing was re-scored, and no number in the report is judged
  against ten percent
- the record ends `concluded` with a one-line verdict on the register
  row; the item's derived status is `completed`
- the research item's `awaiting_experiments` is gone and it carries
  `reconcile_needed: "experiment"`, its status still `in-progress`
- no split was created, nothing was abandoned, no agent was
  dispatched, and the knowledge base was never touched
- git history holds the struck amendment, the standing amendment, the
  run's report commits, and the conclusion, in that order

EXPECTED WORLD — the fixture plus: E1 `concluded` with its verdict on
the series row and the experiment item `completed`; `design.md`
extended by the `## Amendments` section alone (one struck dated entry,
one standing dated entry); `report.md` (results with the secondary
listing, deviations, reading, conclusion, reproduce) under
`experiment/synonym-handling/E1-reformulation-recovery/`, possibly
beside instrument scripts and curated `data/` extracts — the run
leg's own artifacts, present or absent without prejudice; the research
item still `in-progress`, its wait removed and
`reconcile_needed: "experiment"` set; the research document itself
unchanged.
