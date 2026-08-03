The prose should have taken this path:

1. the specification gate renders empty — the spec is complete (its
   revision re-completed) and the topic is clear to plan
2. the plan exists and is completed, so the validate-phase completed
   arm reopens it and emits the Reopening phase note
3. the reconcile advisory reads the plan's `reconcile_needed` flag and
   finds `specification`: it surfaces the input-moved advisory — a
   non-blocking callout saying the specification was revised after the
   plan completed and that spec-change detection will walk the diff at
   resume — and clears the flag; it never stops for input
4. cross-cutting context is gathered: no cross-cutting work units
   exist, then the knowledge base is queried for completed
   cross-cutting specs
5. hands off to the planning processing skill for pay with an existing
   plan

Further claims:

- the advisory is surfaced between the phase note and the handoff, as
  an advisory only — the walk is never blocked on the user
- the flag is cleared exactly once, via manifest delete, and no other
  manifest field is touched by the advisory
- the knowledge base is queried, never written to, by an entry skill
