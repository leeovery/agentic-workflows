# Implementation: End-of-Phase Consolidation — the bank, the boundary pass, and the analysis loop's floor

**Status:** built — stack #911 (2026-08-17); revised by the 2026-09-09
stack: the bank confined to one plan phase, a consequence floor on
every finding, settled directions read from the record, the cycle
gate keyed to lifetime.

The implementation phase gets a consolidation pass at every plan-phase
boundary — a sweep over what the phase just built that the plan could
not have authored, because the opportunities only exist once the
phase's tasks have landed. Fed by a bank of refactor opportunities the
executor and reviewer deposit as the phase's tasks run, judged by the
orchestrator, authored by the existing task-writer, executed by the
normal task loop, and emptied when the phase closes. The
end-of-implementation analysis loop runs after the plan on its own
findings alone, under the same floor and the same settled directions.
Opened 2026-08-15 from idea 40
(`ideas/implementation-end-of-phase-pass.md`), evidence from Portal's
`theming-system` feature; revised on evidence from Portal's
`resume-hooks-silently-lost` bugfix.

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

## Evidence from the first build (2026-09-09)

Portal's `resume-hooks-silently-lost` bugfix ran the built stack end
to end: 23 plan-authored tasks in five phases, then the machinery.

- **The boundary pass did what it was built for.** Five passes,
  27 tasks, 23 of them work a senior engineer would do unprompted,
  none out of the spec's remit, net −134 lines of code.
- **The analysis loop ran away.** Four cycles proposed 25, 35, 49
  and 52 tasks — 161 in all, every one approved under auto. The
  three agents' own findings fell 22 → 22 → 18 → 13. What grew was
  the bank handed to the synthesizer each cycle: 39 → 121 → 130 →
  117. Tasks in an analysis-made phase deposit into the bank like
  any task, an analysis-made phase takes no boundary pass, so the
  only consumer of those deposits was the next cycle's synthesizer,
  whose test was "still true in the tree". At roughly two and a half
  deposits per task and a rising conversion (24% → 33% → 40%), each
  task begat one task before the agents' findings were counted.
- **The work was mostly the machine consolidating its own
  scaffolding.** By cycle 4, 77% of proposals concerned artefacts an
  earlier machine-made phase had created; test files grew by 92 and
  source-scanning guard tests from 26 to 58 during "consolidation";
  twelve chains reversed or reworked a direction an earlier cycle had
  settled; two production regressions were introduced by the loop
  and caught by it two cycles later. Every synthesizer report from
  cycle 3 on opened by declaring the hook machinery sound.
- **The findings that reached the walk had no floor.** Renaming
  test files to a convention, a vacuous clause in a comment, a stale
  method name in a log string, two fixture helpers with different
  names, 222 fixtures setting a variable a helper already set. Each
  was true; none named a failure it prevented. Duplication is
  scale-free — two similar things can always be found — so a sweep
  without a consequence floor cannot terminate.
- **The loop's one stop button never appeared.** The cycle gate
  counted cycles per session and every session restart reset it, so
  four cycles across four sessions never tripped the limit of three.

## The Design

### The bank — born and consumed inside one plan phase

A ledger of refactor opportunities, scoped to the plan phase whose
tasks deposit it.

- **Deposited** while a plan phase's own tasks run: every executor
  report, reviewer report, and confirmation withdrawal carrying BANK
  entries deposits on arrival (task loop B/D and the confirmation
  round), so no verdict path, fix round, or crash drops one.
- **Switched by the engine.** `task start` answers `do_banking`,
  derived from the manifest: the work unit is not a quick-fix, the
  task's phase is not in `machine_phases`, not in
  `consolidated_phases`, and its boundary walk (`staging.p{N}`) does
  not exist. `machine_phases` is written by the flow that lands a
  machinery-created phase — the analysis loop's task creation and the
  review loop's remediation landing each push the phase number — so
  the engine keys on the same fact the prose reads from the phase
  label. Plan-authored tasks get `true`, a plan phase added after the
  analysis loop began included; consolidation tasks, analysis-cycle
  tasks and review-remediation tasks get `false`. The prose loads the
  deposit reference only when the flag is true — the loop is
  bank-blind everywhere else, by progressive disclosure rather than
  by a rule the loop has to remember.
- **Consumed** by the phase's boundary finder, which verdicts every
  entry against the phase's final state: caused by this phase and
  still real → folded into a finding; anything else → gone. The pass
  ends with the bank deleted on every path — a clean sweep, a walk
  that declined everything, tasks landed. Conclude keeps a backstop
  delete for a pass interrupted mid-way.
