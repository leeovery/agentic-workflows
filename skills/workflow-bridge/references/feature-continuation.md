# Feature Continuation

*Reference for **[workflow-bridge](../SKILL.md)***

---

Route a feature to its next pipeline phase, with an option to revisit earlier phases.

Feature pipeline: (Research) → Discussion → Specification → Planning → Implementation → Review

## Phase Routing

Use `next_phase` from discovery output to determine the target skill:

| next_phase | Target Skill |
|------------|--------------|
| research | workflow-research-entry |
| discussion | workflow-discussion-entry |
| specification | workflow-specification-entry |
| planning | workflow-planning-entry |
| implementation | workflow-implementation-entry |
| review | workflow-review-entry |
| done | (terminal) |

## A. Check Terminal

#### If `next_phase` is `done`

> *Output the next fenced block as a code block:*

```
Feature Complete

"{work_unit:(titlecase)}" has completed all pipeline phases.
```

**STOP.** Do not proceed — terminal condition.

#### Otherwise

Set `target_phase` = `next_phase`.

→ Proceed to **B. Offer Revisit**.

## B. Offer Revisit

Check if there are concluded phases earlier in the pipeline that the user could revisit. Look at the discovery output's `phases` data — any phase with status `concluded` or `completed` that comes before `next_phase` in the pipeline order.

#### If no earlier concluded phases exist

→ Proceed to **C. Enter Plan Mode**.

#### If earlier concluded phases exist

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

→ Proceed to **C. Enter Plan Mode**.

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

List only concluded phases that come before `next_phase`.

**STOP.** Wait for user response.

**If user chose Back:**

→ Return to **B. Offer Revisit**.

**If user chose a phase:**

Set `target_phase` = selected phase.

→ Proceed to **C. Enter Plan Mode**.

## C. Enter Plan Mode

Call the `EnterPlanMode` tool to enter plan mode. Then write the following content to the plan file:

```
# Continue Feature: {work_unit}

@if(target_phase == next_phase) The previous phase has concluded. Continue the pipeline. @else Revisiting an earlier phase. @endif

## Next Step

Invoke `/workflow-{target_phase}-entry feature {work_unit}`

Arguments: work_type = feature, work_unit = {work_unit} (topic inferred from work_unit)
The skill will skip discovery and proceed directly to validation.

## How to proceed

Clear context and continue.
```

Call the `ExitPlanMode` tool to present the plan to the user for approval.
