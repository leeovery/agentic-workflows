# Cross-Cutting Continuation

*Reference for **[workflow-bridge](../SKILL.md)***

---

Route a cross-cutting concern to its next pipeline phase, with an option to revisit earlier phases.

Cross-cutting pipeline: (Research) → Discussion → Specification (terminal)

## Phase Routing

Use `next_phase` from discovery output to determine the target skill:

| next_phase | Target Skill |
|------------|--------------|
| research | workflow-research-entry |
| discussion | workflow-discussion-entry |
| specification | workflow-specification-entry |
| done | (terminal) |

## A. Check Terminal

#### If `next_phase` is `done`

Set the work unit status to completed:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} status completed
```

> *Output the next fenced block as a code block:*

```
Cross-Cutting Completed

"{work_unit:(titlecase)}" has completed all pipeline phases.
```

**STOP.** Do not proceed — terminal condition.

#### Otherwise

Set `target_phase` = `next_phase`.

→ Proceed to **B. Check for Earlier Phases**.

## B. Check for Earlier Phases

Check if there are completed phases earlier in the pipeline that the user could revisit. Look at the discovery output's `phases` data — any phase with status `completed` that comes before `next_phase` in the pipeline order.

#### If no earlier completed phases exist

→ Proceed to **E. Enter Plan Mode**.

#### If earlier completed phases exist

→ Proceed to **C. Offer Revisit**.

## C. Offer Revisit

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
{previous_phase:(titlecase)} completed for "{work_unit:(titlecase)}".

- **`y`/`yes`** — Proceed to {next_phase}
- **`r`/`revisit`** — Revisit an earlier phase
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If user chose `y`/`yes`

→ Proceed to **E. Enter Plan Mode**.

#### If user chose `r`/`revisit`

→ Proceed to **D. Select Phase**.

## D. Select Phase

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which phase would you like to revisit?

1. {phase:(titlecase)} — completed
2. ...
{N}. Back

Select an option (enter number):
· · · · · · · · · · · ·
```

List only completed phases that come before `next_phase`.

**STOP.** Wait for user response.

#### If user chose Back

→ Return to **C. Offer Revisit**.

#### If user chose a phase

Set `target_phase` = selected phase.

→ Proceed to **E. Enter Plan Mode**.

## E. Enter Plan Mode

Call the `EnterPlanMode` tool to enter plan mode. Then write the following content to the plan file:

```
# Continue Cross-Cutting: {work_unit}

@if(target_phase == next_phase) The previous phase has completed. Continue the pipeline. @else Revisiting an earlier phase. @endif

## Next Step

Invoke `/workflow-{target_phase}-entry cross-cutting {work_unit}`

Arguments: work_type = cross-cutting, work_unit = {work_unit} (topic inferred from work_unit)
The skill will skip discovery and proceed directly to validation.

## How to proceed

Clear context and continue.
```

Call the `ExitPlanMode` tool to present the plan to the user for approval.
