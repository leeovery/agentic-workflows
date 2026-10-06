The prose should have taken this path:

1. the specification gate renders empty — the spec is complete (its
   revision re-completed) and the topic is clear to plan
2. the planning status reads completed, so the plan is reopened through
   the engine and the Reopening phase note for the plan heads the resume
   surface
3. the reconcile advisory reads the plan's `reconcile_needed` flag and
   finds `specification`: it surfaces the input-moved advisory — a
   non-blocking callout saying the specification was revised after the
   plan completed and that spec-change detection will walk the diff as
   the session resumes — and clears the flag; it never stops for input
4. spec-change detection reads the plan's recorded baseline and diffs
   the specification against it: the added refund section is reported
   as a change the session will reconcile
5. the continue-or-restart choice follows beneath, with no second
   heading of its own, and the walk stops there with nothing answered —
   no late-context question and no cross-cutting sweep, those being a
   fresh plan's

Further claims:

- the advisory is surfaced between the phase note and the resume
  choice, as an advisory only — the walk is never blocked on the user
  before the choice
- the flag is cleared exactly once, via manifest delete, and no other
  manifest field is touched by the advisory
- the knowledge base is never queried and never written
- the world's one change is the plan item: it reads in-progress, its
  reconcile flag gone; no commit lands and no file is written
