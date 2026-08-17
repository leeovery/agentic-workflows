# Implementation: End-of-Phase Consolidation — the bank, the boundary pass, the seeded backstop

**Status:** built — stack #911 awaiting review. The build notes below
record where the build diverged from the sketch.

The implementation phase gets a consolidation pass at every phase
boundary — a sweep over what the phase just built that the plan could
not have authored, because the opportunities only exist once the
phase's tasks have landed. Fed by a running bank of refactor
opportunities the executor and reviewer deposit as they work, judged
by the orchestrator, authored by the existing task-writer, executed
by the normal task loop. Design log for the stack. Opened 2026-08-15
from idea 40 (`ideas/implementation-end-of-phase-pass.md`), evidence
from Portal's `theming-system` feature.

## Motivation (2026-08-15)

- **The per-task reviewer already spots it; nobody owns acting on
  it.** "This could be dried up" gets raised against one task, the
  fix belongs to several, and the task loop has no slot for work the
  plan didn't name. Noted and dropped.

- **The plan cannot author the fix.** Cross-task duplication,
  helpers that should be shared, complexity that only shows at phase
  scale — none of it exists until the phase's tasks have landed.

- **The global machinery that exists instead does not converge.**
  `theming-system` carried **38 de-duplication tasks of 176** across
  seven `Analysis (Cycle N)` phases. Findings per cycle:

  ```
  c1 22 → c2 16 → c3 18 → c4 18 → c5 13 → c6 14 → c7 19
  ```

  Flat — cycle 7 out-yielded cycle 2. Cycle 4's own report notes the
  three analysis agents "landed on disjoint surfaces": each cycle
  finds new ground rather than closing old. Seven cycles consumed
  ~90 of 176 tasks, and the review that followed still found **232
  more findings of the same class**. The feature's own review triage,
  deciding what to do with 191 duplication findings, concluded
  independently: *"one deliberate consolidation pass, not 191
  separate edits."*

- **The structural reading**: the analysis loop is scoped globally
  and timed late, so it rediscovers instead of draining. A
  phase-boundary pass acts while the phase is fresh and its context
  loaded, instead of accumulating debt for a global sweep that never
  catches up.

## The Design (agreed 2026-08-15)

### The bank

A running ledger of refactor opportunities, durable across the whole
implementation. Fed continuously during the task loop by the executor
and the reviewer; also by the boundary finder for pre-existing-debt
findings it may not act on (tagged as such). Drained twice:

- each phase's boundary pass takes everything **that phase caused**;
- the end-of-implementation analysis loop consumes the **residue** as
  seed input for its first cycle — the cold start removed. Today
  every cycle starts from zero; seeding is the one adaptation the
  analysis loop takes.

Entries beyond even the work unit's remit **drop** — recording what
nothing consumes is noise, not diligence.

### Who acts, who banks

- **Executor** — a fix that lies entirely within its own task's
  surface: act now, that is just writing good code, no banking. A fix
  that touches another task's output or the phase's shared surface:
  bank, never act. Reaching across task boundaries mid-loop blurs
  review scope (the task-reviewer can no longer tell what belongs to
  the task) and risks trampling a sibling task's ground. Mirrors the
  review phase's contained/spreading doctrine, one phase earlier.
- **Reviewer** — banks only. It never writes code today; that stays.

### The boundary

Fires when the task loop's phase-completion check finds no open tasks
in the current phase, **before** `--phase-complete` is recorded. The
invariant is structural: a phase only ever completes consolidated.
Crash-resume falls out of existing task-loop machinery, and the next
phase's tasks never interleave with consolidation work.

### One finder agent

A single new agent — the only new agent in the design. Input: the
phase's commit range (identifiable via the
`{topic}-{phase_id}-{task_id}` internal ID convention), the bank, and
the remit + exclusion bar baked into its charter. Output: findings —
each naming its class, its evidence, its proposed consolidation
shape, and which banked entries it confirms or moots against the
phase's final state (a later task may have mooted an early deposit).

One agent, deliberately not per-class fan-out: the classes overlap
heavily (a near-miss helper *is* duplication), and per-class agents
recreate the disjoint-surfaces problem the analysis cycles
demonstrated. Fresh context is the point — the same reason analysis
runs in agents rather than the loaded session.

