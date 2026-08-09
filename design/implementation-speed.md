# Implementation Speed — tune the loop from the inside out, one instrumented change at a time

The implementation phase is the slowest part of the pipeline by a wide
margin: Portal's theming-system feature spent 9 of its 13 calendar days
in implementation — ~63 hours of subagent time across 306 dispatches —
for a feature whose spec and plan were settled in four. This programme
reduces that time without weakening the review gates that make the
loop trustworthy on gated projects. One change lands at a time, each
with a named instrument, a baseline, and a rollback trigger, so every
effect is measured rather than argued. Design log for the programme.
Opened 2026-08-09.

## Motivation (2026-08-09)

The starting hypothesis was that fresh-per-task subagents pay a heavy
"world-building" tax — every executor re-learning the codebase before
it can act. Transcript analysis of the Portal feature (153 executor +
153 reviewer dispatches, Aug 1–9) refuted the emphasis and relocated
the cost:

- **Model inference at xhigh effort is ~75% of all subagent time**
  (~47h of ~63h). Every dispatch inherited the session's xhigh effort;
  neither agent definition set its own. Executors burned a median of
  60 API turns and ~40k output tokens per task; reviewers 42 turns
  and ~28k.
- **World-building is real but minor.** Median first edit at 4.7 min
  of a 12.7-min median executor run — and that segment includes the
  mandatory task/reference reading. Agents already read selectively:
  the 238KB spec was touched by under a third of executors, ~9KB at a
  time; ~3 of 14 project skills per dispatch, not all. Warm-context
  designs (forked sessions, persistent specialist agents, orientation
  documents) cap out at ~3–4 min/task and carry real context-limit
  risk — executors already peak at a median 174k tokens for one task.
- **`go test` alone is 17% of subagent time** — 3,264 runs, ~21 per
  task across the pair, the reviewer re-running the suite ~9× per
  review.
- **The orchestrator is a hidden third agent**: ~12 min of the ~35-min
  median inter-commit gap is the main session's own loop (gate
  renders, findings summaries, engine calls, commits), also at session
  effort.
- **The protocol floor is ~10 min/task regardless of task size** —
  87 planned tasks for the feature, many trivially small, each paying
  full boot for executor, reviewer, and orchestrator loop.
- **The analysis loop owns the tail**: functionally complete Aug 7,
  then 2 further days of analysis-generated cleanup phases (15 + 12
  tasks, each fully protocoled), with slow convergence because each
  cycle's refactors feed the next cycle's findings.

Full task-level timings: 103 tasks committed at a 35-min median
inter-commit gap; 31% of tasks bounced at least once in review (46 fix
rounds, max 4 attempts on one task).

## The ordering principle

Change one layer at a time, from the inside out, and use the next
layer downstream as the measuring instrument.

The asymmetry that anchors the order: an executor made dumber fails
*visibly* — the still-strong reviewer bounces its mistakes and the
cost lands in a countable fix-round rate. A reviewer made dumber fails
*silently* — its misses surface in analysis cycles, or production, or
never. So the executor degrades first while the reviewer stays at full
strength; the reviewer moves only after the executor settles; the
analysis loop is not restructured while it is serving as the
reviewer's downstream audit.

A change is judged against its baseline over a feature or two of
auto-gated Portal work. The standing instrument is the transcript
analyzer (see Measurement below) — the same table for any window,
comparable across steps.

## The programme

Six steps, in order. Each lands alone, is measured, and either sticks
or rolls back before the next begins.

### 1. Executor effort → medium

`effort: medium` in `agents/workflow-implementation-task-executor.md`
frontmatter. The spec and plan carry the design decisions; execution
is closer to transcription than invention, and the xhigh-effort
reviewer remains the safety net.

- **Instrument**: reviewer bounce rate and fix attempts per task; median
  executor active time.
- **Baseline**: 31% bounce, 1.44 attempts per bounced task, 12.7 min
  median.
