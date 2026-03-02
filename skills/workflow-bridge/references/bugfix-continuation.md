# Bugfix Continuation

*Reference for **[workflow-bridge](../SKILL.md)***

---

Route a bugfix to its next pipeline phase and enter plan mode with continuation instructions.

Bugfix pipeline: Investigation → Specification → Planning → Implementation → Review

## Phase Routing

Use `next_phase` from discovery output to determine the target skill:

| next_phase | Target Skill | Plan Mode Instructions |
|------------|--------------|------------------------|
| investigation | start-investigation | Resume investigation for work unit |
| specification | start-specification | Start/resume specification for work unit |
| planning | start-planning | Start/resume planning for work unit |
| implementation | start-implementation | Start/resume implementation for work unit |
| review | start-review | Start review for work unit |
| done | (terminal) | Pipeline complete |

## Generate Plan Mode Content

#### If `next_phase` is `done`

> *Output the next fenced block as a code block:*

```
Bugfix Complete

"{work_unit:(titlecase)}" has completed all pipeline phases.
```

**STOP.** Do not proceed — terminal condition.

#### Otherwise

Call the `EnterPlanMode` tool to enter plan mode. Then write the following content to the plan file:

```
# Continue Bugfix: {work_unit}

The previous phase has concluded. Continue the pipeline.

## Next Step

Invoke `/start-{next_phase} bugfix {work_unit}`

Arguments: work_type = bugfix, work_unit = {work_unit}
The skill will skip discovery and proceed directly to validation.

## How to proceed

Clear context and continue.
```

Call the `ExitPlanMode` tool to present the plan to the user for approval. The user will then clear context and continue.