### The remit — seven classes

The discriminator: things only visible once sibling tasks' outputs
sit side by side — what the plan structurally could not have
authored.

1. **Cross-task duplication** — the same logic landed twice because
   two tasks each needed it. The `theming-system` core class.
2. **Near-miss helpers** — two similar-but-not-identical utilities
   that should be one; fresh code duplicating an *existing* helper it
   should have called.
3. **Consistency drift** — the same operation done different ways
   across tasks: error-handling shape, naming for the same concept,
   parameter conventions. Flagged at design time as the
   likeliest class to creep — judgment-heavy; watch it.
4. **Accretion complexity** — a function or module several tasks
   appended to, whose final shape now wants decomposition.
5. **Dead code from supersession** — scaffolding, stubs, exports task
   N built that task N+3 obsoleted.
6. **Comment accuracy against final state** — comments describing
   mid-phase behaviour later tasks changed; TODOs the phase itself
   resolved.
7. **The bank** — each entry re-verified against the phase's final
   state, then folded into the same task design.

### The exclusion bar

- **No behaviour change.** Pure refactor: tests stay green, test
  semantics untouched.
- **Cause vs subject.** Every finding must be *caused by the phase's
  changes*; the *fix* may reach outside the diff. Consolidating
  phase-duplicated logic into a pre-existing helper — touching its
  existing call sites if the merge needs it — is in-remit. A refactor
  whose subject is wholly pre-existing code the phase merely sat next
  to is out: banked, tagged pre-existing, left for the analysis loop.
- **No architecture re-litigation.** Cross-phase structural patterns
  stay the analysis loop's remit.
- **The plan-authorable test.** A finding that *could* have been in
  the plan — a missed requirement, a design gap — is not
  consolidation. It routes through the ad hoc plan change path with
  its own gate.

### Orchestrator judges, task-writer authors

The finder proposes; the orchestrator disposes. The orchestrator is
the only party holding session context — what the user deliberately
deferred, what an ad hoc change already settled, what a finding would
trample. It applies the exclusion bar, dedups, and folds the
survivors into task-shaped units at normal planning granularity — no
giant single task; the count is dictated by the work, never capped.

No synthesizer stage: synthesis exists to merge several agents'
outputs; with one finder the orchestrator judges directly.

The existing `workflow-implementation-task-writer` authors the
approved set into the **current phase** via the plan's format
adapter — the same path the analysis loop already uses. Charters stay
narrow: the orchestrator never writes tasks, the task-writer never
judges.

### The gate

Standard phase-gate shape: gated, automatable, same as the other
phase gates.

### No re-loop

One pass per boundary. When the consolidation tasks complete (through
the normal executor → reviewer loop like any task), the next phase
begins — no re-check. Re-checking is "loop until clean" reborn at
phase scale, the exact failure mode this design exists to kill;
agents always find something. The guards are structural, not
convergent:

1. the consolidation tasks are themselves executed and reviewed;
2. anything the reviewer banks *during* consolidation stays in the
   bank — it is a running ledger, not phase-scoped;
3. the analysis loop — kept unbounded, deliberately — is the terminal
   backstop.

The two mechanisms cover each other's tails: phase passes drain the
bank of what each phase caused; the analysis loop catches what
escaped, seeded by the ledger instead of cold. Neither needs to
converge alone.

### What does not change

The end-of-implementation analysis loop keeps its shape and its
unbounded cycle count — it exists for cross-phase seams and residue,
and the expectation is that phase passes shrink its findings
naturally, not that a cap forces them down. Its only edit is the
seeded first cycle. The review phase downstream is untouched and
should simply see less duplication to triage.

## Build plan

- **PR1** — this design log.
- **PR2** — the bank: storage, engine surface, entry shape, the
  feed/drain lifecycle.
- **PR3** — executor and reviewer charter edits: act-in-scope /
  bank-cross-scope.
- **PR4** — the boundary: finder agent, task-loop boundary step, the
  gate, the task-writer path into the current phase.
