The walk runs an implementation loop to its first task gate, where the
user puts a capability aside and names where it goes. The words place
it, so the backlogging door parks it in one verb over a project that
has no roadmap yet, and the interrupted gate comes back unanswered.

The prose should have taken this path:

1. the code slot reads free and the plan gate renders empty; dependency
   validation returns immediately — external dependencies are an epic
   concern — and the implementation status reads empty, so this is a
   first start: tracking is initialised and the start of implementation
   commits through the engine's scoped commit — no phase note, never the
   resuming note
2. environment setup finds the existing document stating no setup is
   required and returns without asking anything and without writing it
   again
3. the plan adapter is loaded for the manifest's format; project
   skills and linter discovery each ask only their skip-again question
   — the first two scripted answers skip both,
   each recording its empty set on the topic
4. the loop selects pay-1-1 first (phase order, then task order),
   normalises it, starts it via the engine, marks it in-progress, and
   renders its brief before the dispatch
5. the executor stub fires for pay-1-1 and returns complete; the
   reviewer stub fires and approves; the result header renders and the
   task gate menu is fetched and emitted
6. the third scripted answer does not answer the gate — it puts a
   capability aside and says where. The implementation skill's standing
   `## Backlogging` section routes to backlogging.md with work_unit
   `pay`, topic `pay`, phase `implementation`; the pending gate is
   left to re-present on return
7. **A. Which Backlog** reads the user's own words and finds a horizon
   named in them, so the park is the route. The ambiguity gate is
   never written and never rendered — the home was never in question —
   and the horizon step is never entered, because the horizon is
   already the user's. No roadmap state is read to get there
8. **C. Park** derives a kebab-case name, a one-line summary at
   capability grain — the shopper's saved card, not this task's
   mechanics — and the kind `idea`, since saved cards are a
   capability, nothing broken; and takes the source from the phase
   table:
   implementation points at the specification, so the source is
   `pay/specification/pay/specification.md`
9. the confirm renders through the engine carrying the name, the
   kind, the horizon, the summary and that source. There is no roadmap, so the
   statement says the roadmap is created with the item and the
   horizon carries no `(new)` flag — the flag speaks to a map that
   exists and this one does not. The walk **STOPS**
10. on the fourth scripted answer the park is one engine call:
    `roadmap add {name} --kind idea --horizon "Next" --summary "…"
    --origin park:pay --source pay/specification/pay/specification.md`. The
    verb validates, births the roadmap node and the horizon
    just-in-time, and commits the project manifest itself — no commit
    call follows it, and the roadmap skill is never invoked
11. implementation keeps no running record, so nothing is noted in any
    document; the user is told in one line what was parked and where
12. control returns to the caller. The interrupted flow is the task
    loop at its gate, which the aside set aside: the session asks in
    conversation — no gate, no menu — whether the user is ready to move
    on, and the walk never falls through to the skill's Step 0. The
    walk STOPS
13. the fifth scripted answer says they are ready — never the gate's
    answer — so the gate is re-fetched from the engine and re-presented,
    never replayed from memory. It stops there: the gate unanswered, pay-1-1 never
    completed, no further task started

The end world's claims:

- the project manifest carries a roadmap node it did not have before:
  one horizon, the user's own word for it, holding exactly one item —
  a kebab-case capability name for saved cards, `kind: idea`,
  `origin: park:pay`, a summary that reads as the capability rather
  than as this task's business, and `pay/specification/pay/specification.md` as its one
  source. The item carries no `pulled_to`: it is waiting, joined to
  nothing. No second horizon and no second item exist
- the park left the work unit alone. The implementation item still
  carries `current_task` pay-1-1 with no `completed_tasks` entry and
  no staging subtree; the planning item, the plan document and every
  task file carry no note of the parked capability; and the
  specification document is byte-identical to the fixture's — the
  park points at a record, it does not write to one
- no file exists anywhere under `.workflows/.inbox/`: the words placed
  the idea, so the inbox was never the question, and no capture skill
  ran
- the git history carries the engine's own roadmap commit over the
  project manifest. The source and test files the executor stub wrote
  for pay-1-1, the work-unit manifest carrying the task in progress, and
  the pay-1-1 task file are uncommitted — the loop commits them past
  its gate, which was never answered — and they are the only dirt in
  the tree
- exactly one executor dispatch and one reviewer dispatch fired, both
  stubbed, both for pay-1-1
- the stops the user met were the two setup skip-again questions, the
  task gate, and the park confirm. They were never asked which
  backlog, never shown a list of horizons, and never asked to approve
  the task a second time
