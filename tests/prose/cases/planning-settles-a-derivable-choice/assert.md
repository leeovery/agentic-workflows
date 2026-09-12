The walk resumes a graphed plan into its review and processes three
integrity findings, disposing each staged move against the bar before
it renders: a settled call rides auto, a staged choice the
specification settles is rewritten settled and rides auto too, and a
staged choice that is a fork in the how — nothing leaning — is settled
on the planner's honest call and rides auto as well. After the opt-in,
the user is stopped once more: at the plan's conclude gate.

Expected path:

1. the entry's spec gate clears; the planning status reads in-progress
   and the handoff is the continuing variant
2. the process finds the planning entry and offers the resume; spec
   change detection diffs the specification against the plan's recorded
   baseline commit and reports it unchanged; the user continues
3. session setup resets the gate modes to `gated` — no auto carries in
   from any earlier sitting
4. construction fast-paths: the existing structure is presented through
   the engine-rendered phase tree and confirmed; the graph step
   delegates to the grapher — stubbed, reapplying the existing edges
   unchanged — and the approval commits through the scoped plan commit
5. review cycle 1 initialises through the engine; the traceability
   review is dispatched first and returns clean through its stub — no
   tracking file, its no-findings result announced — and only then is
   the integrity review dispatched, whose stub writes the cycle-1
   tracking file with three findings; the orchestrator records the
   tracking entry `in-progress`, commits it, and renders the findings
   summary
6. **Finding 1 (settled — the intent task's acceptance criteria)** is
   disposed and stands settled: the specification's Payment Intent
   section decides the criteria, and the session can stand behind the
   fix. It is presented at the gate, leading with what the plan would
   build wrong and the call the specification determines, with the
   diff. The user answers `auto`: the fix is applied to the Create
   Payment Intent task through the format adapter, its Resolution set
   to Fixed, `finding_gate_mode` set to `auto` on the manifest, and the
   work committed
7. **Finding 2 (staged as a choice — reuse or re-mint on a retried
   checkout)** is disposed **before it renders**, and falls below the
   bar on irreducibility: the specification's Payment Intent section
   decides that a duplicate checkout start reuses the existing intent,
   and a retried checkout is a second start for the same order, so the
   record yields exactly one answer. The session runs the search the
   agent never named and finds it there; the staged recommendation is
   not the ground. It rewrites the tracking row: Move `settled`, a
   Proposal carrying that derivation and naming the specification's
   duplicate-start rule, the Options removed, Current and Proposed Text
   supplied in plan format for the Attach Intent To Order task. Then it
   renders the finding with move `settled` under `auto`: the fix is
   applied to that task, its Resolution set to Fixed, and announced in
   a line — **no stop, no choice menu, no auto-override line**
8. **Finding 3 (staged as a choice — what makes two deliveries the same
   delivery)** is disposed before it renders and falls below the bar on
   a different prong: the fork is in how the plan achieves idempotency,
   never what the customer gets — the order is marked paid once either
   way — and the search the row names holds: no specification rule, no
   plan convention, no measurement leans. The session settles it on its
   honest call: it rewrites the row Move `settled`, a Proposal that
   names the call as the planner's own and states what it weighed, the
   Options removed, Current and Proposed Text in plan format naming one
   key in the Handle Capture Webhooks task. Then it renders the finding
   with move `settled` under `auto`: applied to that task, Resolution
   Fixed, announced in a line — no stop
9. the tracking entry flips to `complete`; with `finding_gate_mode`
   `auto` and findings surfaced, the review runs a follow-up cycle
   without stopping — no re-loop gate renders. Cycle 2's two agents
   return clean through the stub, in order, and the review completes
10. the compliance self-check refreshes the session's instructions, the
    conclude gate is put to the user and, on their yes, the spec
    baseline is re-stamped, the plan completes through the engine, the
    final commit lands, and the walk stops at the pipeline continuation
    without invoking the bridge

Also true:

- the Create Payment Intent task carries acceptance criteria stating
  card-only, a gateway rejection surfacing as a user-visible checkout
  error, and a duplicate checkout start reusing the existing intent
- the Attach Intent To Order task states that a retried checkout reuses
  the intent already attached to the order — never the
  fresh-intent-per-attempt side
- the Handle Capture Webhooks task names exactly one idempotency key,
  in plan format — which one is the planner's call and is not pinned
  here
- the tracking file's three rows all end Resolution Fixed and Move
  `settled`, none carrying Options: row 2's Proposal names the
  specification's duplicate-start rule as what decided it; row 3's
  Proposal names the call as the planner's own and states what it
  weighed; both carry a Proposed Text. A row still reading Move
  `choice` with an option noted in Notes means the walk stopped on a
  call the dispose owed
- no row reads Declined, Pending, or Skipped
- after the user opts into auto at finding 1, they are stopped exactly
  once more — at the plan's conclude gate. No finding stops after
  finding 1, no auto-override line appears, no choice menu renders, and
  no re-loop gate renders
- no traceability tracking file exists — that review returned clean —
  and the manifest's tracking subtree holds the integrity entry alone
- the specification is untouched; nothing reopens, restarts, or
  triages; no second work unit exists
- the user is never asked to approve the same finding twice