- **Expect**: executor time down 30–40%; bounce within a few points of
  baseline.
- **Rollback trigger**: bounce rate past ~45% or attempts/task climbing —
  settle at `high` instead.

### 2. Reviewer effort → high

One notch, not two: the reviewer is the safety net gated projects lean
on. Only after step 1 settles.

- **Instrument**: needs-changes rate (a collapse toward zero means the
  reviewer stopped looking, not that quality arrived); analysis cycle 1
  finding counts (rising findings = review is leaking); spot review on
  gated work.
- **Baseline**: 27h reviewer time per feature; ~15 findings in the
  first analysis cycle; 31% needs-changes.
- **Rollback trigger**: analysis cycles start surfacing defect classes
  reviews previously caught.

### 3. Analysis-loop batching

Composite cleanup tasks: one dispatch for a cycle's mechanical chores
(de-dup, single-sourcing, comment trims) instead of 12–15 individually
protocoled tasks each paying full executor + reviewer + orchestrator
boot. Deferred until step 2 has finished using the analysis cycles as
its instrument.

- **Instrument**: cycles-to-clean; tail duration after functional
  completion.
- **Baseline**: ~2 days of tail on Portal (27 analysis tasks, +31%
  scope after the feature worked, cycle 3 pending at time of writing).

### 4. Coarser tasks at planning

Planning guidance so small related steps land as one task — the
~10 min/task protocol floor times fewer tasks is the win. Needs a
fresh feature; per-task metrics shift with task size, so the
comparison is feature-level totals.

- **Instrument**: total implementation hours and tasks-per-feature
  against a spec of comparable scope.
- **Baseline**: 87 planned tasks, ~63 subagent-hours, 9 days.

### 5. Review tiering by task class

Full five-dimension review for seam/architecture tasks; a lighter,
diff-scoped pass for mechanical ones. Deliberately after step 4 —
coarser tasks change the risk mix the tiers would be designed for.

### 6. Residual trims

Orchestrator-loop slimming; package-scoped test discipline (executor
and reviewer prompts nudging targeted `go test` over repeated broad
runs — 10.7h per feature at baseline). Only worth attention once the
larger levers stop moving the numbers.

## Explicitly parked

- **Warm-context family** — forked sessions (`--fork-session` is real
  but needs headless `claude -p`, unavailable to skill-driven
  dispatch; the in-harness `fork` subagent type inherits the
  orchestrator's noisy lineage), persistent specialist agents,
  orientation documents, phase-scoped executor continuation. All cap
  at the ~4-min world-build segment and the continuation variants
  break on context limits (174k median executor peak per single task).
  Revisit only if the harness gains purpose-built subagent forking.
- **Task-level parallelism** — 52 of 153 executors touched one hub
  file (`internal/tui/model.go`, 5,467 lines); intra-phase parallelism
  is merge conflict by construction, and the serial loop's
  each-task-builds-on-the-last property is load-bearing. If
  parallelism ever enters, it is phase-level and marked at planning
  time.
- **Monolithic build experiment** (hand the spec to one session, one
  review pass over the whole diff) — cheap to run and genuinely
  informative, but it removes the per-task human gate that is the
  loop's point on billing-grade work. Waits until a feature comes
  along where auto-gate would have been used anyway and the comparison
  is free.

## Measurement

The transcript analyzer aggregates a project's subagent transcripts
(`~/.claude/projects/<project>/*/subagents/agent-*.jsonl`, filtered by
`agentType` and date window) into per-type medians: active time, API
turns, output tokens, peak context, inference-vs-tool split, bash
class counts (`go-test`, linters, git), read volumes by category, and
top repeated file reads. Currently a scratchpad script from the
2026-08-09 investigation; banked into the repo when step 1's first
measurement window opens.

## Status log

- **2026-08-09** — Programme opened. Portal theming-system transcript
  analysis (this document's Motivation) is the shared baseline.
  Step 1 shipped: `effort: medium` on the executor agent definition.