- **Never carried.** No residue, no pre-existing-debt deposits, no
  entry crosses a phase boundary, nothing seeds the analysis loop,
  and nothing is recorded as an observation anywhere. Debt a phase
  merely sits beside is rediscovered by a later phase's pass if that
  phase touches it and it is still real; if no phase touches it, it
  was not this work unit's to fix.

### Who acts, who banks

- **Executor** — a fix that lies entirely within its own task's
  surface: act now, that is just writing good code, no banking. A fix
  that touches another task's output or the phase's shared surface:
  bank, never act. Reaching across task boundaries mid-loop blurs
  review scope (the task-reviewer can no longer tell what belongs to
  the task) and risks trampling a sibling task's ground. Mirrors the
  review phase's contained/spreading doctrine, one phase earlier.
- **Reviewer** — banks only. It never writes code; that stays.
- Both report BANK unconditionally; the orchestrator deposits only
  when the task's `do_banking` is true. A consolidation task or an
  analysis-cycle task runs with the same charters and its BANK lines
  fall on the floor.

### The boundary

Fires when the task loop's phase-completion check finds no open tasks
in the current phase, **before** `--phase-complete` is recorded. The
invariant is structural: a phase only ever completes consolidated.
Crash-resume falls out of existing task-loop machinery, and the next
phase's tasks never interleave with consolidation work. Quick-fix
plans and machinery-created phases (`Analysis (Cycle N)`,
`Review Remediation`) record without a sweep.

### One finder agent

A single agent. Input: the phase's commit range (identifiable via the
`{topic}-{phase_id}-{task_id}` internal ID convention), the bank, the
specification, and the remit, exclusion bar and consequence floor
baked into its charter. Output: findings — each naming its class, its
evidence, the failure it prevents, its proposed consolidation shape,
and which banked entries it confirms — plus spec defects the landed
work reveals. Nothing below the bar is written: no observations
section, no pre-existing-debt section, no named discards.

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
   parameter conventions. Judgment-heavy; the floor is what keeps it
   from creeping.
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
  semantics untouched. A candidate that changes what the code does is
  a finding of class `behaviour`, reported as one — a defect the phase
  introduced or exposed, a contract its code now violates.
- **Cause vs subject.** Every finding must be *caused by the phase's
  changes*; the *fix* may reach outside the diff. Consolidating
  phase-duplicated logic into a pre-existing helper — touching its
  existing call sites if the merge needs it — is in-remit. A refactor
  whose subject is wholly pre-existing code the phase merely sat next
  to is not a finding.
- **No architecture re-litigation.** Cross-phase structural patterns
  stay the analysis loop's remit.
- **The plan-authorable test.** A finding that *could* have been in
  the plan — a missed requirement, a design gap — is not
  consolidation. It routes through the ad hoc plan change path with
  its own gate.

### The consequence floor

One bar, stated once in a shared reference, loaded by every party
that produces or judges a finding: the three analysis agents, the
boundary finder, the executor's and reviewer's BANK, the synthesizer,
the boundary judge.

> A finding names the failure it prevents: what goes wrong, for whom,
> and how it would be noticed. A finding that cannot is not written.
>
> Duplication is a finding only when the copies encode a rule whose
> divergence would be silent — no test, no compile error, no visible
> symptom — and consequential. Two similar things that would fail
> loudly if they drifted are not a finding. Names, file placement,
> argument order, symmetry between test helpers, and unrouted call
> sites of a helper never are.

Three consequences of the floor:

- **Test files are in scope only for failure-mode findings** — a
  guard that passes while checking nothing, an isolation hole that
  reaches the developer's machine, a reproduced flake on the thing
  being shipped. Never for reuse, naming or symmetry: nothing in a
  test file ships, so nothing in it can fail for the user.
- **Duplication terminates.** "Silent and consequential" is not
  scale-free; a sweep under it has an end.
- **The walk carries only what matters.** A proposal that reaches the
  user names a failure; the user judges the failure, never the
  tidiness.

### Comment-only findings and one-line fixes

- A finding whose entire remedy is comment text never becomes a
  task. At both judgment points the orchestrator checks each against
  the comment bar in `code-quality.md` — a comment earns its place
  only by carrying what the code cannot — applies the survivors
  directly, and lands them in one commit for the pass. Mirrors the
  task reviewer's comment corrections.
- A finding that clears the floor but whose fix is a line — a log
  string naming a method that no longer exists — is not a task of its
  own. The judge or synthesizer folds every such one-liner from the
  pass into a single corrections task, executed and reviewed once.

### The complete-set rule

A consolidation task that routes call sites through a shared helper
names the complete set, measured (a grep count in the task body), and
converts all of it. The reviewer checks the count. The self-generated
pattern — a task converting the sites it named, the next cycle finding
the rest — is closed at authoring, and a later "the remaining N sites"
finding has no failure to name.

