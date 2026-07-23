# Complexity Check

*Reference for **[workflow-scoping-process](../SKILL.md)***

---

Assess whether this change is genuinely quick-fix material. Evaluate against these criteria:

- **Mechanical**: Is the change well-defined and repetitive? (find-and-replace, API rename, syntax update)
- **Narrowly scoped**: Can it be expressed as 1-2 tasks?
- **No design decisions**: Does it avoid architectural trade-offs or competing approaches?
- **No new behaviour**: Does it preserve existing behaviour (just change how it's expressed)?
- **Existing test coverage**: Can correctness be verified by running existing tests?

## A. Evaluate

#### If all criteria are met

→ Return to caller.

#### Otherwise

→ Proceed to **B. Complexity Warning**.

## B. Complexity Warning

If any criterion fails, surface the concern:

> *Output the next fenced block as a code block:*

```
Complexity Check

This change may be more involved than a quick-fix:

  • {specific concern — e.g., "Requires design decisions about the new API surface"}
  • {additional concern if applicable}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
How would you like to proceed?

- **`c`/`continue`** — Continue as quick-fix anyway
- **`f`/`feature`** — Promote to feature (full pipeline)
- **`b`/`bugfix`** — Promote to bugfix (investigation pipeline)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `continue`

→ Return to caller.

#### If `feature`

Update the work type in the work-unit manifest and the project registry:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit} work_type feature
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set project.work_units.{work_unit}.work_type feature
```

Commit both manifests:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit --workflows -m "workflow({work_unit}): promote quick-fix to feature"
```

→ Proceed to **C. First Phase**.

#### If `bugfix`

Update the work type in the work-unit manifest and the project registry:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit} work_type bugfix
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set project.work_units.{work_unit}.work_type bugfix
```

Commit both manifests:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit --workflows -m "workflow({work_unit}): promote quick-fix to bugfix"
```

Set `next_phase` = `investigation`.

→ Proceed to **D. Bridge**.

## C. First Phase

Propose research-vs-discussion — the concerns that triggered promotion are the strongest cue:

- **research** — open feasibility / "how does X work" / "what's possible" unknowns the work hasn't resolved.
- **discussion** — the shape is clear and the open questions are trade-offs and decisions, not unknowns.

Lead with your read and one reason, then render the choice:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
{One-line read + reason, e.g. "The concern is an open unknown —
I'd start with research."}

- **`r`/`research`** — Explore feasibility and options first, no decisions yet
- **`d`/`discussion`** — Ready to discuss and make decisions
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

Set `next_phase` to the choice (`research` or `discussion`).

→ Proceed to **D. Bridge**.

## D. Bridge

The promoted work unit re-enters the pipeline the way discovery hands off single-phase work — the destination is supplied, not derived from state.

> *Output the next fenced block as markdown (not a code block):*

```
> Work type updated — entering plan mode to hand off the first
> phase in a clean context.
```

Invoke `/workflow-bridge {work_unit} discovery {next_phase}` via the Skill tool.