- **PR5** — analysis-loop seeding from the residual bank.

Rough — the stack is as deep as the work needs. Tests ride each
layer: pipeline simulation for engine changes, prose case(s) for the
boundary flow.

## Open at build time

- Bank storage and shape — manifest field vs file under the
  implementation directory; whether entries get engine numbering;
  what an entry carries (class tag, origin task, evidence, pre-existing
  flag).
- The gate's render surface and wording.
- The finder agent's name.

## Build notes (2026-08-15)

- **The bank needs no engine storage code.** The review phase's
  `out_of_scope` set is the exact precedent: a plain array field
  written with the generic `manifest push` (objects JSON-parse on the
  way in, `pull` removes by deep equality), semantics entirely
  prose-owned, render surfaces receiving counts as integers. The bank
  mirrors it: `implementation.{topic}.bank`, entries
  `{task, source, summary, detail, files}` (the finder's pre-existing
  debt entries carry `{source: "finder", pre_existing: true}` and no
  task), deposited the moment each executor or reviewer report
  arrives (task loop B/D). PR2 becomes the feed (charters + deposit),
  not an engine surface.
- **Staging reuses the guarded container.** `staging.<key>.tasks.<n>`
  validation is key-generic, so the boundary walk records approvals
  under `staging.p{N}` beside analysis's `staging.c{N}` with no
  engine change; the `tasks-overview` and `proposed-task` render
  surfaces are payload-driven and serve the boundary gate as-is. The
  one real engine touch left is `consolidation_gate_mode` joining the
  session-reset set in `initTasks`.
- **The seed rides to the synthesizer, not the analysis agents.**
  Analysis dispatch has a hard clean-context rule (priming biases
  results; cross-cycle synthesis lives in the synthesizer by design),
  so the residual bank becomes a synthesizer input, verified against
  current code before proposal — and when the analysis agents return
  clean while residue exists, the synthesizer still runs, over the
  residue alone.
- **The boundary lives in the task loop's stage H**, keyed on
  `completed_phases` vs a `consolidated_phases` marker: a phase whose
  tasks are done but which is not yet consolidated defers both the
  plan-side phase-completion transition and `--phase-complete`,
  detours to the pass, and records completion once the pass (and any
  tasks it authored, via the task-writer's existing `per-task`
  placement into the still-open phase) has landed. A retrieve-side
  guard re-enters an interrupted pass: no task from a later phase
  starts while the current phase sits complete-but-unrecorded.
  Synthetic remediation phases (`Analysis (Cycle N)`,
  `Review Remediation`) never take the detour.

## Review pass (2026-08-16/17)

Two full finder fleets over the built stack reshaped four contracts;
the rest of the findings were mechanical and landed in the owning
PRs.

- **Deposits are per report, not per milestone.** Every executor or
  reviewer report carrying BANK deposits on arrival (task loop B/D) —
  no verdict path, fix round, or crash can drop an entry; near
  duplicates are folded by the boundary pass.
- **The placement contract survives every format.** The task-writer
  carves one exception for a prompt-declared consolidation-boundary
  placement; tick reopens `done` ancestors when an open child is
  created under them (verified by live probe — parent and topic both
  reopen), local-markdown's derived phase state self-corrects, linear
  defers natively. A writer refusal halts loudly at E, with resolve
  and abandon arms.
- **The fix gate lost `skip`.** A needs-changes review resolves by
  fixing or by challenge: a fresh confirmation reviewer adjudicates
  the disputed findings (stands/withdrawn, verdict recomputed);
  beyond-scope withdrawals return under BANK, and the original
  review's comment corrections still apply on the approved arm.
- **Quick-fix never takes the boundary** — its plan never grows
  (`ad-hoc-plan-changes.md`'s ceiling doctrine), enforced at H's
  disposition and backstopped in the pass prelude.

Accepted residue: a crash between the task-writer landing tasks and
E's tail resolves through H's `completing` — the folded bank entries
ride to the analysis synthesizer (which verdicts them against code
and discards the done ones) and the session-memory list of
plan-authorable set-asides is lost, as any non-durable list is. The
findings path (B–E) and the challenge branch have no prose-test case
yet.
