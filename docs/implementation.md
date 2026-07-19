# Implementation

Implementation is an orchestration problem, and the skill treats it as one. The session never writes code itself. It reads the plan through the [format adapter](output-formats.md), dispatches a fresh **executor agent** per task, dispatches an independent **reviewer agent** over the result, owns every git operation (agents never touch git), and records all progress through the [engine's](engine.md) `task` verbs. Two hard rules frame everything: no autonomous decisions on spec deviations, and all git belongs to the orchestrator.

Session setup discovers what the agents will need: environment setup instructions (run once per project), project skills (`.claude/skills/` conventions the executor should follow), and linters to run after each task. Discovered values are confirmed with the user and cascade from [project defaults](configuration.md).

## The task loop

Each task runs the same eight stages. The next task comes from the format's `reading.md` (unblocked, priority-ordered); the engine records it:

```bash
engine task start {wu} {topic} {internal-id}
```

Engine `task` verbs answer with a JSON line **followed by rendered gate sections**, parameterised from manifest state. The session emits them verbatim at the stage that owns them, byte-for-byte. Captured live:

```json
{"ok":true,"mode":"created","gates":{"task_gate_mode":"gated","fix_gate_mode":"gated","analysis_gate_mode":"gated"},
 "counters":{"fix_attempts":0,"analysis_cycle_total":0,"analysis_cycle_session":0}}
```

**The executor** receives the task content, the spec, code-quality standards, project skills, linter commands, and one of two workflow references depending on work type. It is stateless: every invocation starts fresh with the full task content. If the planned approach won't work (a spec decision untenable, a package not behaving as expected), its instruction is unambiguous: stop and report, never pick an alternative, never work around it. The orchestrator presents the blocker to the user and stops.

**The TDD workflow** is RED → GREEN → REFACTOR → LINT, pragmatic but strict on sequencing: a failing test before implementation, seen to fail for the right reason, and never a test changed to make broken code pass. "Complete, functional implementations": minimal means no gold-plating beyond what the test requires, not hardcoded returns. The violation table is explicit, wrote code before the test? Delete the code, write the test, rewrite. "While I'm here" improvement? Not in the plan, don't do it.

**The reviewer** then verifies independently: fresh agent, no stake in the implementation. An `approved` verdict flows to the task gate; `needs-changes` enters the fix loop.

### The fix loop and its threshold

Each rejected attempt is recorded by the engine, which appends the findings to a per-task fix-tracking file and counts:

```bash
engine task fix-attempt {wu} {topic} {internal-id} --findings-file {path}
```

At three attempts the threshold trips and the response carries an escalation callout, captured live:

```
⚑ Fix attempt 3 for task kitchen-routing-p1-t1 — escalation threshold reached.
```

A threshold-tripped gate always stops, even in auto mode, with a convergence analysis of the accumulated attempts so the user can see whether the loop is closing in or thrashing. The gate's options: pass the review to the executor, auto-approve future fix analyses, override the reviewer and proceed as-is, ask questions, or comment with your own direction alongside the review. Counters are per-task: completing a task zeroes `fix_attempts`, and a fresh `task start` clears the tracking file, while re-starting the in-flight task preserves both (which is how a session resumed after compaction keeps its convergence history).

### Gates and progress

The task gate after reviewer approval is the per-task checkpoint, with the standard `a`/auto opt-out (`task_gate_mode: auto`) for users who want the loop to run. Completion is recorded with position updates in one call:

```bash
engine task complete {wu} {topic} {internal-id} --phase {N} --next-task {id} [--skipped] [--phase-complete]
```

then one raw-git commit per approved task (subject `impl({wu}): T{id}` plus a brief description) staging code, tests, plan storage, and manifest together. Blocked tasks (dependency skipped or cancelled) are surfaced, never silently dropped: proceed anyway, skip, or stop, through an engine-rendered menu.

## The analysis loop

When the task loop finishes, the work is not done. Three [analysis agents](agents.md) run in parallel over the full diff since implementation began:

- **Architecture**: structural integrity, boundaries, patterns against spec and plan intent.
- **Duplication**: redundant logic introduced against the existing codebase.
- **Standards**: conventions, quality bars, project skill adherence.

A **synthesizer agent** deduplicates and reconciles their findings into proposed remediation tasks, each with problem, solution, acceptance criteria, and tests. The user triages per task (approve, auto, skip, comment); approved tasks are written into the plan as a new phase by a **task-writer agent**, and the loop routes back to the task loop to execute them. Task loop and analysis loop form a mandatory cycle, execute → analyse → execute, until an analysis cycle comes back clean. The engine counts cycles (`engine task analysis-cycle`); past three in one session the cycle gate stops and asks, with convergence analysis attached, but the stated default is to keep analysing until clean, and the skill may not choose "skip" on the user's behalf.

Before each analysis pass a git checkpoint ensures a clean tree, with unexpected (non-implementation) files surfaced for an explicit include-or-exclude decision rather than silently swept into a commit.

## The quick-fix verification variant

A [quick-fix](work-types.md#quick-fix) executor receives the verification workflow instead of TDD: BASELINE → CHANGE → VERIFY → LINT. Capture a passing test baseline first, apply the mechanical change systematically, verify the same suite still passes, and never adjust a test assertion to accommodate the change: a newly failing test means the change broke something, so fix the change. Pre-existing failures are recorded at baseline and not blamed on the task.

Conclusion marks the implementation item complete and hands off through the [bridge](how-it-fits-together.md#the-bridge), which offers [review](review.md) or early completion. Implementation artifacts are never indexed into the [knowledge base](knowledge-base.md); the code and its git history are their own record.

---

*Next: the built work gets verified against everything upstream in [review](review.md).*
