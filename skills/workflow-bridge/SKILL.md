---
name: workflow-bridge
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-bridge/scripts/gateway.cjs), Bash(node .claude/skills/workflow-engine/scripts/engine.cjs)
---

Decide where the work goes when a phase concludes or pauses, then hand it off.

A phase invokes this skill as it ends. A linear work type's next phase is derived from state, with the one real choice offered where there is one — skip review, revisit an earlier phase; discovery supplies its destination, since the next phase isn't in state yet; an epic returns to its menu. Every route ends in the handoff.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Instructions

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.

This skill receives positional arguments:
- `$0` — **work_unit**: the work unit name (directory under `.workflows/`). Held downstream as `{work_unit}`.
- `$1` — **completed_phase**: the phase handing off — `discovery` or any later phase; the one that concluded, or the one pausing when `$3` is `paused`. Held downstream as `{completed_phase}`.
- `$2` — **next_phase** (optional): the destination, where the caller already knows it — discovery handing a single-phase work type to its first phase. Held downstream as `{next_phase}`. Absent or the literal `none` otherwise.
- `$3` — **outcome** (optional): the literal `paused` when the phase is leaving on a wait rather than concluding — the wait gate's or the spawn gate's `yes`, with `$2` as `none`; the literal `cancelled` when the phase's topic was cancelled from inside its session and its receipt is already rendered, or `postponed` when it left for the roadmap the same way, both with `$2` as `none`. Held downstream as `{outcome}`. Absent means the phase completed.

---

## Step 1: Read Work Type and Run Discovery

Refresh the tmux session label — a no-op unless the user opted in and this session runs inside tmux:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs session label {work_unit}
```

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Read Work Type and Run Discovery`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Working out where the work goes next.
```

Read work type from the manifest:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit} work_type
```

#### If completed phase is `discovery`

Discovery is the first phase, so the next phase isn't in pipeline state yet — the destination is *given*, not derived: an epic returns to its menu, and single-phase types take the `next_phase` the discovery endpoint supplied. Skip the discovery script.

→ Proceed to **Step 2**.

#### If work type is `epic`

An epic returns to its menu, which reads the epic's state itself.

→ Proceed to **Step 2**.

#### Otherwise

Run the discovery script with the work unit:

```bash
node .claude/skills/workflow-bridge/scripts/gateway.cjs {work_unit}
```

The output contains `next_phase`, `completed_phases` (in pipeline order), and `revisitable_phases` — the completed phases before `next_phase`, filtered to the work type's pipeline.

→ Proceed to **Step 2**.

---

## Step 2: Route the Work

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Route the Work`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Handing the work on — after the choice, where there is one to make.
```

Load the continuation for the completed phase and work type. The completed-phase check runs first, so an epic concluding discovery takes the discovery continuation.

#### If completed phase is `discovery`

Load **[discovery-continuation.md](references/discovery-continuation.md)** and follow its instructions as written.

#### If work type is `feature`

Load **[feature-continuation.md](references/feature-continuation.md)** and follow its instructions as written.

#### If work type is `bugfix`

Load **[bugfix-continuation.md](references/bugfix-continuation.md)** and follow its instructions as written.

#### If work type is `quick-fix`

Load **[quickfix-continuation.md](references/quickfix-continuation.md)** and follow its instructions as written.

#### If work type is `cross-cutting`

Load **[cross-cutting-continuation.md](references/cross-cutting-continuation.md)** and follow its instructions as written.

#### If work type is `epic`

Load **[epic-continuation.md](references/epic-continuation.md)** and follow its instructions as written.

---

## Notes

**Linear** continuations (feature, bugfix, quick-fix, cross-cutting) take `next_phase` from the discovery script. `done` completes the work unit. A pause continues at what the phase waits on, with no offer. Otherwise the next-phase gate offers what state allows — skip review on the review hop, revisit an earlier phase — and an empty gate continues straight on. The work hands off to `workflow-{phase}-entry {work_type} {work_unit}`.

**Epic** continuation hands off to the epic menu, `workflow-continue-epic {work_unit} {completed_phase} {outcome}` — an epic has no single next phase, so the person picks the next move there. The menu shows the banner for what just concluded or paused, and offers to complete the epic when its work is all done.

**Discovery** continuation hands an epic to its menu with no banner, and every other work type to its first phase.

Nothing passes but the skill and its arguments: what the next skill needs is on disk.
