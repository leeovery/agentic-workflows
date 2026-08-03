The prose should have taken this path:

1. the entry reads the discussion status for behavioural-ranking, finds
   it in progress, emits the resuming phase note, checks the reconcile
   flag (absent — silent), and hands off with source: existing
   discussion
2. the process renders resume detection and the user continues
3. initialisation is skipped: the walk reaches the guidelines,
   addresses the knowledge base once as a contextual query, and enters
   the session step
4. the session loop's triage check no-ops on an empty queue
5. the check-for-results scan finds the acknowledged row with three
   findings remaining, the announce menu is rendered — a count and the
   lane shape — and the user opts in
6. lanes run in order, so the apply lane goes first: a one-item batch
   screen rendered through the engine's finding-batch surface. The user
   approves, the Decision clause is struck, the finding is recorded and
   the write committed under its own subject marker
7. the decide lane is empty, so the route batch follows: a second
   finding-batch render, this time the route lane, naming each target
8. the user approves. Each concern is delivered through the shared
   triage landing into its target topic's queue — synonym-handling and
   relevance-measurement — carrying the context built here, and both
   ids are recorded in ONE surface call, which drains the row so it
   incorporates automatically

Presentation claims:

- the two batch screens are separate turns with a stop each; the apply
  screen never shows route items and the route screen never shows the
  applied one
- neither batch raises an item individually: no scene, no worked
  example, no per-finding question
- the route screen names each target topic against its item, so the
  user can see where each is going before approving

Further claims:

- the apply lane is cleared before the route lane is offered
- exactly one surface call carries both route ids — the concerns are
  not sent one at a time with a stop each
- each landing reopens or seeds its target topic's triage queue; this
  topic's own discussion file gains a reroute record for each, and
  neither sibling's discussion is entered or edited
- no fresh review dispatch, no ack, no incorporate call
- the walk stops after the sends; the conclusion gate is never entered

EXPECTED WORLD — the fixture plus: the Decision clause struck and
committed; a triage entry in each of synonym-handling's and
relevance-measurement's discussion queues; and the store row
`review-001` with all three findings surfaced, standing `incorporated`.
