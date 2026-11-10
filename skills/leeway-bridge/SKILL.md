---
name: leeway-bridge
user-invocable: false
allowed-tools: Bash(node .claude/skills/leeway-bridge/scripts/gateway.cjs *), Bash(node .claude/skills/leeway-engine/scripts/engine.cjs *)
---

Decide where the work goes when an experiment's session leaves it, then hand it off.

The experiment invokes this skill once its series has nothing left to work, or the person picks the menu over the next experiment (`next-experiment.md`). A feature's next phase is derived from state; an epic returns to its menu. Every route ends in the handoff.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Step 1: Read Work Type and Run Discovery

This skill receives positional arguments:
- `$0` — **work_unit**: the work unit name (directory under `.leeway/`). Held downstream as `{work_unit}`.
- `$1` — **completed_phase**: the phase that concluded. Held downstream as `{completed_phase}`.

Record where this session is working — the call also labels the tmux session where the user opted in:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs session label {work_unit}
```

Read work type from the manifest:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs manifest get {work_unit} work_type
```

#### If work type is `epic`

An epic returns to its menu, which reads the epic's state itself.

→ Proceed to **Step 2**.

#### Otherwise

Run the discovery script with the work unit:

```bash
node .claude/skills/leeway-bridge/scripts/gateway.cjs {work_unit}
```

The output contains `next_phase` and `next_route`, the route it is entered by.

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

Load the continuation for the work type.

#### If work type is `feature`

Load **[feature-continuation.md](references/feature-continuation.md)** and follow its instructions as written.

#### If work type is `epic`

Load **[epic-continuation.md](references/epic-continuation.md)** and follow its instructions as written.
