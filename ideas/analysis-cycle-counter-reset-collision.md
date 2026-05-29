# Analysis Cycle Counter Resets on Resume Collide with File Naming

## The Idea

Stop resetting `analysis_cycle` in the `workflow-implementation-process` Step 0 resume protocol. The counter has two purposes — escape-hatch threshold (session-local) and analysis findings file naming (globally monotonic) — and a single reset-on-resume counter cannot serve both. The fix is either (a) split the counter, (b) keep `analysis_cycle` monotonic and derive the escape-hatch threshold from a session-local delta, or (c) make the cycle number disk-derived at dispatch time and treat the manifest as a cache.

## What Happened

During a fresh session on the `slow-open-empty-previews-and-zombie-sessions` bugfix, the workflow had already completed analysis cycles 1–5 (last commit `ae6f9229: analysis cycle 5 — findings (all clean)`) and a subsequent review phase produced Phase 11. Resuming `workflow-implementation-process` to execute the Phase 11 remediation tasks triggered Step 0's reset:

```bash
node …manifest.cjs set …implementation.{topic} analysis_cycle 0
```

After the 4 Phase-11 tasks completed, the analysis loop ran. The cycle counter incremented from 0 → 1. The orchestrator (me) reasoned that c1 files already existed from the original run, and that the *real* cycle number on top of the existing c1–c5 was 6, but the manifest said 1. I split the difference and dispatched the three analysis agents with `cycle_number: 5` — heuristically picking the last on-disk cycle number rather than the next free one — and then **overwrote** the prior session's `analysis-*-c5.md` files when persisting the new findings. The user caught this and asked why c5 was being overwritten.

Root cause: the skill's resume protocol resets `analysis_cycle` unconditionally, but `invoke-analysis.md` uses that same counter as the file-naming index (`analysis-{kind}-c{N}.md`). After a resume, the counter and the on-disk files disagree, and nothing in the skill tells the orchestrator how to reconcile them.

The recovery was: rename this session's `c5` files to `c6`, restore the original `c5` content from git, bump the manifest counter to 6. Lost work was avoidable; the misnumbering was structural.

## Root Cause

`analysis_cycle` is overloaded:

1. **Escape-hatch threshold** — `analysis-loop.md` A reads `analysis_cycle` and presents the "continue or skip?" prompt when `> 3`. Resetting per-session is correct here, otherwise a long-running multi-session implementation gets capped at 3 cycles total.
2. **File naming** — `invoke-analysis.md` passes `analysis_cycle` to agents as `Cycle number`, and each agent writes findings to `analysis-{kind}-c{N}.md` using that number. This usage assumes the counter is globally monotonic across sessions — otherwise post-resume cycles collide with the prior session's files.

The two purposes have incompatible reset semantics:

| Purpose | Wants | Result of current reset |
|---|---|---|
| Escape-hatch | Session-local | ✓ Works |
| File naming | Globally monotonic | ✗ Collides on resume |

The skill doesn't acknowledge the tension. `invoke-analysis.md` doesn't tell agents (or the orchestrator) to scan existing files and pick the next free `N`. So the failure is undefined — overwrite, refuse, or guess. In this run it was "guess wrong and overwrite."

## Proposed Solutions

Pick one:

### Option A — Split the counters

Keep two manifest fields:

- `analysis_cycle_total` — globally monotonic; resets only when a new implementation starts, not on resume. Drives file naming.
- `analysis_cycle_session` — resets to 0 on resume. Drives the escape-hatch threshold.

Cleanest separation of concerns. Minor manifest schema change.

### Option B — Don't reset `analysis_cycle` on resume

Drop the `set analysis_cycle 0` line from Step 0's reset list. Track session-local cycle count separately (e.g., compute as `analysis_cycle - analysis_cycle_at_resume`, with `analysis_cycle_at_resume` set on resume). Threshold becomes "session-local count > 3".

Same effect as A with one fewer schema field.

### Option C — Derive from disk

`invoke-analysis.md` (or a helper) scans `analysis-{kind}-c{N}.md` files for the topic, computes `max(N) + 1`, writes that back to the manifest **before** dispatching agents. Manifest counter becomes a cache; files become the source of truth.

Robust to manifest/disk drift but adds I/O on every cycle and assumes the file naming convention stays stable.

### Recommendation

**Option A.** Two counters:

- `analysis_cycle_total` — monotonic; drives file naming. Reset to 0 only at fresh implementation start.
- `analysis_cycle_session` — reset to 0 on every resume / review re-open / conclude; drives the `> 3` escape-hatch threshold.

Both increment together at `analysis-loop.md` A.

## Out of Scope

- Gate-mode resets (`task_gate_mode`, `fix_gate_mode`, `analysis_gate_mode`) — those genuinely want session-local reset. Leave them alone.
- `fix_attempts` — already per-task scoped via the `set fix_attempts 0` at A in `task-loop.md`. Not relevant to this bug.

## Scope

- `workflow-implementation-process/SKILL.md` — Step 0 resume reset (session only) + resume-detection field reference
- `workflow-implementation-process/references/initialize-tracking.md` — fresh-start init seeds both counters to 0
- `workflow-implementation-process/references/analysis-loop.md` — Cycle Gate: increment both; name on total, gate on session
- `workflow-implementation-process/references/invoke-analysis.md` — Cycle number from `analysis_cycle_total`
- `workflow-implementation-process/references/conclude-implementation.md` — completion reset (session only)
- `workflow-review-process/references/review-actions-loop.md` — re-open reset (session only)
- `skills/workflow-migrate/scripts/migrations/041-split-analysis-cycle-counter.sh` + `tests/scripts/test-migration-041.sh`

## Severity

Medium. The bug doesn't corrupt the codebase — git history makes recovery straightforward — but it silently overwrites historical analysis records, and the orchestrator's "guess the right cycle number" behaviour is undefined. Will trigger on any resume of an implementation that has prior analysis cycles.
