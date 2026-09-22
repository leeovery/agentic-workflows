The walk resumes a graphed plan into its review and processes three
integrity findings, disposing each staged move against the bar before
it renders: a settled call rides auto, a staged choice the
specification settles is rewritten settled and rides auto too, and a
staged choice whose whole substance is a mechanism the specification
never decided is declined as the builder's and never rendered at all.
After the opt-in, the user is stopped once more: at the plan's conclude
gate.

Expected path:

1. the entry's spec gate clears; the planning status reads in-progress
   and the handoff is the continuing variant
2. the process finds the planning entry; spec change detection diffs the
   specification against the plan's recorded baseline commit and writes
   the read, and the resume gate leads with it — unchanged; the user
   continues
3. session setup resets the gate modes to `gated` — no auto carries in
   from any earlier sitting
4. construction fast-paths: the existing structure is presented through
   the engine-rendered phase tree and confirmed; the graph step
   delegates to the grapher — stubbed, reapplying the existing edges
   unchanged — and the approval commits through the scoped plan commit
5. review cycle 1 initialises: `review_cycle` is set to 1 and the
   plan's word baseline recorded with it in one write, and the manifest
   committed. The traceability review is dispatched first and returns
   clean through its stub — no tracking file, its no-findings result
   announced — and only then is the integrity review dispatched, whose
   stub writes the cycle-1 tracking file with three findings; the
   orchestrator records the tracking entry `in-progress`, commits it,
   and renders the findings summary
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
8. **Finding 3 (staged as a choice — what the capture consumer keys a
   repeat delivery on)** is disposed before anything renders, and the
   dispose refuses it: its whole substance is a mechanism the
   specification never decided — what the duplicate key is derived
   from and where it is kept — and either side leaves the shopper the
   same order, marked paid once. The fork is the implementer's to
   settle with the code in front of them, so the plan prescribes
   nothing for it: Resolution set to **Declined** with that reason in
   Notes, the Move left as the reviewer staged it, the decline
   announced in a line, and the work committed. **Nothing is rendered
   for it and the walk does not stop** — the user never sees this
   finding, and no key is named anywhere in the plan
9. the tracking entry flips to `complete`; with `finding_gate_mode`
   `auto` and findings surfaced, the review runs a follow-up cycle
   without stopping — no re-loop gate renders. Both cycle-2 dispatches
   carry the cycle-1 integrity tracking file's path as the settled
   directions a finding may not reverse, and both agents
   return clean through the stub, in order, and the review completes
10. the compliance self-check refreshes the session's instructions; the
    conclusion asks the engine what the plan is waiting on first — the
    wait gate comes back empty, so no blocker and no pause menu is
    emitted — then the conclude gate is put to the user and, on their
    yes, the plan completes through the engine first and the spec
    baseline is re-stamped after it, the final commit lands, and the
    walk stops at the pipeline continuation without invoking the bridge

Also true:

- exactly **two** `render finding` calls are recorded in the whole
  walk. A third means the declined finding was put to the user after
  all, which is the acceptance rate this decline exists to break
- the Create Payment Intent task carries acceptance criteria stating
  card-only, a gateway rejection surfacing as a user-visible checkout
  error, and a duplicate checkout start reusing the existing intent
- the Attach Intent To Order task states that a retried checkout reuses
  the intent already attached to the order — never the
  fresh-intent-per-attempt side
- the declined finding never touched the plan: the Handle Capture
  Webhooks task names no key, no side table and no stored state, and
  its text is what the fixture left. A task that now names one means a
  mechanism the specification never decided was written into the plan
- the tracking file's first two rows end Resolution Fixed and Move
  `settled`, neither carrying Options: row 2's Proposal names the
  specification's duplicate-start rule as what decided it, and carries
  a Proposed Text. A row still reading Move `choice` with an option
  noted in Notes means the walk stopped on a call the dispose owed
- the third row ends Resolution **Declined**, the reason recorded in
  Notes and its Move still `choice` as staged, with no Proposal and no
  Proposed Text — nothing was written on the reader's behalf
- no row reads Pending or Skipped
- after the user opts into auto at finding 1, they are stopped exactly
  once more — at the plan's conclude gate. No finding stops after
  finding 1, no auto-override line appears, no choice menu renders, and
  no re-loop gate renders
- no traceability tracking file exists — that review returned clean —
  and the manifest's tracking subtree holds the integrity entry alone
- the specification is untouched; nothing reopens, restarts, or
  triages; no second work unit exists
- the user is never asked to approve the same finding twice
