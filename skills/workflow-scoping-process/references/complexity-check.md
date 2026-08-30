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

If any criterion fails, surface the concern. Write the concerns to `.workflows/.cache/{work_unit}/scoping/{topic}/complexity.json` with the Write tool (`{"concerns": ["…", …]}` — one line per failed criterion, e.g. "Requires design decisions about the new API surface"), then render the gate and emit its DISPLAY and MENU sections verbatim per their markers:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render complexity-gate {work_unit} --file .workflows/.cache/{work_unit}/scoping/{topic}/complexity.json
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

Propose the promoted feature's first phase — do we answer this by reading, by talking, or by measuring? The concerns that triggered promotion are the strongest cue:

- **research** — open feasibility / "how does X work" / "what's possible" unknowns the work hasn't resolved.
- **experiment** — the open question is empirical and decision-bearing: a claim that needs measuring against a real system before anything can be decided on it.
- **discussion** — the shape is clear and the open questions are trade-offs and decisions, not unknowns.

Derive the one-line read + reason (e.g. "The concern is an open unknown — I'd start with research."), write it to `.workflows/.cache/{work_unit}/scoping/{topic}/first-phase.json` with the Write tool (`{"read": "…"}`), then render the choice and emit its MENU section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render first-phase-gate {work_unit} --file .workflows/.cache/{work_unit}/scoping/{topic}/first-phase.json
```

**STOP.** Wait for user response.

Set `next_phase` to the choice (`research`, `experiment`, or `discussion`).

→ Proceed to **D. Bridge**.

## D. Bridge

The promoted work unit re-enters the pipeline the way discovery hands off single-phase work — the destination is supplied, not derived from state.

> *Output the next fenced block as markdown (not a code block):*

```
> Work type updated — entering plan mode to hand off the first phase in a clean context.
```

Invoke `/workflow-bridge {work_unit} discovery {next_phase}` via the Skill tool.
