# Stop Hook Guards the Task Loop

## The Idea

A skill-scoped `Stop` hook on `workflow-implementation-process` that refuses to let a turn end while the task loop is mid-flight without a legitimate gate — harness-enforced continuation, not instruction-followed.

## Why This Matters

The task loop stalled repeatedly (10+ times over two days on Portal, 2026-08) at the auto branches of the fix and task gates: a long gate summary ended the turn and the loop simply stopped, with nothing distinguishing "continued correctly" from "stalled". Two layers shipped against it — glanceable gate summaries (so the last emission no longer reads as a sign-off) and engine-rendered continuation lines on every auto branch (`DISPLAY: task gate auto-approved` / `DISPLAY: fix gate auto-accepted`, so no branch completes by silence). Both are strong nudges; neither is enforcement. A Stop hook is the only deterministic layer: the harness blocks the turn end, whatever the model does.

## Shape

- Skill-scoped `Stop` hook in `workflow-implementation-process` frontmatter. Skill-frontmatter `Stop` hooks do fire (verified v2.1.270), so the mechanism is sound — unlike skill-frontmatter `SessionEnd` hooks, which never fire (why the workflows' own session-end cleanup is a settings-level hook), but `Stop` is a different event and is honoured. Caveat that raises the stakes on the guard conditions: a skill hook keeps firing for the **rest of the session** once the skill is invoked, not only while the skill's turn is active — so the guard conditions below, not phase-scoping, are the only thing keeping it from misfiring after the loop is done.
- Guard conditions, roughly: this session owns a live implementation topic (presence records session → topic, though implementation doesn't beat yet — a two-line addition), the manifest's `current_task` is set, and the last assistant message carries no legitimate stop artifact. Block with a reason naming the stage's next action.
- Every legitimate stop in the task loop ends with a rendered gate artifact (blocked-tasks menu, executor-block menu, fix gate, task gate, cycle gate) — that's the discriminator. **The marker must be chosen after the menu-structure rework settles** — the dotted `· · ·` rule is being redesigned, so don't inherit it; the continuation-line work made "last turn contains a gate artifact" the invariant to key on.

## Open Verification

- Confirm the Stop hook payload carries `transcript_path` (to read the last assistant message) and `stop_hook_active` (to prevent an infinite block loop).
- A misfiring Stop hook is worse than the stall — it traps the user in a turn that can't end. Guard conditions must be verified tight before shipping.

## Trigger

Only if the two shipped layers don't hold. If stalls recur at the auto branches despite the continuation lines, build this.
