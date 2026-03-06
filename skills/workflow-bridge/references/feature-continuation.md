# Feature Continuation

*Reference for **[workflow-bridge](../SKILL.md)***

---

Route a feature to its next pipeline phase, with an option to revisit earlier phases.

Feature pipeline: (Research) → Discussion → Specification → Planning → Implementation → Review

## Phase Routing

Use `next_phase` from discovery output to determine the target skill:

| next_phase | Target Skill |
|------------|--------------|
| research | start-research |
| discussion | start-discussion |
| specification | start-specification |
| planning | start-planning |
| implementation | start-implementation |
| review | start-review |
| done | (terminal) |

## Generate Plan Mode Content

#### If `next_phase` is `done`

> *Output the next fenced block as a code block:*

```
Feature Complete

"{work_unit:(titlecase)}" has completed all pipeline phases.
```

**STOP.** Do not proceed — terminal condition.

#### Otherwise

Check if there are concluded phases earlier in the pipeline that the user could revisit. Look at the discovery output's `phases` data — any phase with status `concluded` or `completed` that comes before `next_phase` in the pipeline order.

**If no earlier concluded phases exist** (e.g., next phase is discussion — nothing to revisit):

Call the `EnterPlanMode` tool to enter plan mode. Then write the following content to the plan file:

```
# Continue Feature: {work_unit}

The previous phase has concluded. Continue the pipeline.

## Next Step

Invoke `/start-{next_phase} feature {work_unit}`

Arguments: work_type = feature, work_unit = {work_unit} (topic inferred from work_unit)
The skill will skip discovery and proceed directly to validation.

## How to proceed

Clear context and continue.
```

Call the `ExitPlanMode` tool to present the plan to the user for approval.

**If earlier concluded phases exist:**

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
{previous_phase:(titlecase)} concluded for "{work_unit:(titlecase)}".

- **`y`/`yes`** — Proceed to {next_phase}
- **`r`/`revisit`** — Revisit an earlier phase

· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If user chose `y`/`yes`:**

Enter plan mode with the standard continuation content shown above.

**If user chose `r`/`revisit`:**

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which phase would you like to revisit?

1. {phase:(titlecase)} — concluded
2. ...
{N}. Back

Select an option (enter number):
· · · · · · · · · · · ·
```

List only concluded phases that come before `next_phase`. "Back" returns to the proceed/revisit prompt above.

**STOP.** Wait for user response.

**If user chose Back:** Re-display the proceed/revisit prompt.

**If user chose a phase:** Enter plan mode with the selected phase as the target:

```
# Continue Feature: {work_unit}

Revisiting an earlier phase.

## Next Step

Invoke `/start-{selected_phase} feature {work_unit}`

Arguments: work_type = feature, work_unit = {work_unit} (topic inferred from work_unit)
The skill will skip discovery and proceed directly to validation.

## How to proceed

Clear context and continue.
```

Call the `ExitPlanMode` tool to present the plan to the user for approval.
