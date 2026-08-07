The prose should have taken this path:

1. the entry finds no discussion recorded, takes the new-entry arm,
   no-ops the discovery-item ensure for a feature, checks the session
   log's Exploration and finds a usable carrier — asking the user
   nothing — and hands off with session identity only
2. the process reads the status again, finds no discussion file, and
   starts fresh — no resume choice is put to the user
3. initialisation reads its inputs — the empty seed, the carrier's
   description and Exploration, the research status (none) — then
   registers the discussion through the engine before the file exists,
   creates the file from the template, seeds initial subtopics on the
   map as pending, and commits once
4. the guidelines load, and the knowledge base is addressed once as a
   contextual query; with an empty store the session proceeds silently
5. the session loop's triage check no-ops on an empty queue — no commit, nothing
   surfaced
6. the session runs as an organic conversation: subtopics move through
   their lifecycle by engine calls as the discussion progresses, and
   the file grows per-subtopic sections — context, options, journey,
   decision — at natural pauses, each write committed through the
   engine, never batched
7. after meaningful content lands the review checkpoint fires: each
   dispatch is recorded through the engine, the harness stub stands in
   for the background agent's report, and the discussion continues
   without waiting. More than one cycle is legitimate — a drained
   review re-arms once further meaningful commits land
8. each returned report is found on a later check, read, and — carrying
   no findings — acknowledged clean in one engine call: no announce
   menu is rendered, no finding is ever surfaced
9. the unpaid-order expiry window is raised as a concern of this topic,
   held open at the user's insistence rather than decided; on their
   wrap-up the concluding flow reads the map through the gateway, shows
   the undecided count, and on their confirmation defers the unresolved
   subtopic(s) in one engine write — the batch form, not a per-subtopic
   loop — noted under the Summary's open threads
10. the closing gates then hold: with every review row incorporated, the
    movement read drops the `(deferral)` commit the conclusion just
    authored and classifies whatever remains. Both outcomes are correct
    and either is a pass — `satisfied` when every subtopic write-up
    landed before the last review dispatched, so the window comes back
    empty; `re-review` when one landed after it, since a subtopic
    explored since the last review is real movement, and the optional
    offer of another final review then renders and is declined.
    Nothing in the prose fixes which side of the review dispatch a
    write-up falls on, so the
    classification is not a property this case pins. What must hold on
    both routes: the conclude ask is reached and answered yes, the
    in-flight agent check runs, and the walk stops there — the final
    review step never executes, document review and the compliance check
    never load, and the discussion is not completed

Further claims:

- nothing the carrier records is re-asked — the discussion builds on
  the shaped context (card payments, existing gateway, card-only v1)
  rather than re-eliciting it
- wallets never become working material: card-only v1 is settled
  background the user waves off, not a concern to preserve — no wallet
  subtopic, no off-topic routing, nothing sent to the inbox
- the Discussion Map lives in the manifest only — the discussion file
  never contains a map section
- no perspective agents are offered or dispatched: the user's decisions
  are confident, so the ambiguity trigger never fires
- cache files under `.workflows/.cache/` — the agent reports and agent
  state — are expected working artifacts

EXPECTED WORLD — from a feature holding only its discovery carrier:

- a discussion file at `.workflows/pay/discussion/pay.md` carrying the
  discussion's substance: a context reflecting the carrier, per-subtopic
  sections whose decisions match what the user actually said — webhook
  capture over polling, orders left open for bounded retries, hosted
  fields keeping card data out of scope — a Summary noting the unpaid
  order expiry window as an open thread; the topic's triage queue is
  empty
- the manifest holding the discussion in progress with every subtopic
  settled — `decided` or `deferred`, none left pending or exploring —
  the subtopics the user drove to decisions all `decided`, and an
  expiry-window subtopic among the `deferred`; the discussion is NOT
  completed
- the agent store holding one or more review rows, every one
  incorporated
- no research, specification, planning, implementation, or review
  artifacts anywhere; the work-unit description unchanged; no second
  work unit
