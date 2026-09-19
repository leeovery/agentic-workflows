The walk resumes an epic's specification into its review, meets a
decision the specification made and no source did, finds nothing that
settles it, and takes the gap out to a topic that does not exist yet —
created on the map, parked on its discussion queue, and added to this
specification's sources so the specification waits for it.

The prose should have taken this path:

1. the entry validates the completed source discussion and the
   in-progress specification item, and hands off to the processing
   skill
2. resume detection offers the choice and the user continues; session
   setup resets both gate modes to `gated` and finds no stale rows
   and no consult references; construction finds the source
   incorporated and nothing left to extract — no content is
   re-presented — and the epic's document-dependencies step runs
   between construction and review, as it does on every epic
   specification
3. review cycle 1 initialises — `review_cycle` set to 1 with the
   construction baseline word count in the same write, committed.
   Claims verification runs first and returns clean through its stub
   with no tracking file
4. input review runs next and returns one finding through its stub,
   having written the c1 input tracking file; the tracking entry
   records `in-progress` and commits; the findings summary renders
   from the tracking file
5. the finding's Category is Unsourced decision, so the dispose keeps
   it as a `route`: it is never presented at a batch screen and never
   at a finding gate, and nothing of it is applied to the
   specification. The route names behavioural-ranking — this
   specification's one source — as the document that should own the
   missing decision
6. classification lands on the no-sides branch: the record frames no
   alternatives to choose between, so the conflict gate is never
   rendered. The derivation is attempted first and runs out — nothing
   in either discussion, the discovery session log, or the tree pins
   a weighting, and no measurement can break the tie because
   relevance measurement is an unexplored topic with no evaluation
   set behind it. The tie-break is product intent, which is never
   invented here
7. so the session **STOPS** conversationally and puts the question to
   the user — what the specification asserts, what was searched and
   where the record ran out, what the answer unlocks — taking a
   stance. No engine surface renders for this: it is an exchange, not
   a gate, and the gate mode is `gated`, so no auto-override
   announcement is owed either
8. the user's answer shows the question needs more than this session
   can give — a room, the merchandising lead, and something to score
   a change against — so the session takes the gap exit rather than
   landing an answer. Nothing is written into the behavioural-ranking
   discussion
9. the gap exit re-reads the spec item's status first and finds it
   live, then raises the engine-rendered gap acknowledgement in its
   gap-route variant: what is missing, what was searched, what cannot
   be written until it is decided, and — this being an epic — a menu
   that names the reopen's cost and asks `Reopen it?` over three
   homes: reopening behavioural-ranking with the gap and pausing
   here, opening a new topic on the map, and parking it on the
   roadmap
10. the user takes the new topic row. The session proposes a kebab-case
    name derived from the gap and **STOPS** for the user to confirm
    or rename it; the user confirms `signal-weighting`
11. the triage landing resolves the target against the live map,
    finds no row, and creates one through the shared topic-creation
    core: the name is validated against the map and the dismissed
    list, then the discovery item is written routed at the landing
    phase — `discussion`, because what is owed is a decision — with
    provenance `reroute:behavioural-ranking`
12. the concern is written to the topic cache in the triage entry
    shape and delivered by the engine, which creates the
    signal-weighting discussion item as `triaged` — parked, never
    started — installs the concern as the first numbered file in its
    queue, and commits the delivery itself. The concern carries the
    gap's full context, written by the delivery rather than by hand
13. on `landed`, the new topic is added to this specification's
    sources with status `pending` — the row that holds the
    specification shut until that discussion concludes and makes
    construction extract it when the specification resumes
14. the specification pauses in-progress: the pause commit runs and
    carries the pending sources row the manifest gained after the
    delivery's own commit; the user is told the specification is blocked until
    signal-weighting concludes, and nothing further runs — the
    remaining review, the conclusion, and any re-run of document
    dependencies all stop here. The cycle-1 input tracking entry is left
    `in-progress`, its finding still Pending: the exit does not
    return, and the remaining work re-processes at the next entry
15. the session invokes the epic's continue skill with the work unit —
    the walk stops there

The end world's claims:

- the discovery map carries a fourth topic, `signal-weighting`,
  routed `discussion` with `source: reroute:behavioural-ranking`; the
  three original topics stand as they were
- a discussion item named `signal-weighting` exists with status
  `triaged` — parked, never started — and one engine-numbered file
  sits in its triage queue carrying the gap: what the weighting
  decides for a shopper, what was searched, and why nothing in the
  epic settles it
- the behavioural-ranking discussion item still reads `completed` and
  its document file is byte-identical to the fixture's — no timeline
  entry, no new subtopic, no edits of any kind. The
  synonym-handling discussion is untouched in both item and document
- the behavioural-ranking specification item reads `in-progress` —
  never completed, never cancelled — with
  `sources.behavioural-ranking.status` still `incorporated` and
  `sources.signal-weighting.status` `pending`
- the specification's own content is untouched: the 30/70 weighting is
  still on the page, unchanged and uncorrected. Nothing about this
  exit edits the specification — the decision is owed elsewhere
  first. A Dependencies section, which the epic's own step adds
  between construction and review, is the one addition the pass is
  allowed to have made
- the pending row is load-bearing, not bookkeeping: the specification
  is now shut at its own door. `render entry-gate
  search-relevance.specification.behavioural-ranking` answers with
  the not-concluded blocker naming `signal-weighting`, and the epic
  gateway's DATA lists the specification under `spec_blocked` with
  that topic as what it waits on. A world where either reads clear
  has a pending row nothing enforces
- the c1 input tracking file is on disk with its one finding still
  Pending, and the manifest's tracking entry for it still reads
  `in-progress`
- `finding_gate_mode` and `construction_gate_mode` both read `gated`;
  neither was ever set to auto
- the project manifest has no roadmap node: the gate's park
  destination was offered and not taken
- the git history ends at the self-committed triage delivery followed
  by the pause commit; nothing is left dirty
- the user was asked exactly three things in this walk: the resume
  choice, the unmade decision (in conversation, not at a gate), and
  the gap gate — plus the one confirmation of the new topic's name.
  They were never asked to classify the problem, never offered sides
  to pick between, and never asked to approve a finding