### Orchestrator judges, task-writer authors

The finder proposes; the orchestrator disposes. The orchestrator is
the only party holding session context — what the user deliberately
deferred, what an ad hoc change already settled, what a finding would
trample. It re-applies the bar and the floor, dedups, settles spec
defects, and folds the survivors into task-shaped units at normal
planning granularity — no giant single task; the count is dictated by
the work, never capped.

No synthesizer stage at the boundary: synthesis exists to merge
several agents' outputs; with one finder the orchestrator judges
directly.

The existing `workflow-implementation-task-writer` authors the
approved set into the **current phase** via the plan's format
adapter — the same path the analysis loop uses. Charters stay
narrow: the orchestrator never writes tasks, the task-writer never
judges.

### The settled directions

A later pass must not undo what an earlier pass settled on taste.
The record already exists: every walk's approvals sit in the
manifest's `staging` (`p{M}` for a boundary walk, `c{M}` for an
analysis cycle), and each approved row names a proposal in that
pass's committed staging file whose title and Solution are the
direction the pass settled. Nothing is written a second time — the
boundary judge reads the prelude's `staging` and the synthesizer
dispatch reads it fresh, and each opens the approved proposals of
every earlier pass. One rule governs what they find:

> A proposal that reverses a listed direction is dropped unless the
> finding shows that direction wrong by measurement, the
> specification, or a project rule — and then the proposal names the
> ground.

"Reverses", not "touches": extending, completing or building on a
direction is not a reversal. A measured defect is always grounds — a
regression an earlier pass introduced stays catchable. A reversal
without grounds is dropped, unwritten — never raised to the user as a
fork, never named in a report. The three analysis agents, the
executor and the reviewer never see the directions: the agents run
with clean context by design, and the directions constrain
proposals, not fixes. Deriving them from the staging files leaves no
write to duplicate on a re-entry and none to lose in a crash.

### The gate

Standard phase-gate shape: gated, automatable, same as the other
phase gates.

### No re-loop

One pass per boundary. When the consolidation tasks complete (through
the normal executor → reviewer loop like any task), the next phase
begins — no re-check. Re-checking is "loop until clean" reborn at
phase scale, the failure mode this design exists to kill; agents
always find something. The guards are structural, not convergent:

1. the consolidation tasks are themselves executed and reviewed;
2. nothing they bank is kept — `do_banking` is false for them;
3. the analysis loop is the backstop, on its own findings.

### The analysis loop

Runs after the plan's last phase, unchanged in shape: three agents
with clean context, a synthesizer, a walk, a phase of tasks, again
until the agents return clean. Two things hold it:

- **The floor and the settled directions** apply to its synthesizer
  exactly as to the boundary judge.
- **The cycle gate counts the topic's lifetime.** `task
  analysis-cycle` increments `analysis_cycle_total` alone and answers
  `over_cycle_limit` past three; from the fourth cycle every cycle
  opens with the convergence diagnostic and the proceed/skip menu,
  whatever the session history. The user decides; the loop never
  skips on its own.

## Engine surface

- `task start` → `do_banking` (derived, never stored) over
  `work_type`, `machine_phases`, `consolidated_phases` and
  `staging.p{N}`.
- `task analysis-cycle` → `{cycle_total, over_cycle_limit,
  analysis_gate_mode}`; `render cycle-limit` reads the lifetime
  counter; `task init` resets gate modes only.
- `bank` and `machine_phases`: plain array fields on
  `implementation.{topic}`, written with the generic `manifest push`
  (the bank cleared with `manifest delete`) — the review phase's
  `out_of_scope` and `dismissed_grounds` precedent. No engine storage
  code. Settled directions have no field: they are read from
  `staging` and the staging files.
- Staging reuses the guarded container: `staging.p{N}` for the
  boundary walk beside the analysis loop's `staging.c{N}`;
  `tasks-overview` and `proposed-task` serve both.

## Build plan (2026-09-09)

- **PR0** — this design, standalone.
- **PR1** — engine: `do_banking`, the lifetime cycle gate, tests and
  the pipeline simulation.
- **PR2** — the bank's lifecycle in prose: the deposit reference
  behind the flag, the boundary pass emptying the bank, the analysis
  loop unseeded, the finder's charter.
- **PR3** — the consequence floor: the shared reference and its
  loaders, test-file scope, comment handling, the corrections task,
  the complete-set rule.
- **PR4** — the settled directions.

Tests ride each layer: engine suites and the pipeline simulation for
PR1 and PR4, prose cases and snapshots for the flows they change.

## Open at build time

- The deposit reference's name and the floor reference's name.
- The corrections task's shape in the staging file.
